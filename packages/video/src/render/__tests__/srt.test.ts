import { describe, it, expect } from 'vitest'
import type { StoryBeat } from '@buildstory/core'
import { generateSRT } from '../srt.js'
import type { SceneAudio, AudioManifest } from '../../tts/types.js'

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

const manifest = (scenes: SceneAudio[]): AudioManifest => ({
  scenes, totalDurationSeconds: 999, silenceGapSeconds: 0.3, bookendSilenceSeconds: 1,
})

describe('generateSRT', () => {
  it('emits cues aligned to frame-scheduled audio, including the lead', () => {
    const srt = generateSRT([beat('Hello'), beat('World')], manifest([scene(0, 1, 2), scene(1, 3, 2)]))
    expect(srt).toContain('Hello')
    expect(srt).toContain('World')
    expect(srt).toContain('00:00:01,200 --> 00:00:03,200')
    expect(srt).toContain('00:00:03,700 --> 00:00:05,700')
    // Two cues, numbered 1 and 2
    expect(srt).toMatch(/^1\s/m)
    expect(srt).toMatch(/^2\s/m)
  })

  it('throws a clear error on beat/scene count mismatch instead of crashing', () => {
    expect(() => generateSRT([beat('a'), beat('b')], manifest([scene(0, 1, 2)]))).toThrow(
      /beat\/scene count mismatch \(2 beats vs 1 audio scenes\)/,
    )
  })
})
