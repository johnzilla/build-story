import { writeFile, unlink, rename, copyFile, mkdir, rm, stat } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { z } from 'zod'
import pRetry from 'p-retry'
import type { StoryArc } from '@buildstory/core'
import type { HeyGenConfig, HeyGenScene } from './types.js'
import { HeyGenOptionsSchema } from './types.js'
import { adaptStoryArc } from './adapter.js'

// ---------------------------------------------------------------------------
// Zod response schemas — validate every HeyGen API response; never trust raw JSON
// ---------------------------------------------------------------------------

const HeyGenSubmitResponseSchema = z.object({
  data: z.object({ video_id: z.string() }).nullable(),
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
})

const HeyGenStatusResponseSchema = z.object({
  data: z.object({
    video_id: z.string(),
    status: z.enum(['pending', 'processing', 'completed', 'failed']),
    video_url: z.string().url().optional(),
    duration: z.number().optional(),
    error: z.object({ code: z.string(), message: z.string() }).nullable().optional(),
  }),
})

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class HeyGenApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(`HeyGen API error [${code}]: ${message}`)
    this.name = 'HeyGenApiError'
    this.code = code
  }
}

export class HeyGenTimeoutError extends Error {
  videoId: string

  constructor(message: string, videoId: string) {
    super(message)
    this.name = 'HeyGenTimeoutError'
    this.videoId = videoId
  }
}

export class HeyGenVideoError extends Error {
  videoId: string

  constructor(message: string, videoId: string) {
    super(message)
    this.name = 'HeyGenVideoError'
    this.videoId = videoId
  }
}

// ---------------------------------------------------------------------------
// Public result type
// ---------------------------------------------------------------------------

export interface HeyGenRenderResult {
  videoPath: string
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Per-request timeouts so a hung connection never stalls the pipeline forever.
const SUBMIT_TIMEOUT_MS = 30_000
const STATUS_TIMEOUT_MS = 30_000
const DOWNLOAD_TIMEOUT_MS = 300_000 // downloads can be large

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  // Manual controller + cleared timer (not AbortSignal.timeout) so no dangling
  // timer survives the request — aborts a hung connection, nothing more.
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, 'TimeoutError'))
  }, timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// submitChunk
// ---------------------------------------------------------------------------

async function submitChunk(
  scenes: HeyGenScene[],
  opts: { apiKey: string; width?: number; height?: number },
): Promise<string> {
  const body = {
    video_inputs: scenes,
    dimension: { width: opts.width ?? 1280, height: opts.height ?? 720 },
  }

  // Retry the whole request+parse. HeyGenApiError is terminal (4xx / structured
  // API error); everything else (5xx, non-JSON bodies, timeouts, network) retries.
  const data = await pRetry(
    async () => {
      const response = await fetchWithTimeout(
        'https://api.heygen.com/v2/video/generate',
        {
          method: 'POST',
          headers: { 'X-Api-Key': opts.apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        SUBMIT_TIMEOUT_MS,
      )

      // Read as text first, then try to parse — a 5xx often returns an HTML
      // error page, and calling .json() on that throws an opaque SyntaxError.
      const text = await response.text()
      let json: unknown
      try {
        json = JSON.parse(text)
      } catch {
        if (response.status >= 500) {
          throw new Error(`HeyGen submit: HTTP ${response.status} (non-JSON response)`)
        }
        throw new HeyGenApiError(String(response.status), `Non-JSON response (HTTP ${response.status})`)
      }

      const parsed = HeyGenSubmitResponseSchema.parse(json)
      if (parsed.error || !parsed.data) {
        // Structured API error (e.g. 400140 daily rate limit) — terminal.
        throw new HeyGenApiError(
          parsed.error?.code ?? String(response.status),
          parsed.error?.message ?? 'Unknown error',
        )
      }
      return parsed.data
    },
    {
      retries: 3,
      shouldRetry: (err) => !(err instanceof HeyGenApiError),
    },
  )

  return data.video_id
}

// ---------------------------------------------------------------------------
// fetchVideoStatus (internal helper)
// ---------------------------------------------------------------------------

async function fetchVideoStatus(videoId: string, apiKey: string) {
  const response = await fetchWithTimeout(
    `https://api.heygen.com/v2/videos/${videoId}`,
    { headers: { 'X-Api-Key': apiKey } },
    STATUS_TIMEOUT_MS,
  )
  if (!response.ok) {
    // 4xx is terminal; 5xx is transient and worth retrying by the caller.
    if (response.status >= 500) {
      throw new Error(`Status poll: HTTP ${response.status} ${response.statusText}`)
    }
    throw new HeyGenApiError(
      String(response.status),
      `Status poll failed: HTTP ${response.status} ${response.statusText}`,
    )
  }
  const json = await response.json()
  return HeyGenStatusResponseSchema.parse(json).data
}

// ---------------------------------------------------------------------------
// pollUntilComplete
// ---------------------------------------------------------------------------

async function pollUntilComplete(
  videoId: string,
  opts: { apiKey: string; timeoutSeconds: number },
  onProgress: (msg: string) => void,
): Promise<string> {
  const intervals = [15_000, 30_000, 60_000, 120_000] // ms; cap at 120s
  const deadline = Date.now() + opts.timeoutSeconds * 1000
  const submissionTime = Date.now()
  let lastStatus = ''
  let lastStatusChangeAt = Date.now()
  let attempt = 0
  let firstPoll = true

  while (true) {
    if (Date.now() >= deadline) {
      throw new HeyGenTimeoutError(
        `Timeout after ${opts.timeoutSeconds}s. Video ID: ${videoId} -- check status at https://app.heygen.com/videos/${videoId}`,
        videoId,
      )
    }
    const delay = intervals[Math.min(attempt, intervals.length - 1)] ?? 120_000
    await sleep(delay)
    attempt++

    // Retry transient status-poll failures (5xx, timeouts, network) a couple of
    // times before giving up; a 4xx (HeyGenApiError) is terminal.
    const status = await pRetry(() => fetchVideoStatus(videoId, opts.apiKey), {
      retries: 2,
      shouldRetry: (err) => !(err instanceof HeyGenApiError),
    })
    const elapsed = Math.round((Date.now() - submissionTime) / 1000)

    if (firstPoll) {
      firstPoll = false
      onProgress(
        `Estimated wait: ~10 minutes (HeyGen averages ~10 min per 1 min of video). Still processing... (${elapsed}s elapsed, status: ${status.status})`,
      )
    } else {
      onProgress(`Still processing... (${elapsed}s elapsed, status: ${status.status})`)
    }

    if (status.status === 'completed') {
      if (!status.video_url) {
        throw new HeyGenVideoError('Status is "completed" but no video_url was returned', videoId)
      }
      return status.video_url
    }

    if (status.status === 'failed') {
      throw new HeyGenVideoError(
        status.error?.message ?? 'Video generation failed',
        videoId,
      )
    }

    // Stuck detection: status unchanged for 10+ minutes
    if (status.status !== lastStatus) {
      lastStatus = status.status
      lastStatusChangeAt = Date.now()
    } else if (Date.now() - lastStatusChangeAt > 10 * 60 * 1000) {
      throw new HeyGenVideoError(
        `Video stuck at status "${status.status}" for 10+ minutes`,
        videoId,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// downloadMp4
// ---------------------------------------------------------------------------

async function downloadMp4(videoUrl: string, destPath: string): Promise<void> {
  const response = await fetchWithTimeout(videoUrl, {}, DOWNLOAD_TIMEOUT_MS)
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: HTTP ${response.status}`)
  }
  const dest = createWriteStream(destPath)
  await pipeline(Readable.fromWeb(response.body as NodeReadableStream), dest)
}

// ---------------------------------------------------------------------------
// concatMp4s
// ---------------------------------------------------------------------------

async function concatMp4s(
  chunkPaths: string[],
  outputPath: string,
  workDir: string,
  ffmpegBin = 'ffmpeg',
): Promise<void> {
  const listContent = chunkPaths.map((p) => `file '${p}'`).join('\n')
  const listPath = join(workDir, 'concat-list.txt')
  await writeFile(listPath, listContent)

  const args = ['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-y', outputPath]

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegBin, args, { stdio: 'pipe' })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg concat exited with code ${code}`))
    })
    proc.on('error', reject)
  })

  await unlink(listPath).catch(() => {})
}

// ---------------------------------------------------------------------------
// renderWithHeyGen (public)
// ---------------------------------------------------------------------------

/** A short content hash of a chunk's scenes — resume reuses a downloaded chunk
 * only when the arc that produced it is unchanged. */
function chunkKey(scenes: HeyGenScene[]): string {
  return createHash('sha1').update(JSON.stringify(scenes)).digest('hex').slice(0, 12)
}

/** True if a chunk file already exists and is non-empty (resumable from disk). */
async function existingFile(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath)
    return s.isFile() && s.size > 0
  } catch {
    return false
  }
}

export async function renderWithHeyGen(
  arc: StoryArc,
  config: HeyGenConfig,
  outputPath: string,
  onProgress: (msg: string) => void,
): Promise<HeyGenRenderResult> {
  // Validate at boundary — applies Zod defaults
  const opts = HeyGenOptionsSchema.parse(config)

  // Adapt the story arc into HeyGen scene chunks
  const adaptResult = adaptStoryArc(arc, {
    avatarId: opts.avatarId,
    voiceId: opts.voiceId,
    speed: opts.speed,
  })

  const { chunks, warnings } = adaptResult

  // Output-scoped parts dir (not the shared tmpdir, so no cross-run collision)
  // that PERSISTS across a failure. Each completed chunk lands here under a
  // content-keyed name; a re-run reuses matching chunks so a mid-render failure
  // never re-bills HeyGen for chunks already paid for. Removed only on success.
  const partsDir = `${outputPath}.parts`
  await mkdir(partsDir, { recursive: true })

  const completedChunks: Array<{ path: string }> = []

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!
    const chunkPath = join(partsDir, `chunk-${i}-${chunkKey(chunk)}.mp4`)

    try {
      if (await existingFile(chunkPath)) {
        onProgress(`Chunk ${i + 1}/${chunks.length}: reusing already-rendered chunk (resume).`)
        completedChunks.push({ path: chunkPath })
        continue
      }

      onProgress(`Submitting chunk ${i + 1}/${chunks.length} to HeyGen...`)

      const videoId = await submitChunk(chunk, {
        apiKey: opts.apiKey,
        width: opts.width,
        height: opts.height,
      })

      onProgress(
        `Chunk ${i + 1}: submitted (video ID: ${videoId}). Polling for completion...`,
      )

      const videoUrl = await pollUntilComplete(
        videoId,
        { apiKey: opts.apiKey, timeoutSeconds: opts.timeoutSeconds },
        onProgress,
      )

      // Download to a temp name, then atomically rename into the content-keyed
      // path so a partial download is never mistaken for a completed chunk.
      const partialPath = `${chunkPath}.partial`
      await downloadMp4(videoUrl, partialPath)
      await rename(partialPath, chunkPath)

      onProgress(`Chunk ${i + 1}: downloaded.`)

      completedChunks.push({ path: chunkPath })
    } catch (err) {
      // Per D-06: stop on first failure; rethrow with context. partsDir is left
      // in place so the next run resumes from the chunks already completed.
      throw new Error(
        `Chunk ${i + 1}/${chunks.length} failed: ${(err as Error).message}`,
      )
    }
  }

  // Assemble final output (into outputPath, outside partsDir).
  if (completedChunks.length === 1) {
    const singlePath = completedChunks[0]!.path
    try {
      await copyFile(singlePath, outputPath)
    } catch (err) {
      throw new Error(`Failed to write output ${outputPath}: ${(err as Error).message}`)
    }
  } else {
    const chunkPaths = completedChunks.map((c) => c.path)
    await concatMp4s(chunkPaths, outputPath, partsDir)
  }

  // Success — remove the parts dir and all completed chunks / concat list.
  await rm(partsDir, { recursive: true, force: true }).catch(() => {})

  return { videoPath: outputPath, warnings }
}
