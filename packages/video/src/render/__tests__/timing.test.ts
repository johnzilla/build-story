import { describe, expect, it } from 'vitest'
import { Children, isValidElement, type ReactNode } from 'react'
import { createFrameSchedule } from '../../timing.js'
import type { AudioManifest } from '../../tts/types.js'
import { BuildStoryComposition } from '../composition/BuildStory.js'
import { RemotionRoot } from '../composition/Root.js'
import type { BuildStoryInputProps } from '../composition/types.js'
import { generateSRT } from '../srt.js'

function manifest(durations: number[], gap = 0.3, bookend = 1): AudioManifest {
  return {
    scenes: durations.map((durationSeconds, beatIndex) => ({ beatIndex, durationSeconds, filePath: `/audio/${beatIndex}.wav`, startOffsetSeconds: 999 })),
    totalDurationSeconds: 999, silenceGapSeconds: gap, bookendSilenceSeconds: bookend,
  }
}
function propsOf(node: ReactNode): Record<string, unknown> {
  if (!isValidElement<Record<string, unknown>>(node)) throw new Error('Expected element')
  return node.props
}

describe('shared frame schedule', () => {
  it('includes narration lead and opening/closing bookends without unmounted visual gaps', () => {
    expect(createFrameSchedule(manifest([1, 1.01]))).toEqual({
      fps: 30, durationInFrames: 142,
      scenes: [
        { beatIndex: 0, visualStartFrame: 0, audioStartFrame: 36, audioEndFrame: 66, endFrame: 75 },
        { beatIndex: 1, visualStartFrame: 75, audioStartFrame: 81, audioEndFrame: 112, endFrame: 142 },
      ],
    })
  })

  it.each([24, 30, 60])('keeps 200 fractional scenes and the final narration inside the composition at %i fps', (fps) => {
    const input = manifest(Array.from({ length: 200 }, (_, i) => 0.101 + (i % 7) / 100), 0.013, 0.017)
    const schedule = createFrameSchedule(input, fps)
    schedule.scenes.forEach((scene, i) => {
      expect(Number.isInteger(scene.audioStartFrame)).toBe(true)
      expect(scene.audioEndFrame - scene.audioStartFrame).toBeGreaterThanOrEqual(input.scenes[i]!.durationSeconds * fps)
      expect(scene.audioStartFrame).toBeGreaterThanOrEqual(scene.visualStartFrame)
      expect(scene.audioEndFrame).toBeLessThanOrEqual(scene.endFrame)
      expect(scene.visualStartFrame).toBe(i ? schedule.scenes[i - 1]!.endFrame : 0)
    })
    expect(schedule.durationInFrames).toBe(schedule.scenes.at(-1)!.endFrame)
  })

  it('does not add a rounding frame to exact frame durations', () => {
    const schedule = createFrameSchedule(manifest([2.1], 0, 0), 30)
    expect(schedule.scenes[0]!.audioEndFrame - schedule.scenes[0]!.audioStartFrame).toBe(63)
  })

  it('allows zero gaps and bookends without clipping short audio', () => {
    const schedule = createFrameSchedule(manifest([0.001, 0.001], 0, 0))
    expect(schedule.durationInFrames).toBe(14)
    expect(schedule.scenes[1]!.audioEndFrame).toBe(14)
  })

  it('defines a finite empty composition', () => {
    expect(createFrameSchedule(manifest([])).durationInFrames).toBe(60)
    expect(createFrameSchedule(manifest([], 0, 0)).durationInFrames).toBe(1)
  })

  it.each([NaN, Infinity, -1, 0])('rejects invalid audio duration %s', (duration) => {
    expect(() => createFrameSchedule(manifest([duration]))).toThrow('Timing:')
  })

  it('rejects invalid fps, padding, and out-of-order scene identity', () => {
    expect(() => createFrameSchedule(manifest([1]), 0)).toThrow('fps')
    expect(() => createFrameSchedule(manifest([1], -1))).toThrow('silence gap')
    const input = manifest([1, 1])
    input.scenes.reverse()
    expect(() => createFrameSchedule(input)).toThrow('beatIndex')
  })

  it('uses identical boundaries in composition sequences, metadata, and SRT with cards on or off', async () => {
    const audioManifest = manifest([1, 1.01])
    const props: BuildStoryInputProps = {
      fps: 30, audioManifest,
      storyArc: { version: '1', metadata: { generatedAt: '', style: 'story', sourceTimeline: 'test' },
        beats: [0, 1].map((i) => ({ type: 'decision', title: `Beat ${i}`, summary: `Narration ${i}`, significance: 2, evidence: [], sourceEventIds: [] })) },
    }
    const schedule = createFrameSchedule(audioManifest)
    for (const cards of [true, false]) {
      const tree = BuildStoryComposition({ ...props, showTitleCard: cards, showStatsCard: cards }) as ReactNode
      const sequences = Children.toArray(propsOf(tree).children as ReactNode)
      sequences.forEach((sequence, i) => {
        const timing = schedule.scenes[i]!
        const outer = propsOf(sequence)
        expect(outer.from).toBe(timing.visualStartFrame)
        expect(outer.durationInFrames).toBe(timing.endFrame - timing.visualStartFrame)
        const audioSequence = propsOf(Children.toArray(outer.children as ReactNode)[1])
        expect(Number(outer.from) + Number(audioSequence.from)).toBe(timing.audioStartFrame)
        expect(Number(audioSequence.durationInFrames)).toBe(timing.audioEndFrame - timing.audioStartFrame)
      })
    }
    const metadata = propsOf(RemotionRoot({}) as ReactNode).calculateMetadata as (input: { props: BuildStoryInputProps }) => Promise<{ durationInFrames: number }>
    expect((await metadata({ props })).durationInFrames).toBe(142)
    const srt = generateSRT(props.storyArc.beats, audioManifest)
    expect(srt).toContain('00:00:01,200 --> 00:00:02,200')
    expect(srt).toContain('00:00:02,700 --> 00:00:03,733')
  })
})
