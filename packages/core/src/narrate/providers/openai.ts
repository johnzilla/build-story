import { withLLMDeadline } from './deadline.js'
import type { SpendBudget } from '../../budget.js'
import { reserveLLM, llmCostUSD } from '../pricing.js'
import { sanitizeOutboundText, sanitizeOutboundValue } from '../../privacy/outbound.js'
import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import { GeneratedStoryArcSchema as StoryArcSchema } from '../../types/story.js'
import type { StoryArc, FormatType } from '../../types/story.js'
import type { Timeline } from '../../types/timeline.js'
import type { LLMProvider, UsageStats } from './interface.js'
import { buildTimelinePayload } from '../tokens.js'

/**
 * OpenAIProvider implements LLMProvider using the OpenAI SDK.
 * Uses client.chat.completions.parse() + zodResponseFormat for structured output (NARR-02).
 * Includes fallback to z.toJSONSchema() if zodResponseFormat has Zod v4 issues (Pitfall 1).
 * temperature: 0 for deterministic output (NARR-09).
 */
export class OpenAIProvider implements LLMProvider {
  private readonly client: OpenAI
  private readonly model: string
  private readonly budget: SpendBudget | undefined
  private _usage: UsageStats = { calls: 0, inputTokens: 0, outputTokens: 0 }

  constructor({ apiKey, model = 'gpt-4o', budget }: { apiKey: string; model?: string; budget?: SpendBudget | undefined }) {
    this.client = new OpenAI({ apiKey, maxRetries: 0 })
    this.model = model
    this.budget = budget
  }

  private trackUsage(usage: OpenAI.Completions.CompletionUsage | undefined) {
    this._usage.calls++
    if (usage) {
      this._usage.inputTokens += usage.prompt_tokens
      this._usage.outputTokens += usage.completion_tokens
    }
  }

  getUsage(): UsageStats {
    return { ...this._usage }
  }

  async extractStoryArc(timeline: Timeline, systemPrompt: string): Promise<StoryArc> {
    const payload = buildTimelinePayload(timeline)
    return this._structuredExtract(
      [
        { role: 'system', content: sanitizeOutboundText(systemPrompt) },
        { role: 'user', content: payload },
      ],
    )
  }

  async generateFormat(arc: StoryArc, _formatType: FormatType, systemPrompt: string): Promise<string> {
    const beatsJson = JSON.stringify(sanitizeOutboundValue(arc.beats), null, 2)

    // Plain text output — use create() not parse() (per D-04)
    const request: Parameters<typeof this.client.chat.completions.create>[0] & { stream?: false } = {
      model: this.model,
      max_completion_tokens: 4096,
      temperature: 0,
      messages: [
        { role: 'system', content: sanitizeOutboundText(systemPrompt) },
        { role: 'user', content: beatsJson },
      ],
    }
    const charge = reserveLLM(this.budget, 'openai', this.model, request, 4096)
    const completion = await withLLMDeadline(signal => this.client.chat.completions.create(request, { signal }))

    this.trackUsage(completion.usage ?? undefined)
    if (completion.usage) charge?.settle(llmCostUSD('openai', { calls: 1, inputTokens: completion.usage.prompt_tokens, outputTokens: completion.usage.completion_tokens }), 'usage')

    if (completion.choices[0]?.finish_reason === 'length') throw new Error('OpenAI output reached its token limit')
    const content = completion.choices[0]?.message.content
    if (content === null || content === undefined) {
      throw new Error('OpenAI generateFormat: unexpected response — no text content returned')
    }

    return content
  }

  async synthesizeArcs(arcs: StoryArc[], systemPrompt: string): Promise<StoryArc> {
    const mergedBeats = arcs.flatMap((arc) => arc.beats)
    const mergedBeatsJson = JSON.stringify(sanitizeOutboundValue(mergedBeats), null, 2)

    const synthesisPrompt =
      systemPrompt +
      '\n\n## Synthesis Instructions\n' +
      'Synthesize these beats from multiple chunks into a coherent single StoryArc — ' +
      'reorder chronologically, merge duplicates, ensure narrative flow, preserve all sourceEventIds.'

    return this._structuredExtract(
      [
        { role: 'system', content: sanitizeOutboundText(synthesisPrompt) },
        { role: 'user', content: mergedBeatsJson },
      ],
    )
  }

  /**
   * Internal helper for structured extraction.
   *
   * The Zod v4 incompatibility (Pitfall 1) is a SERIALIZATION failure: it happens
   * synchronously inside `zodResponseFormat(...)` while it walks the schema —
   * before any network call. So we isolate the fallback to schema *construction*
   * only: if building the response_format throws, we rebuild it with
   * `z.toJSONSchema()`. Then exactly ONE network call is made either way.
   *
   * The previous version wrapped the whole request in one try/catch and retried
   * on any error whose message contained "Cannot read properties of undefined" —
   * a broad substring that a genuine parse/response failure could also carry,
   * triggering a second paid call that masked the real error. Narrowing the
   * fallback to construction guarantees a schema failure raises once, with no
   * duplicate spend.
   */
  private async _structuredExtract(
    messages: Array<{ role: 'system' | 'user'; content: string }>,
  ): Promise<StoryArc> {
    // Build the response format, falling back to a hand-serialized JSON schema
    // only if zodResponseFormat's synchronous schema walk fails.
    let useParse = true
    let responseFormat: ReturnType<typeof zodResponseFormat> | undefined
    try {
      responseFormat = zodResponseFormat(StoryArcSchema, 'story_arc')
    } catch {
      useParse = false
    }

    if (useParse && responseFormat !== undefined) {
      const request: Parameters<typeof this.client.chat.completions.parse>[0] = {
        model: this.model,
        max_completion_tokens: 16384,
        temperature: 0,
        messages,
        response_format: responseFormat,
      }
      const charge = reserveLLM(this.budget, 'openai', this.model, request, 16384)
      const completion = await withLLMDeadline(signal => this.client.chat.completions.parse(request, { signal }))
      this.trackUsage(completion.usage ?? undefined)
      if (completion.usage) charge?.settle(llmCostUSD('openai', { calls: 1, inputTokens: completion.usage.prompt_tokens, outputTokens: completion.usage.completion_tokens }), 'usage')

      const parsed = completion.choices[0]?.message.parsed
      if (parsed === null || parsed === undefined) {
        throw new Error('OpenAI failed to produce structured output (content filter or length limit)')
      }
      return StoryArcSchema.parse(parsed)
    }

    // Fallback path: manual json_schema response_format via z.toJSONSchema().
    const rawSchema = z.toJSONSchema(StoryArcSchema)
    const request: Parameters<typeof this.client.chat.completions.create>[0] & { stream?: false } = {
      model: this.model,
      max_completion_tokens: 16384,
      temperature: 0,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'story_arc',
          schema: rawSchema as Record<string, unknown>,
          strict: true,
        },
      },
    }
    const charge = reserveLLM(this.budget, 'openai', this.model, request, 16384)
    const completion = await withLLMDeadline(signal => this.client.chat.completions.create(request, { signal }))
    this.trackUsage(completion.usage ?? undefined)
    if (completion.usage) charge?.settle(llmCostUSD('openai', { calls: 1, inputTokens: completion.usage.prompt_tokens, outputTokens: completion.usage.completion_tokens }), 'usage')

    if (completion.choices[0]?.finish_reason === 'length') throw new Error('OpenAI output reached its token limit')
    const content = completion.choices[0]?.message.content
    if (content === null || content === undefined) {
      throw new Error('OpenAI failed to produce structured output (fallback path: content filter or length limit)')
    }

    const parsed: unknown = JSON.parse(content)
    return StoryArcSchema.parse(parsed)
  }
}
