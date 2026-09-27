import { createHash } from 'node:crypto'
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SpendBudget } from '@buildstory/core'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { StoryBeat } from '@buildstory/core'
import { wav } from './wav-fixture.js'

vi.mock('../generate.js', async (original) => ({
  ...await original<typeof import('../generate.js')>(),
  generateSceneAudio: vi.fn(async (_client: unknown, _text: string, path: string) => { await writeFile(path, wav()) }),
}))
vi.mock('openai', () => ({ default: vi.fn().mockImplementation(function () { return {} }) }))
import { generateSceneAudio } from '../generate.js'
import { orchestrateTTS } from '../index.js'

const gen = vi.mocked(generateSceneAudio)
const beat = (summary: string): StoryBeat => ({ type: 'idea', title: 't', summary, evidence: [], sourceEventIds: [], significance: 2 })
const opts = { voice: 'nova', speed: 1, apiKey: 'test-key', concurrency: 2 }
let out: string
const manifest = () => readFile(join(out, 'audio/manifest.json'), 'utf8').then(JSON.parse)
beforeEach(async () => { out = await mkdtemp(join(tmpdir(), 'buildstory-resume-')); gen.mockClear() })
afterEach(async () => { await rm(out, { recursive: true, force: true }) })

describe('TTS recovery with real disk state', () => {
  it('persists each scene and maintains frame timing', async () => {
    const progress: number[] = []
    const result = await orchestrateTTS(['one', 'two', 'three'].map(beat), out, opts, n => progress.push(n))
    expect(gen).toHaveBeenCalledTimes(3)
    expect(progress).toEqual([1, 2, 3])
    expect(result.scenes.map(s => s.startOffsetSeconds)).toEqual([1.2, 3.7, 6.2])
    expect(result.totalDurationSeconds).toBe(9.2)
    expect(Object.keys((await manifest()).entries)).toHaveLength(3)
  })

  it('reuses reordered and duplicated narration without paid calls', async () => {
    const first = await orchestrateTTS(['one', 'two'].map(beat), out, opts)
    gen.mockClear()
    const budget = new SpendBudget(0.000001)
    const result = await orchestrateTTS(['two', 'one', 'two'].map(beat), out, { ...opts, budget })
    expect(gen).not.toHaveBeenCalled()
    expect(result.scenes.map(s => s.filePath)).toEqual([first.scenes[1]!.filePath, first.scenes[0]!.filePath, first.scenes[1]!.filePath])
    expect(result.scenes.map(s => s.beatIndex)).toEqual([0, 1, 2])
    expect(budget.snapshot().every(e => e.basis === 'cached')).toBe(true)
  })

  it('shares identical concurrent scenes and persists both distinct entries without lost updates', async () => {
    await orchestrateTTS(['one', 'one', 'two', 'two'].map(beat), out, { ...opts, concurrency: 4 })
    expect(gen).toHaveBeenCalledTimes(2)
    expect(Object.keys((await manifest()).entries)).toHaveLength(2)
  })

  it.each(['text', 'voice', 'speed', 'model'])('invalidates the cache after changing %s', async change => {
    await orchestrateTTS([beat('one')], out, opts)
    gen.mockClear()
    await orchestrateTTS([beat(change === 'text' ? 'revised' : 'one')], out, {
      ...opts, ...(change === 'voice' ? { voice: 'alloy' } : {}), ...(change === 'speed' ? { speed: 1.2 } : {}), ...(change === 'model' ? { model: 'tts-1' as const } : {}),
    })
    expect(gen).toHaveBeenCalledOnce()
  })

  it.each(['missing', 'malformed', 'null', 'invalid duration'])('recovers intact files with a %s manifest', async fault => {
    await orchestrateTTS([beat('one')], out, opts)
    const path = join(out, 'audio/manifest.json')
    if (fault === 'missing') await rm(path)
    else if (fault === 'invalid duration') {
      const data = await manifest()
      for (const entry of Object.values(data.entries) as Array<{ durationSeconds: number }>) entry.durationSeconds = -10
      await writeFile(path, JSON.stringify(data))
    } else await writeFile(path, fault === 'null' ? 'null' : '{')
    gen.mockClear()
    const result = await orchestrateTTS([beat('one')], out, opts)
    expect(gen).not.toHaveBeenCalled()
    expect(result.scenes[0]!.durationSeconds).toBe(2)
  })

  it.each(['truncated', 'changed samples'])('rejects a %s WAV even when a valid manifest exists', async fault => {
    const first = await orchestrateTTS([beat('one')], out, opts)
    const bytes = wav()
    bytes[50] = 123
    await writeFile(first.scenes[0]!.filePath, fault === 'truncated' ? bytes.subarray(0, 100) : bytes)
    gen.mockClear()
    await orchestrateTTS([beat('one')], out, opts)
    expect(gen).toHaveBeenCalledOnce()
  })

  it('checkpoints successful in-flight scenes when another scene fails', async () => {
    gen.mockImplementationOnce(async (_c, _t, path) => { await writeFile(path, wav()) }).mockRejectedValueOnce(new Error('speech failed'))
    await expect(orchestrateTTS(['one', 'two', 'three'].map(beat), out, opts)).rejects.toThrow('speech failed')
    expect(Object.keys((await manifest()).entries)).toHaveLength(1)
    gen.mockClear()
    await orchestrateTTS(['one', 'two', 'three'].map(beat), out, opts)
    expect(gen.mock.calls.map(call => call[1])).toEqual(['two', 'three'])
  })

  it('reports manifest-write failures and reuses the completed WAV on retry', async () => {
    gen.mockImplementationOnce(async (_c, _t, path) => {
      await writeFile(path, wav())
      await mkdir(join(out, 'audio/manifest.json'))
    })
    await expect(orchestrateTTS([beat('one')], out, opts)).rejects.toThrow()
    await rm(join(out, 'audio/manifest.json'), { recursive: true })
    gen.mockClear()
    await orchestrateTTS([beat('one')], out, opts)
    expect(gen).not.toHaveBeenCalled()
  })

  it('migrates a valid legacy scene at another index without resynthesis', async () => {
    const hash = createHash('sha1').update('nova\x001\x00tts-1-hd\x00one').digest('hex').slice(0, 12)
    await mkdir(join(out, 'audio'))
    await writeFile(join(out, 'audio', `scene-009-${hash}.wav`), wav())
    await orchestrateTTS([beat('one')], out, opts)
    expect(gen).not.toHaveBeenCalled()
    expect((await manifest()).version).toBe('2')
  })

  it('does not migrate pre-splitting long narration that may have been truncated', async () => {
    const summary = 'Long narration. '.repeat(300)
    const hash = createHash('sha1').update(`nova\x001\x00tts-1-hd\x00${summary}`).digest('hex').slice(0, 12)
    await mkdir(join(out, 'audio'))
    await writeFile(join(out, 'audio', `scene-000-${hash}.wav`), wav())
    await orchestrateTTS([beat(summary)], out, opts)
    expect(gen).toHaveBeenCalledOnce()
  })
})
