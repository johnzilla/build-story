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

export interface ScanOptions {
  rootDir: string
  patterns?: string[]
  excludes?: string[]
  maxDepth?: number
  /** Scan planning-artifact files. Default: true. Set false for a commit-only timeline. */
  includeFiles?: boolean
  /** Configure the git-commit event source. */
  commits?: ScanCommitOptions
}

export interface NarrateOptions {
  provider: 'anthropic' | 'openai'
  style: 'technical' | 'overview' | 'retrospective' | 'pitch' | 'story'
  apiKey: string
  maxInputTokens?: number
}
