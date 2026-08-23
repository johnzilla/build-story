// Single source of truth for OpenAI TTS pricing and the default model.
//
// This module deliberately imports nothing heavy (no OpenAI SDK, no Remotion) so
// the CLI can pull the price table into a `--dry-run` estimate without loading
// the whole video runtime. It is exported from @buildstory/video/pricing.

export type TTSModel = 'tts-1' | 'tts-1-hd'

/**
 * USD per 1,000 input characters, keyed by model.
 * Source: https://platform.openai.com/docs/pricing (tts-1 $15/1M chars,
 * tts-1-hd $30/1M chars).
 */
export const TTS_PRICE_PER_1000_CHARS: Record<TTSModel, number> = {
  'tts-1': 0.015,
  'tts-1-hd': 0.03,
}

/**
 * The model BuildStory renders with by default. tts-1-hd trades cost for the
 * higher audio quality that reads well over a documentary narration.
 * Keep this in sync with the model actually called in `generateSceneAudio`.
 */
export const DEFAULT_TTS_MODEL: TTSModel = 'tts-1-hd'

/** Estimate TTS cost in USD for a given character count and model. */
export function ttsCostUSD(totalCharacters: number, model: TTSModel = DEFAULT_TTS_MODEL): number {
  return (totalCharacters / 1000) * TTS_PRICE_PER_1000_CHARS[model]
}
