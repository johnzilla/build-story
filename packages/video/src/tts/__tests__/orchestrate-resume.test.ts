import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { StoryBeat } from '@buildstory/core'

// Shared in-memory "disk" (hoisted so the fs mock factory can reference it).
const { disk } = vi.hoisted(() => ({ disk: new Map<string, string>() }))

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(async () => {}),
  stat: vi.fn(async (p: string) => {
    const c = disk.get(p)
    if (c === undefined) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    return { isFile: () => true, size: c.length }
  }),
  readFile: vi.fn(async (p: string) => {
    const c = disk.get(p)
    if (c === undefined) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    return c
  }),
  writeFile: vi.fn(async (p: string, c: string) => {
    disk.set(p, String(c))
  }),
}))

// generateSceneAudio "writes" the WAV into the fake disk; measure returns a fixed
// duration. Both are spies so we can assert reuse (no calls on a resumed run).
const genMock = vi.fn(async (_client: unknown, _text: string, filePath: string) => {
  disk.set(filePath, 'WAVDATA')
})
const measureMock = vi.fn(async () => 2)

vi.mock('../generate.js', () => ({ generateSceneAudio: genMock }))
vi.mock('../measure.js', () => ({ measureAudioDuration: measureMock }))
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function () {
    return {}
  }),
}))

const { orchestrateTTS } = await import('../index.js')

const beat = (summary: string): StoryBeat => ({
  type: 'idea',
  title: 't',
  summary,
  evidence: [],
  sourceEventIds: [],
  significance: 2,
})

const opts = { voice: 'nova', speed: 1, apiKey: 'test-key', concurrency: 2 }

describe('orchestrateTTS resume manifest', () => {
  beforeEach(() => {
    disk.clear()
    genMock.mockClear()
    measureMock.mockClear()
  })

  it('first run synthesizes every scene and writes a manifest', async () => {
    const beats = [beat('one'), beat('two'), beat('three')]
    const manifest = await orchestrateTTS(beats, '/out', opts)

    expect(genMock).toHaveBeenCalledTimes(3)
    expect(measureMock).toHaveBeenCalledTimes(3)
    expect(manifest.scenes).toHaveLength(3)
    // A manifest.json was written into the audio dir.
    expect(disk.has('/out/audio/manifest.json')).toBe(true)
  })

  it('second, identical run reuses every scene — no TTS calls, no ffprobe', async () => {
    const beats = [beat('one'), beat('two'), beat('three')]
    await orchestrateTTS(beats, '/out', opts)
    genMock.mockClear()
    measureMock.mockClear()

    const manifest = await orchestrateTTS(beats, '/out', opts)

    // Full reuse from disk + manifest.
    expect(genMock).not.toHaveBeenCalled()
    expect(measureMock).not.toHaveBeenCalled()
    expect(manifest.scenes).toHaveLength(3)
    expect(manifest.scenes[0]?.durationSeconds).toBe(2)
  })

  it('regenerates only the scene whose beat text changed (content-safe)', async () => {
    const beats = [beat('one'), beat('two'), beat('three')]
    await orchestrateTTS(beats, '/out', opts)
    genMock.mockClear()
    measureMock.mockClear()

    // Edit the middle beat — its content hash changes, so only it regenerates.
    const edited = [beat('one'), beat('two — revised'), beat('three')]
    await orchestrateTTS(edited, '/out', opts)

    expect(genMock).toHaveBeenCalledTimes(1)
    expect(genMock.mock.calls[0]?.[1]).toBe('two — revised')
  })

  it('reuses an on-disk scene from a failed run even without a manifest (measures it)', async () => {
    const beats = [beat('one'), beat('two')]
    // First run writes files + manifest.
    await orchestrateTTS(beats, '/out', opts)
    // Simulate a crash that left the WAVs but lost the manifest.
    disk.delete('/out/audio/manifest.json')
    genMock.mockClear()
    measureMock.mockClear()

    await orchestrateTTS(beats, '/out', opts)

    // No re-synthesis (paid) — the audio is on disk — but re-measured (free),
    // since the cached durations were lost with the manifest.
    expect(genMock).not.toHaveBeenCalled()
    expect(measureMock).toHaveBeenCalledTimes(2)
  })
})
