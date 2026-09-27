import { applyEditorialReview } from './editorial.js'
import type { Timeline } from '../types/timeline.js'
import type { NarrateOptions } from '../types/options.js'
import type { StoryArc } from '../types/story.js'
import { reviewStoryArc } from './review.js'
import type { LLMProvider } from './providers/interface.js'
import { AnthropicProvider } from './providers/anthropic.js'
import { OpenAIProvider } from './providers/openai.js'
import { prepareNarration } from './prepare.js'
import { sanitizeStoryArc } from '../privacy/outbound.js'

/**
 * Create an LLMProvider from NarrateOptions.
 * Exported so the CLI can create one provider and pass it to both narrate() and format().
 */
export function createProvider(options: NarrateOptions): LLMProvider {
  switch (options.provider) {
    case 'anthropic':
      return new AnthropicProvider({ apiKey: options.apiKey, budget: options.budget })
    case 'openai':
      return new OpenAIProvider({ apiKey: options.apiKey, budget: options.budget })
    default: {
      // TypeScript exhaustiveness check
      const _never: never = options.provider
      throw new Error(`Unsupported provider: ${String(_never)}`)
    }
  }
}

/**
 * Narrate a Timeline into a StoryArc using an LLM.
 *
 * Accepts an optional LLMProvider to avoid double instantiation — the CLI
 * can create a provider once and pass it to both narrate() and format().
 *
 * Token guard flow (NARR-08):
 * 1. Estimate tokens for full payload
 * 2. If fits: extract directly via provider.extractStoryArc
 * 3. If over limit: chunk by phase, guard each chunk individually, narrate each,
 *    then synthesize via provider.synthesizeArcs
 *
 * Post-narration: locally reviews source IDs, evidence quotes, chronology,
 * and history coverage. A matching quote does not verify semantic claims.
 */
export async function narrate(
  timeline: Timeline,
  options: NarrateOptions,
  provider?: LLMProvider,
): Promise<StoryArc> {
  if (options.apiKey === '') {
    throw new Error(
      'API key is required for narration. Set ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable.',
    )
  }

  const llmProvider = provider ?? createProvider(options)
  const prepared = prepareNarration(timeline, options)
  timeline = prepared.timeline
  const chunkArcs: StoryArc[] = []
  for (const chunk of prepared.chunks) {
    chunkArcs.push(sanitizeStoryArc(await llmProvider.extractStoryArc(chunk, prepared.systemPrompt)))
  }
  const finalArc = chunkArcs.length === 1
    ? chunkArcs[0]!
    : sanitizeStoryArc(await llmProvider.synthesizeArcs(chunkArcs, prepared.systemPrompt))

  return applyEditorialReview(reviewStoryArc(finalArc, timeline), prepared.editorial)
}
