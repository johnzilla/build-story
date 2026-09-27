import type { SpendBudget } from '@buildstory/core'
import type { TTSModel } from './pricing.js'

export interface TTSOptions {
  budget?: SpendBudget
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
  /** Derived narration start on the default video frame schedule. */
  startOffsetSeconds: number
}

export interface AudioManifest {
  scenes: SceneAudio[]
  /** Derived frame-aligned total, including audio lead, gaps, and bookends. */
  totalDurationSeconds: number
  silenceGapSeconds: number
  bookendSilenceSeconds: number
}

export interface TTSCostEstimate {
  totalCharacters: number
  estimatedCostUSD: number
  sceneCount: number
}
