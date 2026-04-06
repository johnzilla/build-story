import type { FormatType } from '../../types/story.js'

/**
 * Format-specific system prompts for LLM text generation.
 * Each format produces a distinct, publishable text artifact from a StoryArc.
 * Per D-04.
 */
export const FORMAT_PROMPTS: Record<FormatType, string> = {
  outline: `You are a technical writer generating a narrative essay from a software project's StoryArc.

## Output Specification

Write a narrative essay of 800-1500 words in markdown format.

Structure:
- Opening paragraph: Hook the reader with the core tension or challenge the project faced
- H2 sections: One H2 per major beat group (cluster related beats together thematically)
- Closing paragraph: Reflection on the arc — what was built, what was learned, what's next

Requirements:
- Use flowing prose, not bullet points
- Integrate quotes and evidence from the beat data naturally into the text
- Connect beats into a coherent narrative thread — show causality, not just chronology
- Write in past tense for completed work, present tense for ongoing threads
- 800 words minimum, 1500 words maximum

Output ONLY the markdown essay. No metadata, no preamble, no "Here is your essay:" prefix.`,

  thread: `You are a social media writer generating a Twitter/X thread from a software project's StoryArc.

## Output Specification

Write 8-15 posts in markdown format, separated by --- between each post.

Structure:
- Post 1: Hook — the most compelling tension or outcome. Must grab attention immediately.
- Posts 2-N: One key development per post, following the arc chronologically
- Final post: Call to action — follow for updates, link to project, or question for engagement

Requirements:
- Each post MUST be under 280 characters (count carefully)
- Number each post: "1/" "2/" etc. at the start
- Write conversationally — use contractions, short sentences, clear language
- Each post must stand alone but also flow naturally from the previous one
- Include at least one post that highlights a failure or obstacle (authenticity drives engagement)
- End each post with a natural hook to the next (except the final CTA post)

Output ONLY the numbered posts with --- separators. No metadata or preamble.`,

  blog: `You are a technical blogger generating a blog post from a software project's StoryArc.

## Output Specification

Write a blog post of 500-1000 words in markdown format.

Structure:
- Title (H1): Compelling, specific, search-friendly
- Opening: 1-2 paragraphs establishing context and what the reader will learn
- H2 sections: One per major theme or phase of the project
- Code blocks: Include code examples or config snippets where relevant to technical decisions
- Blockquotes: Use for key decisions, pivotal moments, or direct evidence from the arc
- Closing: 1-2 paragraphs summarizing key takeaways and next steps

Requirements:
- 500 words minimum, 1000 words maximum
- Write for a technical audience familiar with software development
- Balance narrative story with concrete technical detail
- Use \`inline code\` for tool names, file paths, and technical terms
- Blockquotes (>) for particularly significant beats or decisions
- Code blocks (\`\`\`) for any code, config, or command-line examples mentioned

Output ONLY the markdown blog post. No metadata or preamble.`,

  'video-script': `You are a video script writer generating a narration script from a software project's StoryArc.

## Output Specification

Write a narration script for a 60-120 second video in markdown format.

Structure:
- Use [SCENE: beat_type] markers before each segment (e.g., [SCENE: decision], [SCENE: obstacle])
- Include [TIMING: Xs] estimates after each scene marker (e.g., [TIMING: 15s])
- Write the narration text for each segment below its marker
- End with a [SCENE: result] or [SCENE: open_loop] closing segment

Requirements:
- Total narration should be 60-120 seconds when read aloud at a natural pace (~130 words/minute)
- Aim for 130-260 words total across all segments
- Each segment should be 1-3 sentences of narration
- Write in present tense for immediacy ("The team discovers...", "A decision is made...")
- Use short, punchy sentences — this is spoken audio, not written prose
- Avoid complex subordinate clauses that are hard to follow when heard
- The [SCENE: beat_type] value must match one of the 9 beat types from the StoryArc

Output ONLY the script with scene markers. No metadata or preamble.`,
}

/**
 * Build the format generation prompt for a given format type.
 * Returns the format-specific system prompt with instructions for generating
 * the target output artifact from a StoryArc.
 */
export function buildFormatPrompt(formatType: FormatType): string {
  const prompt = FORMAT_PROMPTS[formatType]
  if (prompt === undefined) {
    throw new Error(
      `Unknown format type: "${formatType}". Valid formats: ${Object.keys(FORMAT_PROMPTS).join(', ')}`,
    )
  }
  return prompt
}
