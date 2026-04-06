import type { Timeline } from '../types/timeline.js'
import type { NarrateOptions } from '../types/options.js'
import type { StoryArc } from '../types/story.js'
import { StoryArcSchema } from '../types/story.js'
import type { LLMProvider } from './providers/interface.js'
import { AnthropicProvider } from './providers/anthropic.js'
import { OpenAIProvider } from './providers/openai.js'
import { buildSystemPrompt } from './prompts/system.js'
import { buildTimelinePayload, estimateTokens, guardTokens } from './tokens.js'
import { chunkTimeline } from './chunker.js'

/**
 * Create an LLMProvider from NarrateOptions.
 * Exported so the CLI can create one provider and pass it to both narrate() and format().
 */
export function createProvider(options: NarrateOptions): LLMProvider {
  switch (options.provider) {
    case 'anthropic':
      return new AnthropicProvider({ apiKey: options.apiKey })
    case 'openai':
      return new OpenAIProvider({ apiKey: options.apiKey })
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
 * Post-narration: validates all sourceEventIds against timeline event IDs (NARR-05)
 * and filters out any hallucinated references with warnings.
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
  const maxInputTokens = options.maxInputTokens ?? 100000

  const systemPrompt = buildSystemPrompt(options.style, {
    rootDir: timeline.rootDir,
    scannedAt: timeline.scannedAt,
  })

  const payload = buildTimelinePayload(timeline)
  const estimatedTokens = estimateTokens(payload)

  let finalArc: StoryArc

  if (estimatedTokens <= maxInputTokens) {
    // Fits within budget — single extraction call
    finalArc = await llmProvider.extractStoryArc(timeline, systemPrompt)
  } else {
    // Over budget — chunk by phase boundaries, guard each chunk individually
    const chunks = chunkTimeline(timeline, maxInputTokens)

    const chunkArcs: StoryArc[] = []
    for (const chunk of chunks) {
      const chunkPayload = buildTimelinePayload(chunk)
      // guardTokens throws (NARR-08) if an individual chunk still exceeds the limit
      // after phase-boundary splitting — this means a single phase is too large to narrate
      guardTokens(chunkPayload, maxInputTokens)
      const chunkArc = await llmProvider.extractStoryArc(chunk, systemPrompt)
      chunkArcs.push(chunkArc)
    }

    if (chunkArcs.length === 1 && chunkArcs[0] !== undefined) {
      finalArc = chunkArcs[0]
    } else {
      // Synthesize multiple chunk arcs into a single coherent arc
      finalArc = await llmProvider.synthesizeArcs(chunkArcs, systemPrompt)
    }
  }

  // Post-narration: validate sourceEventIds against actual timeline event IDs (NARR-05)
  const validIds = new Set(timeline.events.map((e) => e.id))

  const validatedBeats = finalArc.beats.map((beat) => {
    const badIds = beat.sourceEventIds.filter((id) => !validIds.has(id))
    if (badIds.length > 0) {
      for (const badId of badIds) {
        console.warn(
          `Warning: Beat "${beat.title}" references unknown event ID "${badId}" — LLM hallucinated a source link`,
        )
      }
      const filtered = beat.sourceEventIds.filter((id) => validIds.has(id))
      if (filtered.length === 0) {
        console.warn(`Warning: Beat "${beat.title}" has no valid sourceEventIds after filtering hallucinated IDs`)
      }
      return { ...beat, sourceEventIds: filtered }
    }
    return beat
  })

  const validatedArc: StoryArc = {
    ...finalArc,
    beats: validatedBeats,
    metadata: {
      ...finalArc.metadata,
      generatedAt: new Date().toISOString(),
    },
  }

  return StoryArcSchema.parse(validatedArc)
}
