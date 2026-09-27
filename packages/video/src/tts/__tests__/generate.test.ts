import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import type OpenAI from 'openai'
import { SpendBudget } from '@buildstory/core'
import { generateSceneAudio, prepareSpeechChunks } from '../generate.js'
import { inspectWav } from '../cache.js'
import { wav } from './wav-fixture.js'

vi.mock('node:child_process', () => ({ execFile: vi.fn() }))
const create = vi.fn()
const client = { audio: { speech: { create } } } as unknown as OpenAI
const text = Array.from({ length: 240 }, (_, i) => `Decision ${i}: we reviewed the alternatives before choosing an implementation. `).join('')
const opts = { voice: 'nova', speed: 1 }
let dir: string
let output: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "buildstory John's speech "))
  output = join(dir, 'scene.wav')
  create.mockReset().mockResolvedValue({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer })
  vi.mocked(execFile).mockReset().mockImplementation(((_bin: string, args: string[], _options: unknown, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
    const perform = async () => {
      const input = args[args.indexOf('-i') + 1]!
      let seconds = 2
      if (args.includes('concat')) {
        const list = await readFile(input, 'utf8')
        seconds = 0
        for (const line of list.split('\n')) {
          const file = line.slice(6, -1)
          seconds += inspectWav(await readFile(join(dirname(input), file)))!.durationSeconds
        }
      }
      await writeFile(args.at(-1)!, wav(seconds))
    }
    void perform().then(() => callback(null, '', ''), e => callback(e, '', ''))
  }) as typeof execFile)
})
afterEach(async () => { vi.useRealTimers(); await rm(dir, { recursive: true, force: true }) })

it('sends every chunk, retains validated chunks, and atomically publishes the complete scene', async () => {
  const budget = new SpendBudget(2)
  await generateSceneAudio(client, text, output, { ...opts, budget })
  const chunks = prepareSpeechChunks(text)
  expect(create.mock.calls.map(([request]) => request.input)).toEqual(chunks)
  expect(inspectWav(await readFile(output))!.durationSeconds).toBe(chunks.length * 2)
  expect((await readdir(join(dir, 'chunks'))).filter(p => p.endsWith('.wav'))).toHaveLength(chunks.length)
  expect(budget.snapshot().reduce((sum, entry) => sum + entry.usd, 0)).toBeCloseTo(text.length * 0.03 / 1000)
})

it('resumes completed chunks after a later request fails and leaves existing output untouched', async () => {
  await writeFile(output, 'previous video audio')
  create.mockResolvedValueOnce({ arrayBuffer: async () => new ArrayBuffer(3) }).mockRejectedValueOnce(new Error('second chunk failed'))
  await expect(generateSceneAudio(client, text, output, opts)).rejects.toThrow('second chunk failed')
  expect(await readFile(output, 'utf8')).toBe('previous video audio')
  expect((await readdir(join(dir, 'chunks'))).filter(p => p.endsWith('.wav'))).toHaveLength(1)
  create.mockClear()
  await generateSceneAudio(client, text, output, opts)
  expect(create.mock.calls.map(([request]) => request.input)).toEqual(prepareSpeechChunks(text).slice(1))
})

it('preserves chunks when the budget stops a later request', async () => {
  const budget = new SpendBudget(0.15)
  await expect(generateSceneAudio(client, text, output, { ...opts, budget })).rejects.toThrow('--max-cost')
  expect(create).toHaveBeenCalledOnce()
  expect((await readdir(join(dir, 'chunks'))).filter(p => p.endsWith('.wav'))).toHaveLength(1)
  await expect(readFile(output)).rejects.toMatchObject({ code: 'ENOENT' })
})

it('recovers all chunks without paid calls after final assembly fails', async () => {
  const implementation = vi.mocked(execFile).getMockImplementation()!
  vi.mocked(execFile).mockImplementation(((bin: string, args: string[], options: unknown, callback: (error: Error) => void) => {
    if (args.includes('concat')) callback(new Error('assembly failed'))
    else (implementation as unknown as (bin: string, args: string[], options: unknown, callback: (error: Error) => void) => void)(bin, args, options, callback)
  }) as typeof execFile)
  await expect(generateSceneAudio(client, text, output, opts)).rejects.toThrow('assembly failed')
  create.mockClear()
  vi.mocked(execFile).mockImplementation(implementation)
  await generateSceneAudio(client, text, output, { ...opts, budget: new SpendBudget(0.00001) })
  expect(create).not.toHaveBeenCalled()
})

it('validates chunk checksums and only regenerates the damaged chunk', async () => {
  await generateSceneAudio(client, text, output, opts)
  const file = (await readdir(join(dir, 'chunks'))).find(p => p.endsWith('.wav'))!
  const bytes = wav(); bytes[50] = 123
  await writeFile(join(dir, 'chunks', file), bytes)
  create.mockClear()
  await generateSceneAudio(client, text, output, opts)
  expect(create).toHaveBeenCalledOnce()
})

it('rejects invalid decoded audio without publishing a scene or completed chunk', async () => {
  vi.mocked(execFile).mockImplementation(((_bin: string, args: string[], _options: unknown, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
    void writeFile(args.at(-1)!, 'invalid WAV').then(() => callback(null, '', ''))
  }) as typeof execFile)
  await expect(generateSceneAudio(client, 'Short narration.', output, opts)).rejects.toThrow('WAV validation')
  expect(await readdir(join(dir, 'chunks'))).toEqual([])
  await expect(readFile(output)).rejects.toMatchObject({ code: 'ENOENT' })
})

it('aborts a stalled speech body without retrying or publishing incomplete audio', async () => {
  vi.useFakeTimers()
  let start!: () => void
  const started = new Promise<void>(resolve => { start = resolve })
  create.mockImplementationOnce(async (_request, options) => ({
    arrayBuffer: () => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
      start()
    }),
  }))
  const caught = generateSceneAudio(client, 'Short narration.', output, opts).catch(e => e)
  await started
  await vi.advanceTimersByTimeAsync(120_000)
  expect(await caught).toMatchObject({ message: expect.stringContaining('timed out') })
  expect(create).toHaveBeenCalledOnce()
  await expect(readFile(output)).rejects.toMatchObject({ code: 'ENOENT' })
  expect(vi.getTimerCount()).toBe(0)
})

it('recovers validated chunk files when their metadata was not saved', async () => {
  await generateSceneAudio(client, text, output, opts)
  for (const file of await readdir(join(dir, 'chunks'))) {
    if (file.endsWith('.json')) await rm(join(dir, 'chunks', file))
  }
  create.mockClear()
  await generateSceneAudio(client, text, output, opts)
  expect(create).not.toHaveBeenCalled()
})
