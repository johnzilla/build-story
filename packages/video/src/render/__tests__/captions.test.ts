import { it, expect } from 'vitest'
import type { StoryBeat } from '@buildstory/core'
import { captionSegments, createCaptionCues } from '../../captions.js'
import { createFrameSchedule } from '../../timing.js'
const beat = (summary: string): StoryBeat => ({ type: 'idea', title: '', summary, evidence: [], sourceEventIds: [], significance: 2 })
const manifest = { scenes: [{ beatIndex: 0, durationSeconds: 5.13, filePath: '', startOffsetSeconds: 0 }], totalDurationSeconds: 0, silenceGapSeconds: 0.3, bookendSilenceSeconds: 1 }
it('splits sentences, preserves all words, and shares measured scene boundaries', () => {
  const text = 'First sentence. Another sentence explains the decision! What remains unresolved?'
  const cues = createCaptionCues([beat(text)], manifest)
  const timing = createFrameSchedule(manifest).scenes[0]!
  expect(cues).toHaveLength(3)
  expect(cues.map(c => c.text).join(' ')).toBe(text)
  expect(cues[0]?.startFrame).toBe(timing.audioStartFrame)
  expect(cues.at(-1)?.endFrame).toBe(timing.audioEndFrame)
  cues.forEach((cue, i) => { expect(cue.endFrame).toBeGreaterThan(cue.startFrame); if (i) expect(cue.startFrame).toBe(cues[i - 1]?.endFrame) })
})
it('bounds unspaced Unicode text without breaking surrogate pairs', () => {
  const text = '界😀'.repeat(110)
  const segments = captionSegments(text)
  expect(segments.join('')).toBe(text)
  expect(segments.every(segment => Array.from(segment).length <= 90)).toBe(true)
})
it('merges tiny-duration cues rather than emitting zero or negative duration', () => {
  const tiny = { ...manifest, scenes: [{ ...manifest.scenes[0]!, durationSeconds: 0.001 }] }
  const cues = createCaptionCues([beat('One. Two. Three.')], tiny)
  expect(cues).toHaveLength(1)
  expect(cues[0]?.text).toBe('One. Two. Three.')
  expect(cues[0]!.endFrame - cues[0]!.startFrame).toBe(1)
})
