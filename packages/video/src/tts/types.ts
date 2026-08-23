import type { TTSModel } from './pricing.js'

export interface TTSOptions {
  voice: string
  speed: number
  apiKey: string
  concurrency: number
  /** OpenAI TTS model. Defaults to DEFAULT_TTS_MODEL when omitted. */
  model?: TTSModel
}

export interface SceneAudio {
  beatIndex: number
  filePath: string
  durationSeconds: number
  startOffsetSeconds: number
}

export interface AudioManifest {
  scenes: SceneAudio[]
  totalDurationSeconds: number
  silenceGapSeconds: number
  bookendSilenceSeconds: number
}

export interface TTSCostEstimate {
  totalCharacters: number
  estimatedCostUSD: number
  sceneCount: number
}
