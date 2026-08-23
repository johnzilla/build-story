// OpenAI TTS accepts at most 4096 characters per request; 3900 leaves a safe
// buffer. Text over the limit is trimmed at the last sentence boundary that fits,
// falling back to a hard cut when there's no sentence break in range.
export const MAX_TTS_CHARS = 3900

/** Trim narration text to fit one TTS request, preferring a sentence boundary. */
export function truncateForTTS(text: string, max = MAX_TTS_CHARS): string {
  if (text.length <= max) return text
  const lastSentenceEnd = text.lastIndexOf('.', max)
  // `slice(0, idx + 1)` keeps the period; when there's no '.' in range,
  // lastIndexOf returns -1 → slice(0, 0) === '' → fall back to the hard cut.
  return text.slice(0, lastSentenceEnd + 1) || text.slice(0, max)
}
