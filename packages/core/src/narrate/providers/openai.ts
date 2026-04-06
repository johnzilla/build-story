import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import { StoryArcSchema } from '../../types/story.js'
import type { StoryArc, FormatType } from '../../types/story.js'
import type { Timeline } from '../../types/timeline.js'
import type { LLMProvider } from './interface.js'
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

  constructor({ apiKey, model = 'gpt-4o' }: { apiKey: string; model?: string }) {
    this.client = new OpenAI({ apiKey, maxRetries: 2 })
    this.model = model
  }

  async extractStoryArc(timeline: Timeline, systemPrompt: string): Promise<StoryArc> {
    const payload = buildTimelinePayload(timeline)
    return this._structuredExtract(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: payload },
      ],
    )
  }

  async generateFormat(arc: StoryArc, _formatType: FormatType, systemPrompt: string): Promise<string> {
    const beatsJson = JSON.stringify(arc.beats, null, 2)

    // Plain text output — use create() not parse() (per D-04)
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: beatsJson },
      ],
    })

    const content = completion.choices[0]?.message.content
    if (content === null || content === undefined) {
      throw new Error('OpenAI generateFormat: unexpected response — no text content returned')
    }

    return content
  }

  async synthesizeArcs(arcs: StoryArc[], systemPrompt: string): Promise<StoryArc> {
    const mergedBeats = arcs.flatMap((arc) => arc.beats)
    const mergedBeatsJson = JSON.stringify(mergedBeats, null, 2)

    const synthesisPrompt =
      systemPrompt +
      '\n\n## Synthesis Instructions\n' +
      'Synthesize these beats from multiple chunks into a coherent single StoryArc — ' +
      'reorder chronologically, merge duplicates, ensure narrative flow, preserve all sourceEventIds.'

    return this._structuredExtract(
      [
        { role: 'system', content: synthesisPrompt },
        { role: 'user', content: mergedBeatsJson },
      ],
    )
  }

  /**
   * Internal helper for structured extraction.
   * Tries zodResponseFormat first; falls back to z.toJSONSchema() if Zod v4 incompatibility detected.
   */
  private async _structuredExtract(
    messages: Array<{ role: 'system' | 'user'; content: string }>,
  ): Promise<StoryArc> {
    // Try primary path: zodResponseFormat
    try {
      const responseFormat = zodResponseFormat(StoryArcSchema, 'story_arc')

      const completion = await this.client.chat.completions.parse({
        model: this.model,
        temperature: 0,
        messages,
        response_format: responseFormat,
      })

      const parsed = completion.choices[0]?.message.parsed
      if (parsed === null || parsed === undefined) {
        throw new Error('OpenAI failed to produce structured output (content filter or length limit)')
      }

      return StoryArcSchema.parse(parsed)
    } catch (err) {
      // Check if this is a Zod v4 compatibility error from zodResponseFormat (Pitfall 1)
      const errMsg = String(err)
      const isZodCompatError =
        errMsg.includes('ZodFirstPartyTypeKind') ||
        errMsg.includes('zod-to-json-schema') ||
        errMsg.includes('Cannot read properties of undefined')

      if (!isZodCompatError) {
        // Re-throw non-compatibility errors (e.g. API errors, content filter)
        throw err
      }

      // Fallback: use z.toJSONSchema() with manual response_format
      const rawSchema = z.toJSONSchema(StoryArcSchema)
      const completion = await this.client.chat.completions.create({
        model: this.model,
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
      })

      const content = completion.choices[0]?.message.content
      if (content === null || content === undefined) {
        throw new Error('OpenAI failed to produce structured output (fallback path: content filter or length limit)')
      }

      const parsed: unknown = JSON.parse(content)
      return StoryArcSchema.parse(parsed)
    }
  }
}
