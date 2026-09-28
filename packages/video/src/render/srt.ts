import { VIDEO_FPS } from '../timing.js'
import { createCaptionCues } from '../captions.js'
import { stringifySync } from 'subtitle'
import type { StoryBeat } from '@buildstory/core'
import { sanitizeOutboundValue } from '@buildstory/core'
import type { AudioManifest } from '../tts/types.js'

export function generateSRT(beats: StoryBeat[], manifest: AudioManifest, fps = VIDEO_FPS): string {
  const nodes = createCaptionCues(sanitizeOutboundValue(beats), manifest, fps).map(cue => ({
    type: 'cue' as const,
    data: { start: Math.round(cue.startFrame * 1000 / fps), end: Math.round(cue.endFrame * 1000 / fps), text: cue.text },
  }))
  return stringifySync(nodes, { format: 'SRT' })
}
