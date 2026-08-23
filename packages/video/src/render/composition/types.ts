import type { StoryBeat, StoryArc } from '@buildstory/core'
import type { AudioManifest } from '../../tts/types.js'

export interface BeatWithFrames extends StoryBeat {
  durationInFrames: number
}

// A `type` (not `interface`) so it satisfies Remotion's `Record<string, unknown>`
// props constraint — interfaces lack the implicit index signature it needs.
export type BuildStoryInputProps = {
  storyArc: StoryArc
  audioManifest: AudioManifest
  fps: number
  /** Render first/last beats as title cards. Default true. */
  showTitleCard?: boolean
  /** Render the second-to-last beat as a stats card. Default true. */
  showStatsCard?: boolean
}
