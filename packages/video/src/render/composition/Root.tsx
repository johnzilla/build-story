import { createFrameSchedule, VIDEO_FPS } from '../../timing.js'
import React from 'react'
import { Composition } from 'remotion'
import { BuildStoryComposition } from './BuildStory.js'
import type { BuildStoryInputProps } from './types.js'

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="BuildStory"
      component={BuildStoryComposition}
      fps={VIDEO_FPS}
      width={1920}
      height={1080}
      durationInFrames={300}
      defaultProps={{
        storyArc: { version: '1', beats: [], metadata: { generatedAt: '', style: '', sourceTimeline: '' } },
        audioManifest: { scenes: [], totalDurationSeconds: 10, silenceGapSeconds: 0.3, bookendSilenceSeconds: 1 },
        fps: VIDEO_FPS,
        showTitleCard: true,
        showStatsCard: true,
      } satisfies BuildStoryInputProps}
      calculateMetadata={async ({ props }) => {
        const totalFrames = createFrameSchedule(props.audioManifest, props.fps).durationInFrames
        return { durationInFrames: totalFrames, fps: props.fps }
      }}
    />
  )
}
