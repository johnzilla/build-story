import { SpendBudget } from '@buildstory/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises'
import { EventEmitter } from 'node:events'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { adaptStoryArc } from '../adapter.js'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { StoryArc } from '@buildstory/core'
import { renderWithHeyGen } from '../api.js'

vi.mock('node:child_process', () => ({ spawn: vi.fn() }))

const arc: StoryArc = {
  version: '1',
  beats: [{ type: 'idea', title: 'A decision', summary: 'Keep the paid job.', evidence: [], sourceEventIds: [], significance: 2 }],
  metadata: { generatedAt: '', style: 'technical', sourceTimeline: 'test' },
}
const config = { apiKey: 'secret-test-key', avatarId: 'avatar', voiceId: 'voice' }
const submitted = () => Response.json({ data: { video_id: 'paid-123' }, error: null })
const completed = () => Response.json({ data: { video_id: 'paid-123', status: 'completed', video_url: 'https://example.com/video.mp4' } })
const video = () => new Response(new Uint8Array([1, 2, 3]))
const ignore = () => {}
let directory: string
let output: string

async function jobFiles() {
  return (await readdir(`${output}.parts`)).filter((name) => name.endsWith('.job.json'))
}
async function savedJob() {
  const name = (await jobFiles())[0]!
  return { path: join(`${output}.parts`, name), text: await readFile(join(`${output}.parts`, name), 'utf8') }
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'buildstory-jobs-'))
  output = join(directory, 'story.mp4')
  vi.stubGlobal('fetch', vi.fn())
  // Only accelerate the first poll sleep. File writes and streams remain real.
  const timer = globalThis.setTimeout
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((...args: Parameters<typeof setTimeout>) => {
    const [fn, delay, ...rest] = args
    return timer(fn, delay === 15_000 ? 0 : delay, ...rest)
  }) as typeof setTimeout)
})
afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await rm(directory, { recursive: true, force: true })
})

describe('paid job recovery with real disk state', () => {
  it('persists the ID before polling and resumes after timeout without another POST', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(submitted())
    await expect(renderWithHeyGen(arc, { ...config, timeoutSeconds: 0 }, output, ignore)).rejects.toThrow('Timeout')
    const record = await savedJob()
    expect(JSON.parse(record.text)).toMatchObject({ state: 'submitted', videoId: 'paid-123' })
    expect(record.text).not.toContain(config.apiKey)
    expect(record.text).not.toContain('Keep the paid job')
    vi.mocked(fetch).mockClear().mockResolvedValueOnce(completed()).mockResolvedValueOnce(video())
    await renderWithHeyGen(arc, config, output, ignore)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(vi.mocked(fetch).mock.calls[0]![0]).toContain('/videos/paid-123')
    expect(await readFile(output)).toEqual(Buffer.from([1, 2, 3]))
  })

  it('refreshes status and downloads the same paid job after a download failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(submitted()).mockResolvedValueOnce(completed())
      .mockResolvedValueOnce(new Response('', { status: 503 }))
    await expect(renderWithHeyGen(arc, config, output, ignore)).rejects.toThrow('Download failed')
    vi.mocked(fetch).mockClear().mockResolvedValueOnce(completed()).mockResolvedValueOnce(video())
    await renderWithHeyGen(arc, config, output, ignore)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(vi.mocked(fetch).mock.calls.every(([, init]) => init?.method !== 'POST')).toBe(true)
  })

  it('saves the ID before progress callbacks can interrupt the render', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(submitted())
    await expect(renderWithHeyGen(arc, config, output, (message) => {
      if (message.includes('video ID:')) throw new Error('Interrupted')
    })).rejects.toThrow('Interrupted')
    expect(JSON.parse((await savedJob()).text).videoId).toBe('paid-123')
  })

  it.each(['network', '5xx', 'malformed', 'empty-id', '4xx'])('does not retry or resubmit an uncertain %s response', async (fault) => {
    if (fault === 'network') vi.mocked(fetch).mockRejectedValueOnce(new Error('Connection lost'))
    else vi.mocked(fetch).mockResolvedValueOnce(
      fault === '5xx' ? new Response('Server error', { status: 502 })
        : fault === 'malformed' ? Response.json({ unexpected: true })
          : fault === 'empty-id' ? Response.json({ data: { video_id: '' }, error: null })
            : Response.json({ data: null, error: { code: 'denied', message: 'Rejected' } }, { status: 400 }),
    )
    await expect(renderWithHeyGen(arc, config, output, ignore)).rejects.toThrow('No automatic resubmission')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse((await savedJob()).text).state).toBe('submitting')
    vi.mocked(fetch).mockClear()
    await expect(renderWithHeyGen(arc, config, output, ignore)).rejects.toThrow('Check your HeyGen account')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('allows an uncertain submission to be recovered using a verified video ID', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Connection lost'))
    await expect(renderWithHeyGen(arc, config, output, ignore)).rejects.toThrow()
    const record = await savedJob()
    await writeFile(record.path, JSON.stringify({ ...JSON.parse(record.text), state: 'submitted', videoId: 'paid-123' }))
    vi.mocked(fetch).mockClear().mockResolvedValueOnce(completed()).mockResolvedValueOnce(video())
    await renderWithHeyGen(arc, config, output, ignore)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('fails closed on a corrupt job record', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(submitted())
    await expect(renderWithHeyGen(arc, { ...config, timeoutSeconds: 0 }, output, ignore)).rejects.toThrow()
    await writeFile((await savedJob()).path, '{broken')
    vi.mocked(fetch).mockClear()
    await expect(renderWithHeyGen(arc, config, output, ignore)).rejects.toThrow('no new job will be submitted')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not reuse jobs when dimensions change', async () => {
    vi.mocked(fetch).mockImplementation(async () => submitted())
    await expect(renderWithHeyGen(arc, { ...config, timeoutSeconds: 0 }, output, ignore)).rejects.toThrow('Timeout')
    await expect(renderWithHeyGen(arc, { ...config, width: 1920, height: 1080, timeoutSeconds: 0 }, output, ignore)).rejects.toThrow('Timeout')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(await jobFiles()).toHaveLength(2)
  })

  it('blocks a second submission while the first paid request is in flight', async () => {
    let release!: (response: Response) => void
    let started!: () => void
    const start = new Promise<void>((resolve) => { started = resolve })
    vi.mocked(fetch).mockImplementationOnce(() => {
      started()
      return new Promise<Response>((resolve) => { release = resolve })
    })
    const first = renderWithHeyGen(arc, { ...config, timeoutSeconds: 0 }, output, ignore).catch((error: unknown) => error)
    await start
    await expect(renderWithHeyGen(arc, config, output, ignore)).rejects.toThrow('No automatic resubmission')
    release(submitted())
    expect(await first).toBeInstanceOf(Error)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('keeps completed chunks when output assembly fails and reuses them without network calls', async () => {
    await mkdir(output)
    vi.mocked(fetch).mockResolvedValueOnce(submitted()).mockResolvedValueOnce(completed()).mockResolvedValueOnce(video())
    await expect(renderWithHeyGen(arc, config, output, ignore)).rejects.toThrow('Failed to write output')
    await rm(output, { recursive: true })
    vi.mocked(fetch).mockClear()
    await renderWithHeyGen(arc, config, output, ignore)
    expect(fetch).not.toHaveBeenCalled()
    expect(await readFile(output)).toEqual(Buffer.from([1, 2, 3]))
  })

  it('does not charge for a replacement of a legacy chunk without dimension verification', async () => {
    const chunk = adaptStoryArc(arc, { avatarId: config.avatarId, voiceId: config.voiceId, speed: 1 }).chunks[0]
    const key = createHash('sha1').update(JSON.stringify(chunk)).digest('hex').slice(0, 12)
    await mkdir(`${output}.parts`)
    await writeFile(join(`${output}.parts`, `chunk-0-${key}.mp4`), 'legacy video')
    await expect(renderWithHeyGen(arc, config, output, ignore)).rejects.toThrow('dimensions are unknown')
    expect(fetch).not.toHaveBeenCalled()
  })


  it('resumes a later chunk and retains both chunks across failed concatenation', async () => {
    const multiArc = { ...arc, beats: Array.from({ length: 11 }, () => ({ ...arc.beats[0]! })) }
    vi.mocked(fetch).mockResolvedValueOnce(submitted()).mockResolvedValueOnce(completed())
      .mockResolvedValueOnce(video()).mockResolvedValueOnce(submitted())
    await expect(renderWithHeyGen(multiArc, config, output, (message) => {
      if (message.startsWith('Chunk 2: submitted')) throw new Error('Interrupted after second submission')
    })).rejects.toThrow('Interrupted after second submission')
    vi.mocked(fetch).mockClear().mockResolvedValueOnce(completed()).mockResolvedValueOnce(video())
    vi.mocked(spawn).mockImplementationOnce(() => {
      const process = new EventEmitter()
      queueMicrotask(() => process.emit('close', 1))
      return process as ReturnType<typeof spawn>
    })
    await expect(renderWithHeyGen(multiArc, config, output, ignore)).rejects.toThrow('FFmpeg concat exited')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect((await readdir(`${output}.parts`)).filter((name) => name.endsWith('.mp4'))).toHaveLength(2)
    vi.mocked(fetch).mockClear()
    vi.mocked(spawn).mockImplementationOnce(() => {
      const process = new EventEmitter()
      queueMicrotask(() => process.emit('close', 0))
      return process as ReturnType<typeof spawn>
    })
    await renderWithHeyGen(multiArc, config, output, ignore)
    expect(fetch).not.toHaveBeenCalled()
    await expect(readdir(`${output}.parts`)).rejects.toMatchObject({ code: 'ENOENT' })
  })


  it('rejects a new paid chunk without creating an ambiguous submission marker', async () => {
    await expect(renderWithHeyGen(arc, config, output, ignore, new SpendBudget(0.01))).rejects.toThrow('--max-cost')
    expect(fetch).not.toHaveBeenCalled()
    expect(await jobFiles()).toHaveLength(0)
  })

  it('resumes a saved job with no new charge even when the budget cannot fund a new job', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(submitted())
    const firstBudget = new SpendBudget(2)
    await expect(renderWithHeyGen(arc, { ...config, timeoutSeconds: 0 }, output, ignore, firstBudget)).rejects.toThrow('Timeout')
    expect(firstBudget.snapshot()).toMatchObject([{ basis: 'estimate', usd: 0.99 }])
    vi.mocked(fetch).mockClear().mockResolvedValueOnce(completed()).mockResolvedValueOnce(video())
    const budget = new SpendBudget(0.01)
    await renderWithHeyGen(arc, config, output, ignore, budget)
    expect(budget.snapshot()).toMatchObject([{ basis: 'cached', usd: 0 }])
    expect(fetch).toHaveBeenCalledTimes(2)
  })

})
