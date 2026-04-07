export interface TTSOptions {
  voice: string
  speed: number
  apiKey: string
  concurrency: number
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
