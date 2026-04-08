import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import OpenAI from 'openai'
import type { StoryBeat } from '@buildstory/core'
import type { TTSOptions, SceneAudio, AudioManifest, TTSCostEstimate } from './types.js'
import { generateSceneAudio } from './generate.js'
import { measureAudioDuration } from './measure.js'

const TTS_COST_PER_1000_CHARS = 0.015

export function estimateTTSCost(beats: StoryBeat[]): TTSCostEstimate {
  const totalCharacters = beats.reduce((sum, b) => sum + b.summary.length, 0)
  return {
    totalCharacters,
    estimatedCostUSD: (totalCharacters / 1000) * TTS_COST_PER_1000_CHARS,
    sceneCount: beats.length,
  }
}

async function withConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = []
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = tasks.slice(i, i + limit).map(fn => fn())
    results.push(...await Promise.all(batch))
  }
  return results
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
  const generateOpts = { voice: options.voice, speed: options.speed }

  // D-15: 0.3s silence between scenes, 1s bookend
  const SILENCE_GAP = 0.3
  const BOOKEND_SILENCE = 1.0

  const scenes: SceneAudio[] = []

  const tasks = beats.map((beat, i) => async () => {
    const filePath = join(audioDir, `scene-${String(i).padStart(3, '0')}.wav`)
    await generateSceneAudio(client, beat.summary, filePath, generateOpts)
    const durationSeconds = await measureAudioDuration(filePath)
    onProgress?.(i + 1, beats.length)
    return { beatIndex: i, filePath, durationSeconds, startOffsetSeconds: 0 }
  })

  const rawScenes = await withConcurrency(tasks, options.concurrency)

  // Sort by beatIndex (concurrency may complete out of order)
  rawScenes.sort((a, b) => a.beatIndex - b.beatIndex)

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
