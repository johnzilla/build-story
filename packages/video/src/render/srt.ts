import { createFrameSchedule, VIDEO_FPS } from '../timing.js'
import { stringifySync } from 'subtitle'
import type { StoryBeat } from '@buildstory/core'
import { sanitizeOutboundText } from '@buildstory/core'
import type { AudioManifest } from '../tts/types.js'

export function generateSRT(beats: StoryBeat[], manifest: AudioManifest, fps = VIDEO_FPS): string {
  const scenes = manifest.scenes
  // Subtitles are keyed to audio scenes positionally; a length mismatch means the
  // beat/scene arrays drifted (a dropped or extra scene). Fail with a clear error
  // rather than crashing on an undefined scene or silently emitting skewed cues.
  if (beats.length !== scenes.length) {
    throw new Error(
      `SRT generation: beat/scene count mismatch (${beats.length} beats vs ${scenes.length} audio scenes). ` +
        `Subtitles are aligned positionally, so these must match.`,
    )
  }
  const schedule = createFrameSchedule(manifest, fps)
  const nodes = beats.map((beat, i) => {
    const timing = schedule.scenes[i]!
    const startMs = Math.round(timing.audioStartFrame * 1000 / fps)
    const endMs = Math.round(timing.audioEndFrame * 1000 / fps)
    return {
      type: 'cue' as const,
      data: {
        start: startMs,
        end: endMs,
        text: sanitizeOutboundText(beat.summary),
      },
    }
  })
  return stringifySync(nodes, { format: 'SRT' })
}
