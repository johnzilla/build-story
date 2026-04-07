import { stringifySync } from 'subtitle'
import type { StoryBeat } from '@buildstory/core'
import type { SceneAudio } from '../tts/types.js'

export function generateSRT(beats: StoryBeat[], scenes: SceneAudio[]): string {
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
