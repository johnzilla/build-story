import chalk from 'chalk'
import type { TTSModel } from '@buildstory/video/pricing'

// ---------------------------------------------------------------------------
// Allowed values + built-in defaults
// ---------------------------------------------------------------------------

export const PROVIDERS = ['anthropic', 'openai'] as const
export const STYLES = ['technical', 'overview', 'retrospective', 'pitch', 'story'] as const
export const RENDERERS = ['remotion', 'heygen'] as const
export const TTS_VOICES = ['nova', 'alloy', 'echo', 'fable', 'onyx', 'shimmer'] as const
export const TTS_MODELS = ['tts-1', 'tts-1-hd'] as const

export type Provider = (typeof PROVIDERS)[number]
export type Style = (typeof STYLES)[number]
export type Renderer = (typeof RENDERERS)[number]

/**
 * Unified default narrative style across `run` and `narrate` (they previously
 * disagreed — run defaulted to "story", narrate to "overview" — so the same arc
 * came out differently depending on the entry point).
 */
export const DEFAULT_STYLE: Style = 'story'
export const DEFAULT_PROVIDER: Provider = 'anthropic'
export const DEFAULT_RENDERER: Renderer = 'remotion'
export const DEFAULT_VOICE = 'nova'
export const DEFAULT_SPEED = 1.0
export const DEFAULT_TTS_MODEL: TTSModel = 'tts-1-hd'

// TTS speed bounds (OpenAI TTS accepts 0.25–4.0).
const SPEED_MIN = 0.25
const SPEED_MAX = 4.0

// ---------------------------------------------------------------------------
// Field checks — each pushes a clear message to `errors` on failure and returns
// the value (typed). Resolution precedence is the caller's job (flag ?? config
// ?? default); these only validate the already-resolved value.
// ---------------------------------------------------------------------------

function oneOf<T extends string>(
  label: string,
  value: unknown,
  allowed: readonly T[],
  errors: string[],
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    errors.push(`Invalid ${label} "${String(value)}". Must be one of: ${allowed.join(', ')}`)
  }
  return value as T
}

export const checkProvider = (v: unknown, e: string[]): Provider => oneOf('--provider', v, PROVIDERS, e)
export const checkStyle = (v: unknown, e: string[]): Style => oneOf('--style', v, STYLES, e)
export const checkRenderer = (v: unknown, e: string[]): Renderer => oneOf('--renderer', v, RENDERERS, e)
export const checkVoice = (v: unknown, e: string[]): string => oneOf('tts.voice', v, TTS_VOICES, e)
export const checkTtsModel = (v: unknown, e: string[]): TTSModel => oneOf('tts.model', v, TTS_MODELS, e)

export function checkSpeed(v: unknown, errors: string[]): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n < SPEED_MIN || n > SPEED_MAX) {
    errors.push(`Invalid tts.speed "${String(v)}". Must be a number between ${SPEED_MIN} and ${SPEED_MAX}.`)
    return DEFAULT_SPEED
  }
  return n
}

/** Parse and validate `--max-cost <usd>` (optional). Returns undefined when unset. */
export function checkMaxCost(v: unknown, errors: string[]): number | undefined {
  if (v === undefined || v === null || v === '') return undefined
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n <= 0) {
    errors.push(`Invalid --max-cost "${String(v)}". Must be a positive number of US dollars.`)
    return undefined
  }
  return n
}

/**
 * If any validation errors were collected, print them all and exit non-zero
 * BEFORE any paid API call. One aggregated report so a user fixes everything at
 * once instead of one round-trip per typo.
 */
export function reportErrors(errors: string[]): void {
  if (errors.length === 0) return
  console.error(chalk.red('\n  Invalid input — nothing was run (no API calls made):\n'))
  for (const e of errors) console.error(chalk.red(`    - ${e}`))
  console.error()
  process.exit(1)
}
