import type { TimelineEvent } from '../types/timeline.js'
import type { TranscriptSession } from '../types/transcript.js'

/**
 * Link agent-session reasoning to the commits it produced, by timestamp.
 *
 * For each commit, the human asks recorded in the window leading up to it
 * (since the previous commit, bounded by a max look-back) are the reasoning that
 * most likely drove that change. We append them to the commit event's `summary`
 * (the LLM-visible field) as a concise "why", so the narrator gets the link
 * explicitly instead of inferring it from a shared timeline.
 *
 * Heuristic and non-destructive: it only enriches `git-commit` events that have
 * asks in-window; everything else is returned unchanged. Correlation by
 * timestamp can misattribute (a commit may implement something discussed
 * earlier) — it's an enrichment, not ground truth.
 */

export interface CorrelateOptions {
  /** How far before a commit to reach for asks, in hours (default 24). */
  maxLookbackHours?: number
  /** Max asks quoted per commit (default 3, the ones closest to the commit). */
  maxAsksPerCommit?: number
  /** Max characters kept per quoted ask (default 200). */
  maxCharsPerAsk?: number
}

interface Ask {
  ms: number
  text: string
  sessionId: string
}

const HOUR_MS = 3_600_000

function truncate(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length <= max ? t : `${t.slice(0, max).trimEnd()}…`
}

export function correlateCommitsWithTranscripts(
  commitEvents: TimelineEvent[],
  sessions: TranscriptSession[],
  options: CorrelateOptions = {},
): TimelineEvent[] {
  const maxLookbackMs = (options.maxLookbackHours ?? 24) * HOUR_MS
  const maxAsks = options.maxAsksPerCommit ?? 3
  const maxChars = options.maxCharsPerAsk ?? 200

  // Collect human asks (user message turns) that carry a parseable timestamp.
  const asks: Ask[] = []
  for (const session of sessions) {
    for (const turn of session.turns) {
      if (turn.role !== 'user' || turn.kind !== 'message' || turn.timestamp === undefined) continue
      const ms = Date.parse(turn.timestamp)
      if (Number.isNaN(ms)) continue
      asks.push({ ms, text: turn.text, sessionId: session.id })
    }
  }
  if (asks.length === 0) return commitEvents
  asks.sort((a, b) => a.ms - b.ms)

  // Commits in chronological order, remembering their position in the input.
  // Only `git-commit` events are enriched; anything else passes through.
  const commits = commitEvents
    .map((event, index) => ({ event, index, ms: Date.parse(event.date) }))
    .filter((c) => c.event.source === 'git-commit' && !Number.isNaN(c.ms))
    .sort((a, b) => a.ms - b.ms)

  const enrichedByIndex = new Map<number, TimelineEvent>()
  let prevMs = -Infinity

  for (const commit of commits) {
    const lower = Math.max(prevMs, commit.ms - maxLookbackMs)
    const windowAsks = asks.filter((a) => a.ms > lower && a.ms <= commit.ms)
    prevMs = commit.ms
    if (windowAsks.length === 0) continue

    const chosen = windowAsks.slice(-maxAsks) // asks closest to the commit
    const lines = chosen.map((a, i) => `${i + 1}. ${truncate(a.text, maxChars)}`)
    const sessionIds = [...new Set(windowAsks.map((a) => a.sessionId))]

    enrichedByIndex.set(commit.index, {
      ...commit.event,
      summary: `${commit.event.summary}\n\nWhy (from agent session), the developer asked:\n${lines.join('\n')}`,
      metadata: {
        ...commit.event.metadata,
        sourceSessionIds: sessionIds,
        correlatedAsks: windowAsks.length,
      },
    })
  }

  if (enrichedByIndex.size === 0) return commitEvents
  return commitEvents.map((event, index) => enrichedByIndex.get(index) ?? event)
}
