import { bundle } from '@remotion/bundler'
import { renderStill, selectComposition } from '@remotion/renderer'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { sanitizeStoryArc, StoryArcSchema, type StoryArc } from '@buildstory/core'
import { findChrome } from '../preflight.js'
import { resolveCompositionEntry } from './index.js'
import { createFrameSchedule, VIDEO_FPS } from '../timing.js'

/** Offline stills in full-story context. No TTS, FFmpeg, audio loading, or provider API. */
export async function renderStoryboardStills(input: StoryArc, options: {
  outputDir: string; durations: number[]; scenes?: number[]; browserExecutable?: string;
  captions?: boolean; showTitleCard?: boolean; showStatsCard?: boolean;
}): Promise<Array<{ beatIndex: number; filePath: string }>> {
  const storyArc = StoryArcSchema.parse(sanitizeStoryArc(input))
  if (options.durations.length !== storyArc.beats.length) throw new Error('Storyboard duration/beat count mismatch')
  const scenes = options.scenes ?? storyArc.beats.map((_, index) => index)
  if (scenes.some(index => !Number.isInteger(index) || index < 0 || index >= storyArc.beats.length)) throw new Error('Storyboard scene index out of range')
  const audioManifest = { scenes: options.durations.map((durationSeconds, beatIndex) => ({ beatIndex, durationSeconds, filePath: '', startOffsetSeconds: 0 })), silenceGapSeconds: 0.3, bookendSilenceSeconds: 1, totalDurationSeconds: 0 }
  const schedule = createFrameSchedule(audioManifest)
  const browserExecutable = options.browserExecutable ?? await findChrome()
  if (!browserExecutable) throw new Error('An installed Chrome/Chromium is required for storyboard stills. Automatic downloads are disabled.')
  const serveUrl = await bundle({ entryPoint: resolveCompositionEntry(), webpackOverride: config => ({ ...config, resolve: { ...config.resolve, extensionAlias: { ...config.resolve?.extensionAlias, '.js': ['.ts', '.tsx', '.js'] } } }) })
  const inputProps = { storyArc, audioManifest, fps: VIDEO_FPS, silentPreview: true,
    captions: options.captions ?? true, showTitleCard: options.showTitleCard ?? true, showStatsCard: options.showStatsCard ?? true }
  const composition = await selectComposition({ serveUrl, id: 'BuildStory', inputProps, browserExecutable })
  await mkdir(options.outputDir, { recursive: true })
  const result = []
  for (const beatIndex of [...new Set(scenes)]) {
    const timing = schedule.scenes[beatIndex]!
    const frame = Math.min(timing.audioEndFrame - 1, timing.audioStartFrame + VIDEO_FPS)
    const filePath = join(options.outputDir, `scene-${beatIndex + 1}.png`)
    await renderStill({ serveUrl, composition, inputProps, browserExecutable, frame, output: filePath })
    result.push({ beatIndex, filePath })
  }
  return result
}
