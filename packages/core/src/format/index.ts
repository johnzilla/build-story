import type { StoryArc, FormatType } from '../types/story.js'
import type { LLMProvider } from '../narrate/providers/interface.js'
import { buildFormatPrompt } from '../narrate/prompts/format-prompts.js'

/**
 * Generate formatted text output from a StoryArc using an LLM provider.
 *
 * Accepts an LLMProvider instance directly (not NarrateOptions) to maintain
 * the INFRA-02 boundary — core works with abstract providers, not CLI concepts
 * like provider names and API keys. The CLI is responsible for creating the
 * provider and passing it in.
 *
 * Appends word count and reading time metadata footer per NARR-06.
 */
export async function format(arc: StoryArc, formatType: FormatType, provider: LLMProvider): Promise<string> {
  const formatPrompt = buildFormatPrompt(formatType)
  const text = await provider.generateFormat(arc, formatType, formatPrompt)

  const wordCount = text.split(/\s+/).filter(Boolean).length
  const readingTime = Math.ceil(wordCount / 200)

  const withMetadata =
    text +
    `\n\n---\n_Word count: ${wordCount} | Reading time: ~${readingTime} min | Style: ${arc.metadata.style} | Format: ${formatType}_\n`

  return withMetadata
}
