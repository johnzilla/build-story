import type { AudioManifest } from './tts/types.js'

export const VIDEO_FPS = 30
const AUDIO_LEAD_SECONDS = 0.2

export interface SceneFrames {
  beatIndex: number
  visualStartFrame: number
  audioStartFrame: number
  audioEndFrame: number
  endFrame: number
}
export interface FrameSchedule {
  fps: number
  scenes: SceneFrames[]
  durationInFrames: number
}

/** All ends are exclusive. Round each audio duration up so no sample is cut.
 * Visuals cover the whole timeline; cues cover only the narration interval.
 * Legacy second offsets/totals are derived data, never scheduling inputs. */
export function createFrameSchedule(
  manifest: Pick<AudioManifest, 'scenes' | 'silenceGapSeconds' | 'bookendSilenceSeconds'>,
  fps = VIDEO_FPS,
): FrameSchedule {
  if (!Number.isFinite(fps) || fps <= 0) throw new Error('Timing: fps must be positive and finite')
  const frames = (seconds: number, label: string): number => {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error(`Timing: ${label} must be nonnegative and finite`)
    // Suppress floating-point noise at exact frame boundaries, not real fractions.
    const value = seconds * fps
    const nearest = Math.round(value)
    const rounded = Math.abs(value - nearest) <= Number.EPSILON * Math.max(1, Math.abs(value)) * 4
      ? nearest : Math.ceil(value)
    if (!Number.isSafeInteger(rounded)) throw new Error(`Timing: ${label} exceeds the supported frame range`)
    return rounded
  }
  const gap = frames(manifest.silenceGapSeconds, 'silence gap')
  const bookend = frames(manifest.bookendSilenceSeconds, 'bookend')
  const lead = frames(AUDIO_LEAD_SECONDS, 'audio lead')
  let cursor = bookend
  const scenes = manifest.scenes.map((scene, i): SceneFrames => {
    if (scene.beatIndex !== i) throw new Error(`Timing: scene ${i} must have beatIndex ${i}`)
    if (scene.durationSeconds <= 0) throw new Error(`Timing: scene ${i} audio duration must be positive`)
    const duration = frames(scene.durationSeconds, `scene ${i} audio duration`)
    const visualStartFrame = i === 0 ? 0 : cursor
    const audioStartFrame = cursor + lead
    const audioEndFrame = audioStartFrame + duration
    const endFrame = audioEndFrame + (i === manifest.scenes.length - 1 ? bookend : gap)
    if (!Number.isSafeInteger(endFrame)) throw new Error('Timing: total duration exceeds the supported frame range')
    cursor = endFrame
    return { beatIndex: i, visualStartFrame, audioStartFrame, audioEndFrame, endFrame }
  })
  return { fps, scenes, durationInFrames: scenes.length ? cursor : Math.max(1, bookend * 2) }
}
