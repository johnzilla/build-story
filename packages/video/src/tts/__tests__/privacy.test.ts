import { describe, expect, it, vi } from 'vitest'
import { generateSceneAudio, prepareSpeechText } from '../generate.js'
import type OpenAI from 'openai'

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
