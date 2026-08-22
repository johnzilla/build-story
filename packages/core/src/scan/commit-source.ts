import type { TimelineEvent } from '../types/timeline.js'
import type { CommitRecord } from '../types/git-source.js'
import { generateEventId } from './timeline-builder.js'

/**
 * Build `git-commit` timeline events from normalized commit records.
 *
 * The narration LLM only ever sees an event's `summary` and `metadata`
 * (`buildTimelinePayload` strips `rawContent` to avoid leaking file contents),
 * so the narrative substance of a commit — message, body, and which files
 * changed — must live in `summary`. `rawContent` keeps the full record for
 * provenance and downstream formatting.
 */

/** Max files listed inline in an event summary before collapsing to a count. */
const MAX_FILES_IN_SUMMARY = 12
/** Max commit-body characters kept in the summary (full body stays in rawContent). */
const MAX_BODY_CHARS = 600

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max).trimEnd()}…`
}

function buildCommitSummary(commit: CommitRecord): string {
  const parts: string[] = [commit.subject.trim()]

  const body = commit.body.trim()
  if (body.length > 0) {
    parts.push(truncate(body, MAX_BODY_CHARS))
  }

  if (commit.files.length > 0) {
    const shown = commit.files
      .slice(0, MAX_FILES_IN_SUMMARY)
      .map((f) => `${f.path} (+${f.insertions}/-${f.deletions})`)
    const remaining = commit.files.length - shown.length
    const suffix = remaining > 0 ? `, +${remaining} more` : ''
    parts.push(`Files changed (${commit.files.length}): ${shown.join(', ')}${suffix}`)
  }

  return parts.join('\n\n')
}

function buildCommitRawContent(commit: CommitRecord): string {
  const message = [commit.subject.trim(), commit.body.trim()].filter(Boolean).join('\n\n')
  const stats = commit.files.map((f) => `${f.insertions}\t${f.deletions}\t${f.path}`).join('\n')
  return [message, stats].filter(Boolean).join('\n\n')
}

/**
 * Map commit records to fully-formed timeline events.
 *
 * IDs are pre-assigned (keyed on the commit hash) so two commits sharing a
 * date never collide — `buildTimeline` preserves an event's existing id.
 */
export function buildCommitEvents(commits: CommitRecord[]): TimelineEvent[] {
  return commits
    .filter((commit) => commit.hash !== '')
    .map((commit) => ({
      id: generateEventId('git-commit', commit.hash, commit.date),
      date: commit.date,
      source: 'git-commit' as const,
      summary: buildCommitSummary(commit),
      metadata: {
        hash: commit.hash,
        shortHash: commit.hash.slice(0, 8),
        author: commit.author,
        filesChanged: commit.files.length,
        insertions: commit.insertions,
        deletions: commit.deletions,
      },
      dateConfidence: 'exact' as const,
      rawContent: buildCommitRawContent(commit),
      artifactType: 'git-commit' as const,
      crossRefs: [],
    }))
}
