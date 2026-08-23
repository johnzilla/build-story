import { stringifySync } from 'subtitle'
import type { StoryBeat } from '@buildstory/core'
import type { SceneAudio } from '../tts/types.js'

export function generateSRT(beats: StoryBeat[], scenes: SceneAudio[]): string {
  // Subtitles are keyed to audio scenes positionally; a length mismatch means the
  // beat/scene arrays drifted (a dropped or extra scene). Fail with a clear error
  // rather than crashing on an undefined scene or silently emitting skewed cues.
  if (beats.length !== scenes.length) {
    throw new Error(
      `SRT generation: beat/scene count mismatch (${beats.length} beats vs ${scenes.length} audio scenes). ` +
        `Subtitles are aligned positionally, so these must match.`,
    )
  }
  const nodes = beats.map((beat, i) => {
    const scene = scenes[i]!
    const startMs = Math.round(scene.startOffsetSeconds * 1000)
    const endMs = Math.round((scene.startOffsetSeconds + scene.durationSeconds) * 1000)
    return {
      type: 'cue' as const,
      data: {
        start: startMs,
        end: endMs,
        text: beat.summary,
      },
    }
  })
  return stringifySync(nodes, { format: 'SRT' })
}
