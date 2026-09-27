import { beforeEach, expect, it, vi } from 'vitest'
import { rename, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import type OpenAI from 'openai'
import { SpendBudget } from '@buildstory/core'
import { generateSceneAudio, prepareSpeechChunks, prepareSpeechText } from '../generate.js'

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(), mkdtemp: vi.fn().mockResolvedValue('/scratch'),
  writeFile: vi.fn(), rename: vi.fn(), rm: vi.fn(),
}))
vi.mock('node:child_process', () => ({
  execFile: vi.fn((_bin: string, _args: string[], _options: unknown, callback: (error: Error | null, stdout: string, stderr: string) => void) => callback(null, '', '')),
}))
const create = vi.fn()
const client = { audio: { speech: { create } } } as unknown as OpenAI
const text = 'Sentence about a development decision. '.repeat(250)
const opts = { voice: 'nova', speed: 1 }
beforeEach(() => {
  vi.clearAllMocks()
  create.mockReset().mockResolvedValue({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer })
})

it('sends every previewed chunk and joins decoded WAVs before publishing the complete scene', async () => {
  const budget = new SpendBudget(1)
  await generateSceneAudio(client, text, "/output with spaces/John's scene.wav", { ...opts, budget })
  const chunks = prepareSpeechChunks(text)
  expect(create.mock.calls.map(([request]) => request.input)).toEqual(chunks)
  expect(chunks.join('')).toBe(prepareSpeechText(text))
  expect(execFile).toHaveBeenCalledTimes(chunks.length + 1)
  expect(writeFile).toHaveBeenCalledWith('/scratch/parts.txt', chunks.map((_, i) => `file 'part-${i}.wav'`).join('\n'))
  expect(rename).toHaveBeenCalledExactlyOnceWith('/scratch/complete.wav', "/output with spaces/John's scene.wav")
  expect(budget.snapshot().reduce((sum, entry) => sum + entry.usd, 0)).toBeCloseTo(text.length * 0.03 / 1000)
})

it('checks the budget for every chunk and never publishes a partial scene', async () => {
  const budget = new SpendBudget(0.15)
  await expect(generateSceneAudio(client, text, '/out.wav', { ...opts, budget })).rejects.toThrow('--max-cost')
  expect(create).toHaveBeenCalledTimes(1)
  expect(rename).not.toHaveBeenCalled()
  expect(rm).toHaveBeenCalledWith('/scratch', { recursive: true, force: true })
})

it('keeps an existing output untouched if a later speech request fails', async () => {
  create.mockResolvedValueOnce({ arrayBuffer: async () => new ArrayBuffer(3) }).mockRejectedValueOnce(new Error('Failed second chunk'))
  await expect(generateSceneAudio(client, text, '/existing.wav', opts)).rejects.toThrow('Failed second chunk')
  expect(create).toHaveBeenCalledTimes(2)
  expect(rename).not.toHaveBeenCalled()
})

it('does not run concatenation for a single speech chunk', async () => {
  await generateSceneAudio(client, 'Short narration.', '/out.wav', opts)
  expect(create).toHaveBeenCalledTimes(1)
  expect(execFile).toHaveBeenCalledTimes(1)
  expect(rename).toHaveBeenCalledWith('/scratch/part-0.wav', '/out.wav')
})

it('aborts a stalled speech body without retrying or publishing incomplete audio', async () => {
  vi.useFakeTimers()
  try {
    create.mockImplementationOnce(async (_request, options) => ({
      arrayBuffer: () => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
      }),
    }))
    const caught = generateSceneAudio(client, 'Short narration.', '/existing.wav', opts).catch(e => e)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(await caught).toMatchObject({ message: expect.stringContaining('timed out') })
    expect(create).toHaveBeenCalledOnce()
    expect(rename).not.toHaveBeenCalled()
    expect(rm).toHaveBeenCalledWith('/scratch', { recursive: true, force: true })
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})
