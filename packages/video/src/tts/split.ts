import { splitNarration } from '@buildstory/core'

// Conservative per-request limit. Every character is retained across chunks.
export const MAX_TTS_CHARS = 3900
export function splitForTTS(text: string, max = MAX_TTS_CHARS): string[] {
  return splitNarration(text, max)
}
