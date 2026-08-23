import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { stat } from 'node:fs/promises'
import type { StoryArc, StoryBeat } from '@buildstory/core'
import type { HeyGenConfig } from '../types.js'

// ---------------------------------------------------------------------------
// Mock all real filesystem + stream I/O.
//
// renderWithHeyGen interleaves real fs I/O (mkdtemp, writeFile, rename, rm) with
// faked poll timers. Real I/O settles on the libuv thread pool at times that do
// not line up with fake-timer advancement, which made this suite flaky (a
// different fault test failing on each run). Mocking every fs/stream touch turns
// the whole flow into microtask + fake-timer work, so timer draining is fully
// deterministic. concatMp4s/spawn is never reached — every fixture is a single
// chunk (≤10 beats) — so node:child_process needs no mock.
// ---------------------------------------------------------------------------
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(async () => {}),
  unlink: vi.fn(async () => {}),
  rename: vi.fn(async () => {}),
  copyFile: vi.fn(async () => {}),
  mkdir: vi.fn(async () => {}),
  rm: vi.fn(async () => {}),
  // Default: nothing on disk, so every chunk is freshly submitted. The resume
  // test overrides this to report an existing chunk file.
  stat: vi.fn(async () => {
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
  }),
}))

vi.mock('node:fs', () => ({
  createWriteStream: vi.fn(() => ({
    on: vi.fn(),
    once: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  })),
}))

vi.mock('node:stream/promises', () => ({
  pipeline: vi.fn(async () => {}),
}))

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const makeBeat = (overrides: Partial<StoryBeat> = {}): StoryBeat => ({
  type: 'idea',
  title: 'Test beat',
  summary: 'A short summary.',
  evidence: [],
  sourceEventIds: [],
  significance: 2,
  ...overrides,
})

const makeArc = (beats: StoryBeat[]): StoryArc => ({
  version: '1',
  beats,
  metadata: {
    generatedAt: '2026-01-01T00:00:00Z',
    style: 'technical',
    sourceTimeline: '/test',
  },
})

const defaultConfig: HeyGenConfig = {
  apiKey: 'test-api-key',
  avatarId: 'Monica_chair_front_public',
  voiceId: 'test-voice-id',
}

// With all fs/stream I/O mocked, the only remaining async gaps are microtasks
// and the faked poll sleeps. Interleave microtask draining with timer advancement
// so each poll cycle (and any pRetry backoff) is fully flushed.
async function flush(rounds = 20): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(300_000)
  }
}

function makeSuccessSubmitResponse(videoId = 'vid-123') {
  return new Response(
    JSON.stringify({ data: { video_id: videoId }, error: null }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

function makeErrorSubmitResponse(code: string, message: string) {
  return new Response(
    JSON.stringify({ data: null, error: { code, message } }),
    { status: 400, headers: { 'Content-Type': 'application/json' } },
  )
}

function makeStatusResponse(
  videoId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  extra: Record<string, unknown> = {},
) {
  return new Response(
    JSON.stringify({
      data: {
        video_id: videoId,
        status,
        ...extra,
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

// ---------------------------------------------------------------------------
// submitChunk tests
// ---------------------------------------------------------------------------

describe('submitChunk', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
  })

  it('returns video_id on successful submission (tested via renderWithHeyGen)', async () => {
    // submitChunk is an internal function; its behavior is verified via renderWithHeyGen
    // which calls it and returns videoPath on success.
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeSuccessSubmitResponse('vid-123'))
      .mockResolvedValueOnce(
        makeStatusResponse('vid-123', 'completed', { video_url: 'https://example.com/video.mp4' }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([0, 1, 2, 3]), {
          status: 200,
          headers: { 'Content-Type': 'video/mp4' },
        }),
      )

    const { renderWithHeyGen } = await import('../api.js')
    const arc = makeArc([makeBeat()])

    vi.useFakeTimers()
    const resultPromise = renderWithHeyGen(arc, defaultConfig, '/tmp/submit-test.mp4', () => {})
    await flush()
    vi.useRealTimers()

    const result = await resultPromise
    // First fetch call was the submit to HeyGen — video_id 'vid-123' was used
    expect(fetch).toHaveBeenCalledWith(
      'https://api.heygen.com/v2/video/generate',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.videoPath).toBe('/tmp/submit-test.mp4')
  })

  it('returns video_id "vid-123" when fetch returns success response', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeSuccessSubmitResponse('vid-123'))
      // poll response — completed immediately
      .mockResolvedValueOnce(
        makeStatusResponse('vid-123', 'completed', { video_url: 'https://example.com/video.mp4' }),
      )
      // download response
      .mockResolvedValueOnce(
        new Response(new Uint8Array([0, 1, 2, 3]), {
          status: 200,
          headers: { 'Content-Type': 'video/mp4' },
        }),
      )

    const { renderWithHeyGen } = await import('../api.js')
    const arc = makeArc([makeBeat()])

    vi.useFakeTimers()
    const resultPromise = renderWithHeyGen(arc, defaultConfig, '/tmp/test-output.mp4', () => {})
    // Advance timers past the first poll delay (15s)
    await flush()
    vi.useRealTimers()

    const result = await resultPromise
    expect(result.videoPath).toBe('/tmp/test-output.mp4')
  })

  it('throws HeyGenApiError on API error response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeErrorSubmitResponse('400140', 'Daily rate limit reached'))

    const { renderWithHeyGen } = await import('../api.js')
    const arc = makeArc([makeBeat()])

    await expect(renderWithHeyGen(arc, defaultConfig, '/tmp/out.mp4', () => {})).rejects.toThrow(
      Error,
    )
  })

  it('HeyGenApiError has correct code and message format', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeErrorSubmitResponse('400140', 'Daily rate limit reached'))

    const { renderWithHeyGen } = await import('../api.js')
    const arc = makeArc([makeBeat()])

    try {
      await renderWithHeyGen(arc, defaultConfig, '/tmp/out.mp4', () => {})
      expect.fail('Should have thrown')
    } catch (err) {
      // Error is wrapped in chunk failure message
      expect((err as Error).message).toContain('400140')
    }
  })
})

// ---

// ---------------------------------------------------------------------------
// pollUntilComplete tests
// ---------------------------------------------------------------------------

describe('pollUntilComplete', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns video_url when status becomes completed', async () => {
    const { renderWithHeyGen } = await import('../api.js')

    vi.mocked(fetch)
      // submit
      .mockResolvedValueOnce(makeSuccessSubmitResponse('v1'))
      // poll 1 — processing
      .mockResolvedValueOnce(makeStatusResponse('v1', 'processing'))
      // poll 2 — completed
      .mockResolvedValueOnce(
        makeStatusResponse('v1', 'completed', { video_url: 'https://example.com/video.mp4' }),
      )
      // download
      .mockResolvedValueOnce(
        new Response(new Uint8Array([0, 1]), {
          status: 200,
          headers: { 'Content-Type': 'video/mp4' },
        }),
      )

    const arc = makeArc([makeBeat()])
    const resultPromise = renderWithHeyGen(arc, defaultConfig, '/tmp/poll-test.mp4', () => {})

    // Advance past first poll delay (15s) then second (30s)
    await flush()
    await flush()
    vi.useRealTimers()

    const result = await resultPromise
    expect(result.videoPath).toBe('/tmp/poll-test.mp4')
  })

  it('throws HeyGenVideoError when status is failed', async () => {
    const { renderWithHeyGen } = await import('../api.js')

    vi.mocked(fetch)
      .mockResolvedValueOnce(makeSuccessSubmitResponse('v-fail'))
      .mockResolvedValueOnce(
        makeStatusResponse('v-fail', 'failed', { error: { code: 'ERR', message: 'Generation failed' } }),
      )

    const arc = makeArc([makeBeat()])
    // Attach rejection handler immediately to prevent unhandled rejection
    const resultPromise = renderWithHeyGen(arc, defaultConfig, '/tmp/fail-test.mp4', () => {})
    const caught = resultPromise.catch((e: unknown) => e)

    await flush()

    const err = await caught
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toContain('Generation failed')
  })

  it('throws HeyGenTimeoutError when deadline exceeded', async () => {
    const { renderWithHeyGen } = await import('../api.js')

    vi.mocked(fetch)
      .mockResolvedValueOnce(makeSuccessSubmitResponse('v-timeout'))
      // status returns pending forever
      .mockResolvedValue(makeStatusResponse('v-timeout', 'pending'))

    const configWithShortTimeout: HeyGenConfig = {
      ...defaultConfig,
      timeoutSeconds: 0,
    }

    const arc = makeArc([makeBeat()])
    // Attach rejection handler immediately to prevent unhandled rejection
    const resultPromise = renderWithHeyGen(arc, configWithShortTimeout, '/tmp/timeout-test.mp4', () => {})
    const caught = resultPromise.catch((e: unknown) => e)

    // With timeoutSeconds=0, deadline is already past before first poll
    await flush()

    const err = await caught
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toContain('app.heygen.com/videos')
  })

  it('calls onProgress on each poll cycle', async () => {
    const { renderWithHeyGen } = await import('../api.js')
    const onProgress = vi.fn()

    vi.mocked(fetch)
      .mockResolvedValueOnce(makeSuccessSubmitResponse('v-progress'))
      .mockResolvedValueOnce(makeStatusResponse('v-progress', 'processing'))
      .mockResolvedValueOnce(
        makeStatusResponse('v-progress', 'completed', { video_url: 'https://example.com/video.mp4' }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([0, 1]), {
          status: 200,
          headers: { 'Content-Type': 'video/mp4' },
        }),
      )

    const arc = makeArc([makeBeat()])
    const resultPromise = renderWithHeyGen(arc, defaultConfig, '/tmp/progress-test.mp4', onProgress)

    await flush()
    await flush()
    vi.useRealTimers()

    await resultPromise

    // onProgress is called for: submit, submitted+polling msg, poll cycles, download
    expect(onProgress).toHaveBeenCalled()
    const calls = onProgress.mock.calls.map((c: unknown[]) => c[0] as string)
    expect(calls.some((msg) => msg.includes('processing') || msg.includes('elapsed'))).toBe(true)
  })
})

// ---

// ---------------------------------------------------------------------------
// downloadMp4 tests
// ---------------------------------------------------------------------------

describe('downloadMp4', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
  })

  it('writes response body to file path when fetch succeeds', async () => {
    vi.mocked(fetch)
      // submit
      .mockResolvedValueOnce(makeSuccessSubmitResponse('v-dl'))
      // poll — completed immediately
      .mockResolvedValueOnce(
        makeStatusResponse('v-dl', 'completed', { video_url: 'https://example.com/video.mp4' }),
      )
      // download with non-empty body
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3, 4, 5]), {
          status: 200,
          headers: { 'Content-Type': 'video/mp4' },
        }),
      )

    const { renderWithHeyGen } = await import('../api.js')
    const arc = makeArc([makeBeat()])

    vi.useFakeTimers()
    const resultPromise = renderWithHeyGen(arc, defaultConfig, '/tmp/dl-test.mp4', () => {})
    await flush()
    vi.useRealTimers()

    const result = await resultPromise
    // If download succeeded, result.videoPath is set
    expect(result.videoPath).toBe('/tmp/dl-test.mp4')
  })
})

// ---

// ---------------------------------------------------------------------------
// renderWithHeyGen tests
// ---------------------------------------------------------------------------

describe('renderWithHeyGen', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
  })

  it('calls adaptStoryArc and submits chunks sequentially', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeSuccessSubmitResponse('v-seq'))
      .mockResolvedValueOnce(
        makeStatusResponse('v-seq', 'completed', { video_url: 'https://example.com/video.mp4' }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([0, 1, 2]), {
          status: 200,
          headers: { 'Content-Type': 'video/mp4' },
        }),
      )

    const { renderWithHeyGen } = await import('../api.js')
    const arc = makeArc([makeBeat(), makeBeat()])

    vi.useFakeTimers()
    const resultPromise = renderWithHeyGen(arc, defaultConfig, '/tmp/seq-test.mp4', () => {})
    await flush()
    vi.useRealTimers()

    const result = await resultPromise

    // 2 beats = 1 chunk (≤10 beats per chunk), so submit called once
    expect(fetch).toHaveBeenCalledTimes(3) // submit + poll + download
    expect(result.videoPath).toBe('/tmp/seq-test.mp4')
  })

  it('passes warnings from adapter through to result', async () => {
    const longSummary = 'x'.repeat(1501)
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeSuccessSubmitResponse('v-warn'))
      .mockResolvedValueOnce(
        makeStatusResponse('v-warn', 'completed', { video_url: 'https://example.com/video.mp4' }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([0, 1]), {
          status: 200,
          headers: { 'Content-Type': 'video/mp4' },
        }),
      )

    const { renderWithHeyGen } = await import('../api.js')
    const arc = makeArc([makeBeat({ summary: longSummary, title: 'Long Beat' })])

    vi.useFakeTimers()
    const resultPromise = renderWithHeyGen(arc, defaultConfig, '/tmp/warn-test.mp4', () => {})
    await flush()
    vi.useRealTimers()

    const result = await resultPromise
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('Long Beat')
  })

  it('validates config with HeyGenOptionsSchema — throws ZodError on empty apiKey', async () => {
    const { renderWithHeyGen } = await import('../api.js')
    const arc = makeArc([makeBeat()])
    const badConfig: HeyGenConfig = { apiKey: '', avatarId: 'x', voiceId: 'y' }

    await expect(renderWithHeyGen(arc, badConfig, '/tmp/zod-test.mp4', () => {})).rejects.toThrow()
  })

  it('result contains videoPath equal to the outputPath argument', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeSuccessSubmitResponse('v-path'))
      .mockResolvedValueOnce(
        makeStatusResponse('v-path', 'completed', { video_url: 'https://example.com/video.mp4' }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([0, 1]), {
          status: 200,
          headers: { 'Content-Type': 'video/mp4' },
        }),
      )

    const { renderWithHeyGen } = await import('../api.js')
    const arc = makeArc([makeBeat()])
    const outputPath = '/tmp/custom-output.mp4'

    vi.useFakeTimers()
    const resultPromise = renderWithHeyGen(arc, defaultConfig, outputPath, () => {})
    await flush()
    vi.useRealTimers()

    const result = await resultPromise
    expect(result.videoPath).toBe(outputPath)
  })
})

// ---------------------------------------------------------------------------
// HTTP hardening — fault injection (task 1.5)
// ---------------------------------------------------------------------------

describe('HTTP hardening (fault injection)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('surfaces a 5xx HTML error page instead of an opaque JSON parse error', async () => {
    // Submit always returns a 500 with an HTML body (not JSON). Fresh Response
    // per call — a Response body can only be read once, and submit retries.
    vi.mocked(fetch).mockImplementation(
      async () =>
        new Response('<html><body>502 Bad Gateway</body></html>', {
          status: 500,
          headers: { 'Content-Type': 'text/html' },
        }),
    )

    const { renderWithHeyGen } = await import('../api.js')
    const arc = makeArc([makeBeat()])
    const caught = renderWithHeyGen(arc, defaultConfig, '/tmp/5xx.mp4', () => {}).catch(
      (e: unknown) => e,
    )
    await flush()

    const err = await caught
    expect(err).toBeInstanceOf(Error)
    // Reports the HTTP status; never a raw "Unexpected token <" SyntaxError.
    expect((err as Error).message).toContain('500')
    expect((err as Error).message).not.toContain('Unexpected token')
  })

  it('passes an AbortSignal and fails a hung connection instead of hanging forever', async () => {
    // Never resolve, but honor the abort the timeout triggers.
    vi.mocked(fetch).mockImplementation(
      (_url, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason ?? new Error('aborted')),
          )
        }),
    )

    const { renderWithHeyGen } = await import('../api.js')
    const arc = makeArc([makeBeat()])
    const caught = renderWithHeyGen(arc, defaultConfig, '/tmp/hung.mp4', () => {}).catch(
      (e: unknown) => e,
    )
    await flush()

    const err = await caught
    expect(err).toBeInstanceOf(Error)
    // The submit fetch was invoked with an AbortSignal (timeout wiring present).
    const firstCall = vi.mocked(fetch).mock.calls[0]
    expect(firstCall?.[1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('fails clearly when status is completed but no video_url is returned', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeSuccessSubmitResponse('v-nourl'))
      // completed, but the payload omits video_url
      .mockResolvedValueOnce(makeStatusResponse('v-nourl', 'completed'))

    const { renderWithHeyGen } = await import('../api.js')
    const arc = makeArc([makeBeat()])
    const caught = renderWithHeyGen(arc, defaultConfig, '/tmp/nourl.mp4', () => {}).catch(
      (e: unknown) => e,
    )
    await flush()

    const err = await caught
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toContain('video_url')
  })
})

// ---------------------------------------------------------------------------
// Chunk resume (task 2.6) — a completed chunk left on disk by a failed run is
// reused instead of re-submitted, so a mid-render failure never re-bills HeyGen.
// ---------------------------------------------------------------------------

describe('chunk resume', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
  })

  it('reuses an already-rendered chunk on disk instead of re-submitting', async () => {
    // Report the content-keyed chunk file as already present and non-empty.
    vi.mocked(stat).mockResolvedValue({
      isFile: () => true,
      size: 1024,
    } as unknown as Awaited<ReturnType<typeof stat>>)

    const { renderWithHeyGen } = await import('../api.js')
    const arc = makeArc([makeBeat()])
    const progress: string[] = []

    const result = await renderWithHeyGen(arc, defaultConfig, '/tmp/resume.mp4', (m) =>
      progress.push(m),
    )

    // No network calls at all — the paid submit/poll/download were skipped.
    expect(fetch).not.toHaveBeenCalled()
    expect(result.videoPath).toBe('/tmp/resume.mp4')
    expect(progress.some((m) => m.includes('resume'))).toBe(true)
  })
})
