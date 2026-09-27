import { dirname, join } from 'node:path'
import type { SpendBudget } from '@buildstory/core'
import { writeFile, mkdir, mkdtemp, rename, rm } from 'node:fs/promises'
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
}

function isRateLimitError(err: unknown): boolean {
  return err instanceof Error && 'status' in err && (err as { status: number }).status === 429
}

async function requestSpeech(client: OpenAI, input: string, opts: GenerateOpts): Promise<Buffer> {
  const MAX_ATTEMPTS = 3
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const cost = ttsCostUSD(input.length, opts.model ?? DEFAULT_TTS_MODEL)
    const charge = opts.budget?.reserve('TTS request', cost)
    try {
      const response = await client.audio.speech.create({
        model: opts.model ?? DEFAULT_TTS_MODEL,
        voice: opts.voice as 'nova' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'shimmer',
        input,
        speed: opts.speed,
      }, { maxRetries: 0 })
      charge?.settle(cost, 'estimate')
      return Buffer.from(await response.arrayBuffer())
    } catch (err: unknown) {
      if (isRateLimitError(err)) charge?.settle(0, 'estimate')
      if (attempt === MAX_ATTEMPTS || !isRateLimitError(err)) throw err
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
    }
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
  const workDir = await mkdtemp(join(dirname(outputPath), '.speech-'))
  try {
    const files: string[] = []
    for (const [i, input] of chunks.entries()) {
      const mp3 = join(workDir, `part-${i}.mp3`)
      const wav = join(workDir, `part-${i}.wav`)
      await writeFile(mp3, await requestSpeech(client, input, opts))
      // Decode each response separately so MP3 encoder padding is removed
      // before concatenation; never concatenate raw encoded MP3 bytes.
      await execFileAsync(getFfmpegPath(), [
        '-y', '-i', mp3, '-acodec', 'pcm_s16le', '-ar', '24000', '-ac', '1', wav,
      ])
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
      ])
    }
    // A partial scene must never be mistaken for a complete cached narration.
    await rename(completed, outputPath)
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}
