import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { createProvider, narrate, scan } from '@buildstory/core'
import { preflightCheck, renderVideo } from '@buildstory/video'
import { run } from '../commands/run.js'
import { renderCommand } from '../commands/render.js'

vi.mock('os', async (original) => ({ ...await original<typeof import('os')>(), homedir: () => '/no-home-preflight-test' }))
vi.mock('../adapters/git-source.js', () => ({ createGitSource: async () => undefined }))
vi.mock('@buildstory/core', async (original) => ({
  ...await original<typeof import('@buildstory/core')>(),
  scan: vi.fn(async () => ({ version: '1', rootDir: '/demo', events: [], dateRange: { start: '', end: '' } })),
  createProvider: vi.fn(() => ({ getUsage: () => ({ calls: 0, inputTokens: 0, outputTokens: 0 }) })),
  narrate: vi.fn(async () => ({ version: '1', beats: [], metadata: {} })),
  format: vi.fn(async () => 'text'),
}))
vi.mock('@buildstory/video', async (original) => ({
  ...await original<typeof import('@buildstory/video')>(),
  preflightCheck: vi.fn(),
  orchestrateTTS: vi.fn(async () => ({ scenes: [], totalDurationSeconds: 2 })),
  renderVideo: vi.fn(),
}))
let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'buildstory-preflight-'))
  vi.clearAllMocks()
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
  vi.stubEnv('OPENAI_API_KEY', 'test-key')
  vi.stubEnv('HEYGEN_API_KEY', '')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.mocked(preflightCheck).mockResolvedValue({ ok: false, failures: ['Missing FFmpeg'] })
})
afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await rm(dir, { recursive: true, force: true })
})

it('rejects missing renderer prerequisites before creating a provider or narrating', async () => {
  await expect(run(dir, {})).rejects.toThrow('Missing FFmpeg')
  expect(createProvider).not.toHaveBeenCalled()
  expect(narrate).not.toHaveBeenCalled()
})

it('rejects missing HeyGen settings before narration', async () => {
  await expect(run(dir, { renderer: 'heygen' })).rejects.toThrow('HeyGen configuration missing')
  expect(narrate).not.toHaveBeenCalled()
})

it('checks output writeability before paid work', async () => {
  const blocked = join(dir, 'blocked')
  await writeFile(blocked, 'not a directory')
  await expect(run(dir, { output: blocked })).rejects.toThrow()
  expect(narrate).not.toHaveBeenCalled()
  expect(preflightCheck).not.toHaveBeenCalled()
})

it('discovers config in the target, honors configured output, and skips video prerequisites for text-only runs', async () => {
  await writeFile(join(dir, 'buildstory.toml'), 'provider = "openai"\nstyle = "overview"\noutputDir = "./configured"')
  const result = await run(dir, { skipVideo: true })
  expect(createProvider).toHaveBeenCalledWith(expect.objectContaining({ provider: 'openai', style: 'overview' }))
  expect(scan).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ rootDir: dir }), undefined, null)
  expect(result?.outputs).toHaveProperty('outline')
  const { readFile } = await import('node:fs/promises')
  expect(await readFile(join(dir, 'configured', basename(dir), 'outline.md'), 'utf8')).toBe('text')
  expect(preflightCheck).not.toHaveBeenCalled()
})

it('reuses the browser selected by the single early preflight', async () => {
  vi.mocked(preflightCheck).mockResolvedValue({ ok: true, failures: [], chromePath: '/verified/chrome' })
  await run(dir, {})
  expect(preflightCheck).toHaveBeenCalledTimes(1)
  expect(preflightCheck).toHaveBeenCalledBefore(vi.mocked(narrate))
  expect(renderVideo).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ browserExecutable: '/verified/chrome' }))
})

it.each(['remotion', 'heygen'])('keeps %s render dry runs offline without keys or installed tools', async (renderer) => {
  vi.stubEnv('OPENAI_API_KEY', '')
  const fetch = vi.fn(() => { throw new Error('Must remain offline') })
  vi.stubGlobal('fetch', fetch)
  try {
    const input = join(dir, 'arc.json')
    await writeFile(input, JSON.stringify({ version: '1', beats: [], metadata: { generatedAt: '', style: 'story', sourceTimeline: 'demo' } }))
    await renderCommand(input, { renderer, dryRun: true })
    expect(fetch).not.toHaveBeenCalled()
    expect(preflightCheck).not.toHaveBeenCalled()
    expect(renderVideo).not.toHaveBeenCalled()
  } finally { vi.unstubAllGlobals() }
})
