import type { StoryArc, FormatType } from '../../types/story.js'
import type { Timeline } from '../../types/timeline.js'

export interface UsageStats {
  calls: number
  inputTokens: number
  outputTokens: number
}

/**
 * Provider-agnostic LLM client interface per D-03.
 * narrate() and format() depend only on this interface — not on specific SDK implementations.
 */
export interface LLMProvider {
  /**
   * Extract a StoryArc from a Timeline using structured output.
   * Per D-01: single call receives the full Timeline, extracts beats, classifies them,
   * and generates narrative summaries. Post-validated through Zod StoryArcSchema.
   */
  extractStoryArc(timeline: Timeline, systemPrompt: string): Promise<StoryArc>

  /**
   * Generate formatted text for a given format type.
   * Per D-04: a second LLM call takes StoryArc beats + a format-specific system prompt
   * and generates the final text (plain text / markdown output).
   */
  generateFormat(arc: StoryArc, formatType: FormatType, systemPrompt: string): Promise<string>

  /**
   * Synthesize multiple StoryArcs (from chunked narration) into a single coherent arc.
   * Per D-06: when a timeline is split by phase boundaries, each chunk is narrated
   * separately, then this synthesis call merges the resulting arcs into one.
   */
  synthesizeArcs(arcs: StoryArc[], systemPrompt: string): Promise<StoryArc>

  /** Accumulated token usage across all calls. */
  getUsage(): UsageStats
}
