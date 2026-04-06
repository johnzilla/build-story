import type { Timeline, TimelineEvent } from '../types/timeline.js'
import { buildTimelinePayload } from './tokens.js'

/**
 * Regex to extract phase prefix from a timeline event path.
 * Matches paths like: .planning/phases/01-scaffold/01-01-PLAN.md
 * Captures: "01-scaffold"
 */
const PHASE_REGEX = /phases\/(\d+-[^/]+)/

/**
 * Group timeline events by their GSD phase prefix.
 * Events with no path or no matching phase prefix go into the "ungrouped" key.
 * Per D-06: chunk by GSD phase boundaries.
 *
 * @param events - Array of TimelineEvent objects to group
 * @returns Map from phase name (e.g. "01-scaffold") or "ungrouped" to events
 */
export function groupByPhase(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const groups = new Map<string, TimelineEvent[]>()

  for (const event of events) {
    let key = 'ungrouped'
    if (event.path !== undefined && event.path !== null) {
      const match = PHASE_REGEX.exec(event.path)
      if (match !== null && match[1] !== undefined) {
        key = match[1]
      }
    }

    const existing = groups.get(key)
    if (existing !== undefined) {
      existing.push(event)
    } else {
      groups.set(key, [event])
    }
  }

  return groups
}

/**
 * Compute dateRange from a set of events.
 * Returns empty strings if no events have dates.
 */
function computeDateRange(events: TimelineEvent[]): { start: string; end: string } {
  if (events.length === 0) {
    return { start: '', end: '' }
  }
  const dates = events.map((e) => e.date).filter((d) => d !== '')
  if (dates.length === 0) {
    return { start: '', end: '' }
  }
  const sorted = [...dates].sort()
  return { start: sorted[0] ?? '', end: sorted[sorted.length - 1] ?? '' }
}

/**
 * Split a Timeline into chunks that each fit within maxInputTokens.
 * Uses phase-boundary grouping (groupByPhase) as the splitting strategy.
 * Per D-06.
 *
 * If the entire timeline fits, returns [timeline] unchanged.
 * If chunking is needed, creates separate Timeline objects per phase group,
 * each sharing the original's version/rootDir/scannedAt with a recomputed dateRange.
 *
 * @param timeline - The full Timeline to potentially split
 * @param maxInputTokens - Maximum token budget per chunk
 * @returns Array of Timeline chunks, each fitting within maxInputTokens
 */
export function chunkTimeline(timeline: Timeline, maxInputTokens: number): Timeline[] {
  const payload = buildTimelinePayload(timeline)
  const estimatedTokens = Math.ceil(payload.length / 4)

  // If it fits, return as-is
  if (estimatedTokens <= maxInputTokens) {
    return [timeline]
  }

  // Split by phase boundaries
  const groups = groupByPhase(timeline.events)
  const chunks: Timeline[] = []

  for (const [, events] of groups) {
    const chunk: Timeline = {
      version: timeline.version,
      rootDir: timeline.rootDir,
      scannedAt: timeline.scannedAt,
      dateRange: computeDateRange(events),
      events,
    }
    chunks.push(chunk)
  }

  // If somehow only one group (e.g. all ungrouped), still return it split
  if (chunks.length === 0) {
    return [timeline]
  }

  return chunks
}
