import React from 'react'
import { AbsoluteFill, Sequence, Audio } from 'remotion'
import type { BuildStoryInputProps, BeatWithFrames } from './types'
import type { BeatType } from '@buildstory/core'
import { TitleCard } from './scenes/TitleCard'
import { TimelineBar } from './scenes/TimelineBar'
import { DecisionCallout } from './scenes/DecisionCallout'
import { StatsCard } from './scenes/StatsCard'

// D-09: Beat type → scene component mapping
// TitleCard: first/last beats (inserted by composition logic, not beat type)
// TimelineBar: idea, goal, attempt, result, side_quest, open_loop (+ fallback for unmapped)
// DecisionCallout: obstacle, pivot, decision
// StatsCard: inserted as second-to-last before closing title
const DECISION_TYPES: Set<BeatType> = new Set(['obstacle', 'pivot', 'decision'])

function SceneForBeat({ beat, isFirst, isLast, isStats }: {
  beat: BeatWithFrames
  isFirst: boolean
  isLast: boolean
  isStats: boolean
}): React.ReactElement {
  if (isFirst || isLast) return <TitleCard beat={beat} isClosing={isLast} />
  if (isStats) return <StatsCard beat={beat} />
  if (DECISION_TYPES.has(beat.type)) return <DecisionCallout beat={beat} />
  return <TimelineBar beat={beat} />
}

export const BuildStoryComposition: React.FC<BuildStoryInputProps> = ({
  storyArc,
  audioManifest,
  fps,
}) => {
  // Convert beats to BeatWithFrames using audio manifest durations
  const beatsWithFrames: BeatWithFrames[] = storyArc.beats.map((beat, i) => {
    const scene = audioManifest.scenes[i]
    const durationSeconds = scene?.durationSeconds ?? (beat.duration_seconds ?? 5)
    // Add silence gap to frame duration (except last beat gets bookend instead)
    const gapSeconds = i < storyArc.beats.length - 1
      ? audioManifest.silenceGapSeconds
      : audioManifest.bookendSilenceSeconds
    return {
      ...beat,
      durationInFrames: Math.ceil((durationSeconds + gapSeconds) * fps),
    }
  })

  let cumulativeFrame = Math.ceil(audioManifest.bookendSilenceSeconds * fps) // 1s bookend at start

  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1a2e' }}>
      {beatsWithFrames.map((beat, i) => {
        const startFrame = cumulativeFrame
        const frames = beat.durationInFrames
        cumulativeFrame += frames
        const isFirst = i === 0
        const isLast = i === beatsWithFrames.length - 1
        const isStats = i === beatsWithFrames.length - 2

        return (
          <Sequence key={`beat-${i}`} from={startFrame} durationInFrames={frames}>
            <SceneForBeat beat={beat} isFirst={isFirst} isLast={isLast} isStats={isStats} />
            {audioManifest.scenes[i] && (
              <Audio src={audioManifest.scenes[i]!.filePath} />
            )}
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
