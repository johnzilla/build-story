import type { Timeline, TimelineEvent } from '../types/timeline.js'
import { buildTimelinePayload } from './tokens.js'

/**
 * Serialized character length of a single event as buildTimelinePayload emits it
 * (rawContent excluded). Used to pack events into size-bounded sub-chunks without
 * rebuilding the whole payload for every candidate.
 */
function eventChars(event: TimelineEvent): number {
  const { rawContent: _rawContent, ...rest } = event
  return JSON.stringify(rest).length
}

/**
 * Split a list of events into sub-groups whose serialized payload each fits
 * within maxInputTokens. Preserves order. A single event larger than the budget
 * is emitted alone (guardTokens will then raise a real, non-spurious error).
 *
 * Char budget: estimateTokens = ceil(len / 4), so len ≤ maxInputTokens * 4 keeps
 * a chunk within the token limit. Payload length for N events is
 * wrapperChars + Σ eventChars + (N − 1) separators, computed exactly here.
 */
function splitEventsToBudget(
  events: TimelineEvent[],
  wrapperChars: number,
  maxInputTokens: number,
): TimelineEvent[][] {
  const budget = maxInputTokens * 4
  const groups: TimelineEvent[][] = []
  let current: TimelineEvent[] = []
  let currentChars = wrapperChars

  for (const event of events) {
    const addChars = eventChars(event) + (current.length > 0 ? 1 : 0) // +1 comma separator
    if (current.length > 0 && currentChars + addChars > budget) {
      groups.push(current)
      current = []
      currentChars = wrapperChars
    }
    current.push(event)
    currentChars += current.length > 1 ? eventChars(event) + 1 : eventChars(event)
  }
  if (current.length > 0) groups.push(current)
  return groups
}

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

  // Split by phase boundaries first (GSD workflow), then size-bound each group.
  // Commit-heavy timelines have no phase paths, so all commits land in one
  // "ungrouped" group — without the size split below, that single group would
  // stay over budget and guardTokens would throw spuriously. The size split
  // packs those events into as many sub-chunks as the budget requires.
  const groups = groupByPhase(timeline.events)
  const wrapperChars = buildTimelinePayload({ ...timeline, events: [] }).length
  const chunks: Timeline[] = []

  for (const [, events] of groups) {
    for (const subEvents of splitEventsToBudget(events, wrapperChars, maxInputTokens)) {
      chunks.push({
        version: timeline.version,
        rootDir: timeline.rootDir,
        scannedAt: timeline.scannedAt,
        dateRange: computeDateRange(subEvents),
        events: subEvents,
      })
    }
  }

  // If somehow no groups produced (empty events), return the original.
  if (chunks.length === 0) {
    return [timeline]
  }

  return chunks
}
