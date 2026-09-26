import type { UsageStats } from './providers/interface.js'
import type { SpendBudget } from '../budget.js'
type Provider = 'anthropic' | 'openai'

// USD per 1,000,000 tokens (input / output), keyed by provider, for the default
// model each provider uses (AnthropicProvider → claude-sonnet-4-5, OpenAIProvider
// → gpt-4o). The CLI doesn't expose model selection, so pricing by provider is
// tied to the models actually called. Source: Anthropic & OpenAI public pricing.
// Update alongside the provider default models in @buildstory/core.
export const LLM_PRICE_PER_1M: Record<Provider, { input: number; output: number; model: string }> = {
  anthropic: { input: 3, output: 15, model: 'claude-sonnet-4-5' },
  openai: { input: 2.5, output: 10, model: 'gpt-4o' },
}

/** Usage-based LLM cost at configured rates; not a provider billing receipt. */
export function llmCostUSD(provider: Provider, usage: UsageStats): number {
  const p = LLM_PRICE_PER_1M[provider]
  return (usage.inputTokens / 1_000_000) * p.input + (usage.outputTokens / 1_000_000) * p.output
}

/** Reserve conservatively from the exact serialized request, including schema.
 * UTF-8 byte count avoids the chars/4 undercount for code and non-English text.
 * Provider framing still makes this a local estimate, not a billing guarantee. */
export function reserveLLM(budget: SpendBudget | undefined, provider: Provider, model: string, request: unknown, maxOutput: number) {
  if (!budget) return undefined
  const price = LLM_PRICE_PER_1M[provider]
  if (model !== price.model) throw new Error(`No budget pricing configured for model ${model}`)
  const input = Buffer.byteLength(JSON.stringify(request), 'utf8') + 4096
  return budget.reserve('LLM request', (input * price.input + maxOutput * price.output) / 1_000_000)
}
