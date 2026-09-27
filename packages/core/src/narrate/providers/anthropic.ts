import { withLLMDeadline } from './deadline.js'
import type { SpendBudget } from '../../budget.js'
import { reserveLLM, llmCostUSD } from '../pricing.js'
import { sanitizeOutboundText, sanitizeOutboundValue } from '../../privacy/outbound.js'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { GeneratedStoryArcSchema as StoryArcSchema } from '../../types/story.js'
import type { StoryArc, FormatType } from '../../types/story.js'
import type { Timeline } from '../../types/timeline.js'
import type { LLMProvider, UsageStats } from './interface.js'
import { buildTimelinePayload } from '../tokens.js'

/**
 * AnthropicProvider implements LLMProvider using the Anthropic Claude SDK.
 * Uses client.messages.parse() + zodOutputFormat for structured output (NARR-01).
 * temperature: 0 for deterministic output (NARR-09).
 */
export class AnthropicProvider implements LLMProvider {
  private readonly client: Anthropic
  private readonly model: string
  private readonly budget: SpendBudget | undefined
  private _usage: UsageStats = { calls: 0, inputTokens: 0, outputTokens: 0 }

  constructor({ apiKey, model = 'claude-sonnet-4-5', budget }: { apiKey: string; model?: string; budget?: SpendBudget | undefined }) {
    this.client = new Anthropic({ apiKey, maxRetries: 0 })
    this.model = model
    this.budget = budget
  }

  private trackUsage(usage: { input_tokens: number; output_tokens: number }) {
    this._usage.calls++
    this._usage.inputTokens += usage.input_tokens
    this._usage.outputTokens += usage.output_tokens
  }

  getUsage(): UsageStats {
    return { ...this._usage }
  }

  async extractStoryArc(timeline: Timeline, systemPrompt: string): Promise<StoryArc> {
    const payload = buildTimelinePayload(timeline)

    const request: Parameters<typeof this.client.messages.parse>[0] = {
      model: this.model,
      max_tokens: 16384,
      temperature: 0,
      system: sanitizeOutboundText(systemPrompt),
      messages: [{ role: 'user', content: payload }],
      output_config: {
        format: zodOutputFormat(StoryArcSchema),
      },
    }
    const charge = reserveLLM(this.budget, 'anthropic', this.model, request, 16384)
    const response = await withLLMDeadline(signal => this.client.messages.parse(request, { signal }))

    this.trackUsage(response.usage)
    charge?.settle(llmCostUSD('anthropic', { calls: 1, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }), 'usage')

    if (response.parsed_output === null || response.parsed_output === undefined) {
      throw new Error('Anthropic refused to generate structured output')
    }

    // Post-validate as final safety net per project conventions
    return StoryArcSchema.parse(response.parsed_output)
  }

  async generateFormat(arc: StoryArc, _formatType: FormatType, systemPrompt: string): Promise<string> {
    const beatsJson = JSON.stringify(sanitizeOutboundValue(arc.beats), null, 2)

    // Plain text output — use messages.create() not messages.parse() (per D-04)
    const request: Parameters<typeof this.client.messages.create>[0] & { stream?: false } = {
      model: this.model,
      max_tokens: 4096,
      temperature: 0,
      system: sanitizeOutboundText(systemPrompt),
      messages: [{ role: 'user', content: beatsJson }],
    }
    const charge = reserveLLM(this.budget, 'anthropic', this.model, request, 4096)
    const response = await withLLMDeadline(signal => this.client.messages.create(request, { signal }))

    this.trackUsage(response.usage)
    charge?.settle(llmCostUSD('anthropic', { calls: 1, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }), 'usage')

    if (response.stop_reason === 'max_tokens') throw new Error('Anthropic output reached its token limit')
    const firstContent = response.content[0]
    if (firstContent === undefined || firstContent.type !== 'text') {
      throw new Error('Anthropic generateFormat: unexpected response — no text content in response')
    }

    return firstContent.text
  }

  async synthesizeArcs(arcs: StoryArc[], systemPrompt: string): Promise<StoryArc> {
    // Merge all beats from all arcs into a single array
    const mergedBeats = arcs.flatMap((arc) => arc.beats)
    const mergedBeatsJson = JSON.stringify(sanitizeOutboundValue(mergedBeats), null, 2)

    const synthesisPrompt =
      systemPrompt +
      '\n\n## Synthesis Instructions\n' +
      'Synthesize these beats from multiple chunks into a coherent single StoryArc — ' +
      'reorder chronologically, merge duplicates, ensure narrative flow, preserve all sourceEventIds.'

    const request: Parameters<typeof this.client.messages.parse>[0] = {
      model: this.model,
      max_tokens: 16384,
      temperature: 0,
      system: sanitizeOutboundText(synthesisPrompt),
      messages: [{ role: 'user', content: mergedBeatsJson }],
      output_config: {
        format: zodOutputFormat(StoryArcSchema),
      },
    }
    const charge = reserveLLM(this.budget, 'anthropic', this.model, request, 16384)
    const response = await withLLMDeadline(signal => this.client.messages.parse(request, { signal }))

    this.trackUsage(response.usage)
    charge?.settle(llmCostUSD('anthropic', { calls: 1, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }), 'usage')

    if (response.parsed_output === null || response.parsed_output === undefined) {
      throw new Error('Anthropic refused to generate structured output during arc synthesis')
    }

    return StoryArcSchema.parse(response.parsed_output)
  }
}
