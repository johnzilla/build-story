import { SpendBudget } from '@buildstory/core'
import { describe, expect, it, vi } from 'vitest'
import { generateSceneAudio, prepareSpeechText } from '../generate.js'
import type OpenAI from 'openai'

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(), mkdtemp: vi.fn().mockResolvedValue('/temporary'), rm: vi.fn(),
  writeFile: vi.fn(), rename: vi.fn(),
}))

describe('speech privacy boundary', () => {
  it('sends the previewed, sanitized text even when called directly', async () => {
    const create = vi.fn().mockRejectedValue(new Error('Stop after inspecting request'))
    const client = { audio: { speech: { create } } } as unknown as OpenAI
    const text = 'password="synthetic secret words" in /Users/private-person/repo'
    await expect(generateSceneAudio(client, text, '/unused.wav', { voice: 'nova', speed: 1 }))
      .rejects.toThrow('Stop after inspecting request')
    expect(create.mock.calls[0]![0].input).toBe(prepareSpeechText(text))
    expect(create.mock.calls[0]![0].input).not.toContain('synthetic secret words')
    expect(create.mock.calls[0]![0].input).not.toContain('/Users/private-person')
  })
})


it('reserves against actual outbound speech and blocks parallel requests over the cap', async () => {
  const budget = new SpendBudget(0.0001)
  const create = vi.fn().mockRejectedValue(new Error('Unknown outcome'))
  const client = { audio: { speech: { create } } } as unknown as OpenAI
  const options = { voice: 'nova', speed: 1, budget }
  const results = await Promise.allSettled([
    generateSceneAudio(client, 'one', '/unused.wav', options),
    generateSceneAudio(client, 'two', '/unused2.wav', options),
  ])
  expect(create).toHaveBeenCalledTimes(1)
  expect(results[1]).toMatchObject({ status: 'rejected', reason: { name: 'BudgetExceededError' } })
  expect(budget.snapshot()[0]?.usd).toBeCloseTo(0.00009)
})
