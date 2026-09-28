import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { StoryBeat } from '@buildstory/core'
import { prepareSpeechText, prepareSpeechChunks } from './generate.js'
import { loadManifest, legacyHash } from './index.js'
import { audioKey, isAudioRecord, readAudio } from './cache.js'
import { DEFAULT_TTS_MODEL, ttsCostUSD, type TTSModel } from './pricing.js'

export interface SpeechCacheScene {
  beatIndex: number
  speech: string
  status: 'cached' | 'partial' | 'missing'
  durationSeconds: number
  durationBasis: 'measured' | 'estimated'
  audioPath?: string
  missingChunks: Array<{ key: string; costUSD: number }>
  incrementalCostUSD: number
}

/** Read-only inspection of the same validated scene/chunk cache used by TTS. */
export async function inspectSpeechCache(beats: StoryBeat[], outputDir: string, options: { voice: string; speed: number; model?: TTSModel }): Promise<SpeechCacheScene[]> {
  if (!Number.isFinite(options.speed) || options.speed <= 0) throw new Error('Speech speed must be positive and finite')
  const opts = { ...options, model: options.model ?? DEFAULT_TTS_MODEL }
  const directory = join(outputDir, 'audio')
  const records = await loadManifest(join(directory, 'manifest.json'))
  let files: string[] = []
  try { files = await readdir(directory) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  const seen = new Set<string>()
  const result: SpeechCacheScene[] = []
  for (const [beatIndex, beat] of beats.entries()) {
    const speech = prepareSpeechText(beat.speechText ?? beat.summary)
    const key = audioKey(speech, opts)
    let audioPath = join(directory, `scene-${key}.wav`)
    let record = await readAudio(audioPath, records.get(key))
    if (!record) {
      const suffix = `-${legacyHash(speech, opts)}.wav`
      for (const file of files.filter(file => /^scene-\d+-[a-f0-9]{12}\.wav$/.test(file) && file.endsWith(suffix))) {
        record = await readAudio(join(directory, file))
        if (record) { audioPath = join(directory, file); break }
      }
    }
    const missingChunks: SpeechCacheScene['missingChunks'] = []
    let cachedChunks = 0
    if (!record) for (const input of prepareSpeechChunks(speech)) {
      const chunkKey = audioKey(input, opts)
      const chunkPath = join(directory, 'chunks', `${chunkKey}.wav`)
      let expected: unknown
      try { expected = JSON.parse(await readFile(`${chunkPath}.json`, 'utf8')) } catch (error) {
        if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      // Mirrors generateSceneAudio: valid PCM may recover a missing checksum sidecar.
      const chunk = await readAudio(chunkPath, isAudioRecord(expected) ? expected : undefined)
      if (chunk) cachedChunks++
      else missingChunks.push({ key: chunkKey, costUSD: ttsCostUSD(input.length, opts.model) })
    }
    let incrementalCostUSD = 0
    for (const chunk of missingChunks) if (!seen.has(chunk.key)) { seen.add(chunk.key); incrementalCostUSD += chunk.costUSD }
    result.push({ beatIndex, speech, status: record ? 'cached' : cachedChunks ? 'partial' : 'missing',
      durationSeconds: record?.durationSeconds ?? Math.max(1, speech.trim().split(/\s+/).filter(Boolean).length * 60 / (130 * opts.speed)),
      durationBasis: record ? 'measured' : 'estimated', ...(record ? { audioPath } : {}), missingChunks, incrementalCostUSD })
  }
  return result
}
