import { audioKey, atomicWrite, isAudioRecord, readAudio, type AudioRecord } from './cache.js'
import { dirname, join } from 'node:path'
import type { SpendBudget } from '@buildstory/core'
import { writeFile, mkdir, mkdtemp, rename, rm, readFile, copyFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import OpenAI from 'openai'
import { DEFAULT_TTS_MODEL, ttsCostUSD, type TTSModel } from './pricing.js'
import { getFfmpegPath } from './ffmpeg.js'
import { splitForTTS } from './split.js'
import { sanitizeOutboundText } from '@buildstory/core'

const execFileAsync = promisify(execFile)

/** Exact narration sent to TTS, also used by the offline render preview. */
export function prepareSpeechText(text: string): string {
  return sanitizeOutboundText(text)
}

/** Exact per-request text, also used by offline payload previews. */
export function prepareSpeechChunks(text: string): string[] {
  return splitForTTS(prepareSpeechText(text))
}

interface GenerateOpts {
  budget?: SpendBudget | undefined
  voice: string
  speed: number
  /** OpenAI TTS model. Defaults to DEFAULT_TTS_MODEL. */
  model?: TTSModel
  /** Shared within one orchestration to avoid duplicate requests for identical chunks. */
  chunkTasks?: Map<string, Promise<string>>
}

function isRateLimitError(err: unknown): boolean {
  return err instanceof Error && 'status' in err && (err as { status: number }).status === 429
}

async function requestSpeech(client: OpenAI, input: string, opts: GenerateOpts): Promise<Buffer> {
  const MAX_ATTEMPTS = 3
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const cost = ttsCostUSD(input.length, opts.model ?? DEFAULT_TTS_MODEL)
    const charge = opts.budget?.reserve('TTS request', cost)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error('TTS request timed out after 120s')), 120_000)
    try {
      const response = await client.audio.speech.create({
        model: opts.model ?? DEFAULT_TTS_MODEL,
        voice: opts.voice as 'nova' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'shimmer',
        input,
        speed: opts.speed,
      }, { maxRetries: 0, signal: controller.signal })
      charge?.settle(cost, 'estimate')
      return Buffer.from(await response.arrayBuffer())
    } catch (err: unknown) {
      if (isRateLimitError(err)) charge?.settle(0, 'estimate')
      if (attempt === MAX_ATTEMPTS || !isRateLimitError(err)) throw err
    } finally {
      clearTimeout(timer)
    }
    await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
  }
  throw new Error('TTS attempts exhausted')
}

export async function generateSceneAudio(
  client: OpenAI,
  text: string,
  outputPath: string,
  opts: GenerateOpts,
): Promise<void> {
  const chunks = prepareSpeechChunks(text)
  if (!text.trim() || chunks.length === 0) throw new Error('Narration must contain text')
  await mkdir(dirname(outputPath), { recursive: true })
  const chunkDir = join(dirname(outputPath), 'chunks')
  await mkdir(chunkDir, { recursive: true })
  const pending = opts.chunkTasks ?? new Map<string, Promise<string>>()
  const workDir = await mkdtemp(join(dirname(outputPath), '.speech-'))
  try {
    const files: string[] = []
    for (const [i, input] of chunks.entries()) {
      const key = audioKey(input, { ...opts, model: opts.model ?? DEFAULT_TTS_MODEL })
      const chunkPath = join(chunkDir, `${key}.wav`)
      let task = pending.get(key)
      if (task) opts.budget?.reuse('TTS shared chunk')
      else {
        task = (async () => {
          let expected: AudioRecord | undefined
          try {
            const parsed: unknown = JSON.parse(await readFile(`${chunkPath}.json`, 'utf8'))
            if (isAudioRecord(parsed)) expected = parsed
          } catch (error) {
            if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
          }
          let record = await readAudio(chunkPath, expected)
          if (record) opts.budget?.reuse('TTS cached chunk')
          else {
            const mp3 = join(workDir, `part-${i}.mp3`)
            const wav = join(workDir, `decoded-${i}.wav`)
            await writeFile(mp3, await requestSpeech(client, input, opts))
            // Publish each validated chunk immediately; later failures retain it.
            await execFileAsync(getFfmpegPath(), [
              '-y', '-i', mp3, '-acodec', 'pcm_s16le', '-ar', '24000', '-ac', '1', wav,
            ], { timeout: 300_000, killSignal: 'SIGKILL' })
            record = await readAudio(wav)
            if (!record) throw new Error('Decoded speech failed WAV validation')
            await rename(wav, chunkPath)
          }
          await atomicWrite(`${chunkPath}.json`, JSON.stringify(record))
          return chunkPath
        })()
        pending.set(key, task)
      }
      const completedChunk = await task
      await copyFile(completedChunk, join(workDir, `part-${i}.wav`))
      files.push(`part-${i}.wav`)
    }
    let completed = join(workDir, files[0]!)
    if (files.length > 1) {
      const list = join(workDir, 'parts.txt')
      // Entries are controlled relative basenames, safe even if outputPath
      // contains spaces/apostrophes. No user path is inserted into list syntax.
      await writeFile(list, files.map(file => `file '${file}'`).join('\n'))
      completed = join(workDir, 'complete.wav')
      await execFileAsync(getFfmpegPath(), [
        '-y', '-f', 'concat', '-safe', '1', '-i', list, '-c:a', 'copy', completed,
      ], { timeout: 300_000, killSignal: 'SIGKILL' })
    }
    if (!(await readAudio(completed))) throw new Error('Assembled speech failed WAV validation')
    // A partial scene must never be mistaken for a complete cached narration.
    await rename(completed, outputPath)
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}
