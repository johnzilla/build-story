import type { StoryBeat } from '@buildstory/core'
import type { AudioManifest } from './tts/types.js'
import { createFrameSchedule, VIDEO_FPS } from './timing.js'

export interface CaptionCue { beatIndex: number; startFrame: number; endFrame: number; text: string }

/** Sentence boundaries first, then bounded text for long sentences (including unspaced scripts). */
export function captionSegments(text: string): string[] {
  const sentences = [...new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(text)]
  return sentences.flatMap(({ segment }) => {
    const pieces: string[] = []
    let rest = Array.from(segment.trim())
    while (rest.length > 90) {
      const candidate = rest.slice(0, 90).join('')
      const space = candidate.lastIndexOf(' ')
      const end = space > 35 ? Array.from(candidate.slice(0, space)).length : 90
      pieces.push(rest.slice(0, end).join('').trim())
      rest = rest.slice(end)
    }
    if (rest.join('').trim()) pieces.push(rest.join('').trim())
    return pieces
  })
}

/** Estimated allocation within measured audio, not forced alignment or word timestamps. */
export function createCaptionCues(beats: StoryBeat[], manifest: AudioManifest, fps = VIDEO_FPS): CaptionCue[] {
  if (beats.length !== manifest.scenes.length) throw new Error(`SRT generation: beat/scene count mismatch (${beats.length} beats vs ${manifest.scenes.length} audio scenes).`)
  const schedule = createFrameSchedule(manifest, fps)
  return beats.flatMap((beat, beatIndex) => {
    const timing = schedule.scenes[beatIndex]!
    const frames = timing.audioEndFrame - timing.audioStartFrame
    const segments = captionSegments(beat.summary)
    // At least one frame per cue, preserving every segment even for unrealistic short audio.
    while (segments.length > frames) segments.splice(segments.length - 2, 2, segments.slice(-2).join(' '))
    const weights = segments.map(text => Array.from(text).length)
    const total = weights.reduce((a, b) => a + b, 0)
    let consumed = 0
    let cursor = timing.audioStartFrame
    return segments.map((text, index) => {
      consumed += weights[index]!
      const endFrame = index === segments.length - 1 ? timing.audioEndFrame : Math.max(cursor + 1,
        Math.min(timing.audioEndFrame - (segments.length - index - 1), timing.audioStartFrame + Math.round(frames * consumed / total)))
      const cue = { beatIndex, text, startFrame: cursor, endFrame }
      cursor = endFrame
      return cue
    })
  })
}
