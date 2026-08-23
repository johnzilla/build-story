import { describe, it, expect } from 'vitest'
import type { StoryBeat } from '@buildstory/core'
import { generateSRT } from '../srt.js'
import type { SceneAudio } from '../../tts/types.js'

const beat = (summary: string): StoryBeat => ({
  type: 'idea',
  title: 't',
  summary,
  evidence: [],
  sourceEventIds: [],
  significance: 2,
})

const scene = (i: number, start: number, dur: number): SceneAudio => ({
  beatIndex: i,
  filePath: `/audio/scene-${i}.wav`,
  durationSeconds: dur,
  startOffsetSeconds: start,
})

describe('generateSRT', () => {
  it('emits one cue per beat with start/end from scene offsets', () => {
    const srt = generateSRT([beat('Hello'), beat('World')], [scene(0, 1, 2), scene(1, 3, 2)])
    expect(srt).toContain('Hello')
    expect(srt).toContain('World')
    // Two cues, numbered 1 and 2
    expect(srt).toMatch(/^1\s/m)
    expect(srt).toMatch(/^2\s/m)
  })

  it('throws a clear error on beat/scene count mismatch instead of crashing', () => {
    expect(() => generateSRT([beat('a'), beat('b')], [scene(0, 1, 2)])).toThrow(
      /beat\/scene count mismatch \(2 beats vs 1 audio scenes\)/,
    )
  })
})
