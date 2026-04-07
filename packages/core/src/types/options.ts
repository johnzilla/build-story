export interface ScanOptions {
  rootDir: string
  patterns?: string[]
  excludes?: string[]
  maxDepth?: number
}

export interface NarrateOptions {
  provider: 'anthropic' | 'openai'
  style: 'technical' | 'overview' | 'retrospective' | 'pitch' | 'story'
  apiKey: string
  maxInputTokens?: number
}
