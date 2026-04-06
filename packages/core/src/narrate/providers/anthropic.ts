import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { StoryArcSchema } from '../../types/story.js'
import type { StoryArc, FormatType } from '../../types/story.js'
import type { Timeline } from '../../types/timeline.js'
import type { LLMProvider } from './interface.js'
import { buildTimelinePayload } from '../tokens.js'

/**
 * AnthropicProvider implements LLMProvider using the Anthropic Claude SDK.
 * Uses client.messages.parse() + zodOutputFormat for structured output (NARR-01).
 * temperature: 0 for deterministic output (NARR-09).
 */
export class AnthropicProvider implements LLMProvider {
  private readonly client: Anthropic
  private readonly model: string

  constructor({ apiKey, model = 'claude-sonnet-4-5' }: { apiKey: string; model?: string }) {
    this.client = new Anthropic({ apiKey, maxRetries: 2 })
    this.model = model
  }

  async extractStoryArc(timeline: Timeline, systemPrompt: string): Promise<StoryArc> {
    const payload = buildTimelinePayload(timeline)

    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 16384,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: payload }],
      output_config: {
        format: zodOutputFormat(StoryArcSchema),
      },
    })

    if (response.parsed_output === null || response.parsed_output === undefined) {
      throw new Error('Anthropic refused to generate structured output')
    }

    // Post-validate as final safety net per project conventions
    return StoryArcSchema.parse(response.parsed_output)
  }

  async generateFormat(arc: StoryArc, _formatType: FormatType, systemPrompt: string): Promise<string> {
    const beatsJson = JSON.stringify(arc.beats, null, 2)

    // Plain text output — use messages.create() not messages.parse() (per D-04)
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: beatsJson }],
    })

    const firstContent = response.content[0]
    if (firstContent === undefined || firstContent.type !== 'text') {
      throw new Error('Anthropic generateFormat: unexpected response — no text content in response')
    }

    return firstContent.text
  }

  async synthesizeArcs(arcs: StoryArc[], systemPrompt: string): Promise<StoryArc> {
    // Merge all beats from all arcs into a single array
    const mergedBeats = arcs.flatMap((arc) => arc.beats)
    const mergedBeatsJson = JSON.stringify(mergedBeats, null, 2)

    const synthesisPrompt =
      systemPrompt +
      '\n\n## Synthesis Instructions\n' +
      'Synthesize these beats from multiple chunks into a coherent single StoryArc — ' +
      'reorder chronologically, merge duplicates, ensure narrative flow, preserve all sourceEventIds.'

    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 16384,
      temperature: 0,
      system: synthesisPrompt,
      messages: [{ role: 'user', content: mergedBeatsJson }],
      output_config: {
        format: zodOutputFormat(StoryArcSchema),
      },
    })

    if (response.parsed_output === null || response.parsed_output === undefined) {
      throw new Error('Anthropic refused to generate structured output during arc synthesis')
    }

    return StoryArcSchema.parse(response.parsed_output)
  }
}
