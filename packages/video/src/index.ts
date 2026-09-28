export { orchestrateTTS, estimateTTSCost } from './tts/index.js'
export { prepareSpeechText, prepareSpeechChunks } from './tts/generate.js'
export { preflightCheck } from './preflight.js'
export { renderVideo } from './render/index.js'
export { generateSRT } from './render/srt.js'
export {
  TTS_PRICE_PER_1000_CHARS,
  DEFAULT_TTS_MODEL,
  ttsCostUSD,
  type TTSModel,
} from './tts/pricing.js'
export type { PreflightResult } from './preflight.js'
export type { RenderProgress, RenderOptions } from './render/index.js'
export type { TTSOptions, SceneAudio, AudioManifest, TTSCostEstimate } from './tts/types.js'
export type { BuildStoryInputProps, BeatWithFrames } from './render/composition/types.js'

export { createFrameSchedule, VIDEO_FPS } from './timing.js'
export type { FrameSchedule, SceneFrames } from './timing.js'

export { createCaptionCues, captionSegments } from './captions.js'
export type { CaptionCue } from './captions.js'

export { inspectSpeechCache } from './tts/inspect.js'
export type { SpeechCacheScene } from './tts/inspect.js'
export { renderStoryboardStills } from './render/storyboard.js'
