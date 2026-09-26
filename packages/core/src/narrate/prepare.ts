import type { Timeline } from '../types/timeline.js'
import type { NarrateOptions } from '../types/options.js'
import { sanitizeTimeline } from '../privacy/outbound.js'
import { buildSystemPrompt } from './prompts/system.js'
import { buildTimelinePayload, estimateTokens, guardTokens } from './tokens.js'
import { chunkTimeline } from './chunker.js'

type PreparationOptions = Pick<NarrateOptions, 'style' | 'maxInputTokens'>

/** Shared by narration and the offline preview so chunking and content match. */
export function prepareNarration(timeline: Timeline, options: PreparationOptions) {
  const safeTimeline = sanitizeTimeline(timeline)
  const systemPrompt = buildSystemPrompt(options.style, {
    rootDir: safeTimeline.rootDir,
    scannedAt: safeTimeline.scannedAt,
  })
  const budget = Math.max(1, (options.maxInputTokens ?? 100000) - estimateTokens(systemPrompt))
  const chunks = chunkTimeline(safeTimeline, budget)
  for (const chunk of chunks) guardTokens(buildTimelinePayload(chunk), budget)
  return { timeline: safeTimeline, systemPrompt, chunks }
}

export function buildNarrationPreview(timeline: Timeline, options: PreparationOptions) {
  const { systemPrompt, chunks } = prepareNarration(timeline, options)
  return {
    stage: 'narration-extraction',
    note: 'Offline preview of extraction prompts. Synthesis, formatting, and speech depend on generated output and are not included. Authentication is omitted.',
    requests: chunks.map((chunk) => ({
      system: systemPrompt,
      user: buildTimelinePayload(chunk),
    })),
  }
}
