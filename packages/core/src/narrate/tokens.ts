import type { Timeline, TimelineEvent } from '../types/timeline.js'

/**
 * Estimate token count using the ~4 chars/token heuristic.
 * Returns 0 for empty string. Uses Math.ceil for safe overestimation.
 * Per D-07: simple character-based estimation, no extra dependencies.
 */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0
  return Math.ceil(text.length / 4)
}

/**
 * Serialize a Timeline for use as an LLM prompt payload.
 * MUST omit rawContent from events to prevent leaking full file content to the LLM.
 * Includes: id, date, source, path, summary, artifactType, crossRefs, metadata.
 * Per T-03-01 threat mitigation.
 */
export function buildTimelinePayload(timeline: Timeline): string {
  const payload = {
    version: timeline.version,
    rootDir: timeline.rootDir,
    scannedAt: timeline.scannedAt,
    dateRange: timeline.dateRange,
    events: timeline.events.map((event: TimelineEvent) => {
      // Destructure to explicitly exclude rawContent
      const { rawContent: _rawContent, ...rest } = event
      return rest
    }),
  }
  return JSON.stringify(payload)
}

/**
 * Guard against oversized LLM inputs.
 * Throws a descriptive Error if estimated tokens exceed maxInputTokens.
 * Per D-08 and T-03-02 threat mitigation.
 *
 * @param payload - The serialized timeline string to check
 * @param maxInputTokens - Maximum allowed token count
 * @throws Error when estimated token count exceeds the limit
 */
export function guardTokens(payload: string, maxInputTokens: number): void {
  const estimated = estimateTokens(payload)
  if (estimated > maxInputTokens) {
    throw new Error(
      `Token guard: estimated ${estimated} tokens exceeds limit of ${maxInputTokens} tokens. ` +
        `Payload is ~${payload.length} characters. ` +
        `Use a smaller timeline or increase maxInputTokens to proceed.`,
    )
  }
}
