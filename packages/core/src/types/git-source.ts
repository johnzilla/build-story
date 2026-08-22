/** A single file's change stats within a commit. */
export interface CommitFileChange {
  /** Repo-relative path (rename entries keep git's raw `old => new` form). */
  path: string
  insertions: number
  deletions: number
}

/** A normalized git commit record — the raw material for `git-commit` timeline events. */
export interface CommitRecord {
  /** Full commit hash. */
  hash: string
  /** Author date, strict ISO 8601. */
  date: string
  /** Author name. */
  author: string
  /** Commit subject (first line of the message). */
  subject: string
  /** Commit body (everything after the subject), may be empty. */
  body: string
  /** Per-file change stats from `--numstat`. */
  files: CommitFileChange[]
  /** Total insertions across all files. */
  insertions: number
  /** Total deletions across all files. */
  deletions: number
}

/** Options controlling which commits `getCommits` returns. */
export interface GetCommitsOptions {
  /** Cap the number of commits (most recent first). Adapters may apply a sane default. */
  max?: number
  /** Only commits more recent than this git-understood date/revision (`--since`). */
  since?: string
  /** Include merge commits (default: false — merges are usually noise for narration). */
  includeMerges?: boolean
  /** Restrict to commits touching these pathspecs. */
  paths?: string[]
}

export interface GitSource {
  /** Get the ISO date string of the most recent commit touching this file, or null if not in git */
  getFileDate(relativePath: string): Promise<string | null>
  /** Get all tags with their dates and messages */
  getTags(): Promise<Array<{ name: string; date: string; message: string }>>
  /**
   * Get commits as normalized records for the `git-commit` event source.
   *
   * Optional so existing GitSource implementations (and test doubles) remain
   * valid — `scan()` only collects commit events when this method is present.
   */
  getCommits?(options?: GetCommitsOptions): Promise<CommitRecord[]>
}
