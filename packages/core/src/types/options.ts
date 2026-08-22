/** Controls the `git-commit` event source (see `scan`). */
export interface ScanCommitOptions {
  /** Collect commit events. Default: true (when the GitSource supports it). */
  enabled?: boolean
  /** Cap the number of commits pulled (most recent first). */
  max?: number
  /** Only commits more recent than this git-understood date/revision (`--since`). */
  since?: string
  /** Include merge commits (default: false). */
  includeMerges?: boolean
  /** Restrict to commits touching these pathspecs. */
  paths?: string[]
}

/** Controls the transcript event source (see `scan`). */
export interface ScanTranscriptOptions {
  /**
   * Collect agent session transcripts as events. Default: false — transcripts
   * can contain secrets and dead-ends, so they are opt-in.
   */
  enabled?: boolean
  /** Only sessions started at/after this ISO date. */
  since?: string
  /** Only sessions started at/before this ISO date. */
  until?: string
  /**
   * Attach session reasoning to the commits it produced (by timestamp), so each
   * commit event carries its "why". Default: true (when transcripts are on).
   */
  correlate?: boolean
}

export interface ScanOptions {
  rootDir: string
  patterns?: string[]
  excludes?: string[]
  maxDepth?: number
  /** Scan planning-artifact files. Default: true. Set false for a commit-only timeline. */
  includeFiles?: boolean
  /** Configure the git-commit event source. */
  commits?: ScanCommitOptions
  /** Configure the agent-transcript event source (requires an injected TranscriptSource). */
  transcripts?: ScanTranscriptOptions
}

export interface NarrateOptions {
  provider: 'anthropic' | 'openai'
  style: 'technical' | 'overview' | 'retrospective' | 'pitch' | 'story'
  apiKey: string
  maxInputTokens?: number
}
