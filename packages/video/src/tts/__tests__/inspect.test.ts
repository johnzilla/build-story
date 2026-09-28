import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { StoryBeat } from '@buildstory/core'
import { inspectSpeechCache } from '../inspect.js'
import { audioKey, inspectWav } from '../cache.js'
import { ttsCostUSD } from '../pricing.js'
import { wav } from './wav-fixture.js'
vi.mock('openai', () => ({ default: function () { throw new Error('No API client allowed') } }))
let out: string
const opts = { voice: 'nova', speed: 1, model: 'tts-1-hd' as const }
const beat = (summary: string): StoryBeat => ({ type: 'idea', title: 'Title', summary, evidence: [], sourceEventIds: [], significance: 2 })
beforeEach(async () => { out = await mkdtemp(join(tmpdir(), 'storyboard-cache-')) })
afterEach(async () => { await rm(out, { recursive: true, force: true }) })
it('estimates unique missing speech without creating cache files or clients', async () => {
  const scenes = await inspectSpeechCache([beat('hello'), beat('hello'), beat('world')], out, opts)
  expect(scenes.map(s => s.incrementalCostUSD)).toEqual([ttsCostUSD(5), 0, ttsCostUSD(5)])
  expect(scenes.every(s => s.durationBasis === 'estimated')).toBe(true)
  expect(await readdir(out)).toEqual([])
})
it('measures reordered scene caches and rejects damaged audio', async () => {
  await mkdir(join(out, 'audio'))
  const key = audioKey('hello', opts), path = join(out, 'audio', `scene-${key}.wav`)
  await writeFile(path, wav(2.5))
  const manifest = JSON.stringify({ version: '2', entries: { [key]: inspectWav(wav(2.5)) } })
  await writeFile(join(out, 'audio/manifest.json'), manifest)
  const scenes = await inspectSpeechCache([beat('world'), beat('hello'), beat('hello')], out, opts)
  expect(scenes[1]).toMatchObject({ status: 'cached', durationSeconds: 2.5, durationBasis: 'measured', incrementalCostUSD: 0, audioPath: path })
  expect(await readFile(join(out, 'audio/manifest.json'), 'utf8')).toBe(manifest)
  await writeFile(path, wav(3))
  expect((await inspectSpeechCache([beat('hello')], out, opts))[0]?.status).toBe('missing')
})
it('recognizes cached chunks even when assembled scene is absent', async () => {
  await mkdir(join(out, 'audio/chunks'), { recursive: true })
  await writeFile(join(out, 'audio/chunks', `${audioKey('hello', opts)}.wav`), wav())
  expect((await inspectSpeechCache([beat('hello')], out, opts))[0]).toMatchObject({ status: 'partial', missingChunks: [], incrementalCostUSD: 0 })
})
it('uses speech overrides and invalidates cache with settings changes', async () => {
  await mkdir(join(out, 'audio'))
  await writeFile(join(out, 'audio', `scene-${audioKey('spoken', opts)}.wav`), wav())
  const beats = [{ ...beat('readable'), speechText: 'spoken' }]
  expect((await inspectSpeechCache(beats, out, opts))[0]?.status).toBe('cached')
  expect((await inspectSpeechCache(beats, out, { ...opts, speed: 1.2 }))[0]?.status).toBe('missing')
})
it('rejects invalid duration estimates', async () => {
  await expect(inspectSpeechCache([beat('hi')], out, { ...opts, speed: 0 })).rejects.toThrow('speed')
})
