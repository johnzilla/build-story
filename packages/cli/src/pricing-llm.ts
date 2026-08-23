import type { UsageStats } from '@buildstory/core'
import type { Provider } from './validate.js'

// USD per 1,000,000 tokens (input / output), keyed by provider, for the default
// model each provider uses (AnthropicProvider → claude-sonnet-4-5, OpenAIProvider
// → gpt-4o). The CLI doesn't expose model selection, so pricing by provider is
// exact for the models actually called. Source: Anthropic & OpenAI public pricing.
// Update alongside the provider default models in @buildstory/core.
export const LLM_PRICE_PER_1M: Record<Provider, { input: number; output: number; model: string }> = {
  anthropic: { input: 3, output: 15, model: 'claude-sonnet-4-5' },
  openai: { input: 2.5, output: 10, model: 'gpt-4o' },
}

/** Actual LLM cost in USD from accumulated token usage. */
export function llmCostUSD(provider: Provider, usage: UsageStats): number {
  const p = LLM_PRICE_PER_1M[provider]
  return (usage.inputTokens / 1_000_000) * p.input + (usage.outputTokens / 1_000_000) * p.output
}
