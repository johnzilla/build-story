import { mkdir, stat, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import OpenAI from 'openai'
import type { StoryBeat } from '@buildstory/core'
import type { TTSOptions, SceneAudio, AudioManifest, TTSCostEstimate } from './types.js'
import { generateSceneAudio } from './generate.js'
import { measureAudioDuration } from './measure.js'
import { ttsCostUSD, DEFAULT_TTS_MODEL, type TTSModel } from './pricing.js'
import { withConcurrency } from './concurrency.js'

export function estimateTTSCost(
  beats: StoryBeat[],
  model: TTSModel = DEFAULT_TTS_MODEL,
): TTSCostEstimate {
  const totalCharacters = beats.reduce((sum, b) => sum + b.summary.length, 0)
  return {
    totalCharacters,
    // Priced at the model actually used to synthesize (single source of truth).
    estimatedCostUSD: ttsCostUSD(totalCharacters, model),
    sceneCount: beats.length,
  }
}

/** True if a scene's WAV already exists and is non-empty (resumable from disk). */
async function existingSceneFile(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath)
    return s.isFile() && s.size > 0
  } catch {
    return false
  }
}

// --- Resume manifest ---------------------------------------------------------
// A per-scene content hash keyed on everything that determines the audio (voice,
// speed, model, and the exact narration text). The scene filename embeds it, so:
//   • editing a beat's summary changes the hash → a new file → regeneration
//     (never stale audio reused), and
//   • an identical re-run finds the same file and, via manifest.json, reuses the
//     recorded duration too — skipping both the paid TTS call AND ffprobe.
const MANIFEST_FILE = 'manifest.json'

interface ManifestEntry {
  file: string
  durationSeconds: number
}
interface ResumeManifest {
  version: '1'
  entries: Record<string, ManifestEntry>
}

function sceneHash(text: string, opts: { voice: string; speed: number; model: string }): string {
  return createHash('sha1')
    .update(`${opts.voice}\x00${opts.speed}\x00${opts.model}\x00${text}`)
    .digest('hex')
    .slice(0, 12)
}

async function loadManifest(path: string): Promise<Map<string, ManifestEntry>> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf-8')) as ResumeManifest
    if (parsed.version === '1' && parsed.entries) return new Map(Object.entries(parsed.entries))
  } catch {
    // Missing/corrupt manifest → start fresh (files are re-measured, not re-billed
    // if they exist on disk).
  }
  return new Map()
}

export async function orchestrateTTS(
  beats: StoryBeat[],
  outputDir: string,
  options: TTSOptions,
  onProgress?: (completed: number, total: number) => void,
): Promise<AudioManifest> {
  const audioDir = join(outputDir, 'audio')
  await mkdir(audioDir, { recursive: true })

  const client = new OpenAI({ apiKey: options.apiKey })
  const generateOpts = {
    voice: options.voice,
    speed: options.speed,
    model: options.model ?? DEFAULT_TTS_MODEL,
  }

  // D-15: 0.3s silence between scenes, 1s bookend
  const SILENCE_GAP = 0.3
  const BOOKEND_SILENCE = 1.0

  const scenes: SceneAudio[] = []

  const manifestPath = join(audioDir, MANIFEST_FILE)
  const priorManifest = await loadManifest(manifestPath)

  const tasks = beats.map((beat, i) => async () => {
    const hash = sceneHash(beat.summary, generateOpts)
    const key = `${String(i).padStart(3, '0')}-${hash}`
    const filePath = join(audioDir, `scene-${key}.wav`)

    const cached = priorManifest.get(key)
    const fileExists = await existingSceneFile(filePath)

    // Full reuse: this exact scene was completed on a prior run — skip the paid
    // TTS call AND the ffprobe measurement, trusting the recorded duration.
    if (fileExists && cached !== undefined) {
      onProgress?.(i + 1, beats.length)
      return { beatIndex: i, filePath, durationSeconds: cached.durationSeconds, startOffsetSeconds: 0 }
    }

    // Synthesize only if the audio isn't already on disk (a failed run may have
    // written the file without recording it in the manifest — reuse it, but
    // measure since we have no cached duration).
    if (!fileExists) {
      await generateSceneAudio(client, beat.summary, filePath, generateOpts)
    }
    const durationSeconds = await measureAudioDuration(filePath)
    onProgress?.(i + 1, beats.length)
    return { beatIndex: i, filePath, durationSeconds, startOffsetSeconds: 0 }
  })

  const rawScenes = await withConcurrency(tasks, options.concurrency)

  // Sort by beatIndex (concurrency may complete out of order)
  rawScenes.sort((a, b) => a.beatIndex - b.beatIndex)

  // Persist the manifest so the next run can resume completed scenes. Keyed by
  // the same index-hash used for the filename.
  const nextManifest: ResumeManifest = { version: '1', entries: {} }
  for (const scene of rawScenes) {
    const file = scene.filePath.slice(scene.filePath.lastIndexOf('/') + 1)
    const key = file.replace(/^scene-/, '').replace(/\.wav$/, '')
    nextManifest.entries[key] = { file, durationSeconds: scene.durationSeconds }
  }
  await writeFile(manifestPath, JSON.stringify(nextManifest, null, 2)).catch(() => {})

  // Calculate cumulative start offsets with silence gaps (D-15)
  let offset = BOOKEND_SILENCE // 1s before first scene
  for (const scene of rawScenes) {
    scene.startOffsetSeconds = offset
    offset += scene.durationSeconds + SILENCE_GAP
    scenes.push(scene)
  }

  // Replace last gap with bookend silence
  const totalDuration = offset - SILENCE_GAP + BOOKEND_SILENCE

  return {
    scenes,
    totalDurationSeconds: totalDuration,
    silenceGapSeconds: SILENCE_GAP,
    bookendSilenceSeconds: BOOKEND_SILENCE,
  }
}
