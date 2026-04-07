import type { StoryBeat, StoryArc } from '@buildstory/core'
import type { AudioManifest } from '../../tts/types.js'

export interface BeatWithFrames extends StoryBeat {
  durationInFrames: number
}

export interface BuildStoryInputProps {
  storyArc: StoryArc
  audioManifest: AudioManifest
  fps: number
}
