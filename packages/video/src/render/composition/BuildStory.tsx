import { createCaptionCues } from '../../captions.js'
import { Presentation } from './Presentation.js'
import { EvidenceCard } from './scenes/EvidenceCard.js'
import { evidenceForBeat, sourceCaption } from './evidence.js'
import { createFrameSchedule } from '../../timing.js'
import React from 'react'
import { AbsoluteFill, Sequence, Audio } from 'remotion'
import type { BuildStoryInputProps, BeatWithFrames } from './types.js'
import type { BeatType } from '@buildstory/core'
import { TitleCard } from './scenes/TitleCard.js'
import { TimelineBar } from './scenes/TimelineBar.js'
import { DecisionCallout } from './scenes/DecisionCallout.js'
import { StatsCard } from './scenes/StatsCard.js'

// D-09: Beat type → scene component mapping
// TitleCard: first/last beats (inserted by composition logic, not beat type)
// TimelineBar: idea, goal, attempt, result, side_quest, open_loop (+ fallback for unmapped)
// DecisionCallout: obstacle, pivot, decision
// StatsCard: inserted as second-to-last before closing title
const DECISION_TYPES: Set<BeatType> = new Set(['obstacle', 'pivot', 'decision'])

function SceneForBeat({ beat, isFirst, isLast, isStats, context }: {
  context?: string
  beat: BeatWithFrames
  isFirst: boolean
  isLast: boolean
  isStats: boolean
}): React.ReactElement {
  if (isFirst || isLast) return <TitleCard beat={beat} isClosing={isLast && !isFirst} {...(context ? { context } : {})} />
  if (isStats) return <StatsCard beat={beat} />
  if (DECISION_TYPES.has(beat.type)) return <DecisionCallout beat={beat} />
  return <TimelineBar beat={beat} />
}

export const BuildStoryComposition: React.FC<BuildStoryInputProps> = ({
  storyArc,
  audioManifest,
  fps,
  captions = true,
  showTitleCard = true,
  showStatsCard = true,
}) => {
  if (storyArc.beats.length !== audioManifest.scenes.length) {
    throw new Error('Timing: beat/scene count mismatch')
  }
  const cues = captions ? createCaptionCues(storyArc.beats, audioManifest, fps) : []
  const schedule = createFrameSchedule(audioManifest, fps)
  const beatsWithFrames: BeatWithFrames[] = storyArc.beats.map((beat, i) => {
    const timing = schedule.scenes[i]!
    return { ...beat, durationInFrames: timing.endFrame - timing.visualStartFrame }
  })

  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1a2e' }}>
      {beatsWithFrames.map((beat, i) => {
        const timing = schedule.scenes[i]!
        const startFrame = timing.visualStartFrame
        const frames = beat.durationInFrames
        // Cards are toggleable (--no-title-card / --no-stats-card / [render]
        // config). When off, these beats render with their natural scene type.
        const isFirst = showTitleCard && i === 0
        const isLast = showTitleCard && i === beatsWithFrames.length - 1
        const isStats = showStatsCard && i === beatsWithFrames.length - 2

        const review = storyArc.metadata.review?.beats.find(entry => entry.beatIndex === i)
        const visual = evidenceForBeat(beat, review)
        return (
          <Sequence key={`beat-${i}`} from={startFrame} durationInFrames={frames}>
            <Presentation chapter={`${String(i + 1).padStart(2, '0')} / ${beatsWithFrames.length} · ${beat.chapter ?? beat.type.replace('_', ' ')}`} captions={cues.filter(cue => cue.beatIndex === i)} startFrame={startFrame}>
            {visual ? <EvidenceCard beat={beat} visual={visual} citations={visual.panels.map(panel => sourceCaption(panel.sourceEventId, review, panel.text))} /> : <SceneForBeat beat={beat} isFirst={isFirst} isLast={isLast} isStats={isStats} {...(isFirst && storyArc.metadata.editorial?.centralQuestion ? { context: storyArc.metadata.editorial.centralQuestion } : isLast && storyArc.beats.some(b => b.type === 'open_loop') ? { context: 'Open questions remain in this story.' } : {})} />}
            </Presentation>
            {audioManifest.scenes[i] && (
              <Sequence from={timing.audioStartFrame - startFrame} durationInFrames={timing.audioEndFrame - timing.audioStartFrame}>
                <Audio src={audioManifest.scenes[i]!.filePath} />
              </Sequence>
            )}
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
