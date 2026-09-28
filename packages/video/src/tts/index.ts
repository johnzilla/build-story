import { MAX_TTS_CHARS } from './split.js'
import { createFrameSchedule } from '../timing.js'
import { mkdir, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import OpenAI from 'openai'
import type { StoryBeat } from '@buildstory/core'
import { sanitizeOutboundValue } from '@buildstory/core'
import type { TTSOptions, AudioManifest, TTSCostEstimate } from './types.js'
import { generateSceneAudio, prepareSpeechText } from './generate.js'
import { audioKey, atomicCopy, atomicWrite, isAudioRecord, readAudio, type AudioRecord } from './cache.js'
import { ttsCostUSD, DEFAULT_TTS_MODEL, type TTSModel } from './pricing.js'
import { withConcurrency } from './concurrency.js'

export function estimateTTSCost(
  beats: StoryBeat[],
  model: TTSModel = DEFAULT_TTS_MODEL,
): TTSCostEstimate {
  beats = sanitizeOutboundValue(beats)
  const totalCharacters = beats.reduce((sum, b) => sum + prepareSpeechText(b.speechText ?? b.summary).length, 0)
  return {
    totalCharacters,
    // Priced at the model actually used to synthesize (single source of truth).
    estimatedCostUSD: ttsCostUSD(totalCharacters, model),
    sceneCount: beats.length,
  }
}

export function legacyHash(text: string, opts: { voice: string; speed: number; model: string }): string {
  return createHash('sha1')
    .update(`${text.length > MAX_TTS_CHARS ? 'full-narration-v2\x00' : ''}${opts.voice}\x00${opts.speed}\x00${opts.model}\x00${text}`)
    .digest('hex').slice(0, 12)
}

export async function loadManifest(path: string): Promise<Map<string, AudioRecord>> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8'))
    if (parsed?.version === '2' && parsed.entries && typeof parsed.entries === 'object') {
      return new Map(Object.entries(parsed.entries).filter((entry): entry is [string, AudioRecord] =>
        /^[a-f0-9]{64}$/.test(entry[0]) && isAudioRecord(entry[1])))
    }
  } catch (error) {
    if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  // Legacy/missing/broken manifests never supply trusted paths or durations.
  return new Map()
}

export async function orchestrateTTS(
  beats: StoryBeat[],
  outputDir: string,
  options: TTSOptions,
  onProgress?: (completed: number, total: number) => void,
): Promise<AudioManifest> {
  beats = sanitizeOutboundValue(beats)
  const audioDir = join(outputDir, 'audio')
  await mkdir(audioDir, { recursive: true })

  const client = new OpenAI({ apiKey: options.apiKey, maxRetries: 0 })
  const generateOpts = {
    budget: options.budget,
    voice: options.voice,
    speed: options.speed,
    model: options.model ?? DEFAULT_TTS_MODEL,
    chunkTasks: new Map<string, Promise<string>>(),
  }

  // D-15: 0.3s silence between scenes, 1s bookend
  const SILENCE_GAP = 0.3
  const BOOKEND_SILENCE = 1.0

  const manifestPath = join(audioDir, 'manifest.json')
  const records = await loadManifest(manifestPath)
  const legacyFiles = (await readdir(audioDir)).filter(file => /^scene-\d+-[a-f0-9]{12}\.wav$/.test(file))
  let writes: Promise<void> = Promise.resolve()
  const persist = (key: string, record: AudioRecord) => {
    writes = writes.then(async () => {
      records.set(key, record)
      await atomicWrite(manifestPath, JSON.stringify({ version: '2', entries: Object.fromEntries(records) }, null, 2))
    })
    return writes
  }
  // Identical beats share synthesis even when scheduled concurrently.
  const pending = new Map<string, Promise<{ filePath: string; durationSeconds: number }>>()
  let completed = 0
  const tasks = beats.map((beat, i) => async () => {
    const text = prepareSpeechText(beat.speechText ?? beat.summary)
    const key = audioKey(text, generateOpts)
    let task = pending.get(key)
    if (task) options.budget?.reuse('TTS shared scene')
    else {
      task = (async () => {
        const filePath = join(audioDir, `scene-${key}.wav`)
        let record = await readAudio(filePath, records.get(key))
        if (!record) {
          // Search legacy index-based names at every position; never trust manifest paths.
          const hash = legacyHash(text, generateOpts)
          for (const file of legacyFiles.filter(name => name.endsWith(`-${hash}.wav`))) {
            record = await readAudio(join(audioDir, file))
            if (record) { await atomicCopy(join(audioDir, file), filePath); break }
          }
        }
        if (record) options.budget?.reuse('TTS cached scene')
        else {
          await generateSceneAudio(client, text, filePath, generateOpts)
          record = await readAudio(filePath)
          if (!record) throw new Error(`Generated audio failed validation: ${filePath}`)
        }
        // Persist each completed scene before reporting progress; write failures are visible.
        await persist(key, record)
        return { filePath, durationSeconds: record.durationSeconds }
      })()
      pending.set(key, task)
    }
    const scene = await task
    onProgress?.(++completed, beats.length)
    return { ...scene, beatIndex: i, startOffsetSeconds: 0 }
  })
  const rawScenes = await withConcurrency(tasks, options.concurrency)

  const schedule = createFrameSchedule({
    scenes: rawScenes, silenceGapSeconds: SILENCE_GAP, bookendSilenceSeconds: BOOKEND_SILENCE,
  })
  const scenes = rawScenes.map((scene, i) => ({
    ...scene, startOffsetSeconds: schedule.scenes[i]!.audioStartFrame / schedule.fps,
  }))

  return {
    scenes,
    totalDurationSeconds: schedule.durationInFrames / schedule.fps,
    silenceGapSeconds: SILENCE_GAP,
    bookendSilenceSeconds: BOOKEND_SILENCE,
  }
}
