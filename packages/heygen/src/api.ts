import { writeFile, unlink, rename, copyFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
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

  const response = await pRetry(
    () =>
      fetch('https://api.heygen.com/v2/video/generate', {
        method: 'POST',
        headers: {
          'X-Api-Key': opts.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }),
    {
      retries: 3,
      shouldRetry: (err) => !(err instanceof HeyGenApiError),
    },
  )

  const json = await response.json()
  const parsed = HeyGenSubmitResponseSchema.parse(json)

  if (parsed.error || !parsed.data) {
    const code = parsed.error?.code ?? String(response.status)
    const msg = parsed.error?.message ?? 'Unknown error'
    // Error code 400140 = daily rate limit — terminal, never retry
    // Any 4xx is terminal; 5xx and network errors are retried by pRetry
    throw new HeyGenApiError(code, msg)
  }

  return parsed.data.video_id
}

// ---------------------------------------------------------------------------
// fetchVideoStatus (internal helper)
// ---------------------------------------------------------------------------

async function fetchVideoStatus(videoId: string, apiKey: string) {
  const response = await fetch(`https://api.heygen.com/v2/videos/${videoId}`, {
    headers: { 'X-Api-Key': apiKey },
  })
  if (!response.ok) {
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

    const status = await fetchVideoStatus(videoId, opts.apiKey)
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
      return status.video_url!
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
  const response = await fetch(videoUrl)
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
  ffmpegBin = 'ffmpeg',
): Promise<void> {
  const listContent = chunkPaths.map((p) => `file '${p}'`).join('\n')
  const listPath = join(tmpdir(), `buildstory-concat-${Date.now()}.txt`)
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

  const completedChunks: Array<{ videoId: string; path: string }> = []

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!

    try {
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

      const tmpPath = join(tmpdir(), `chunk-${i}-${videoId}.mp4`)
      await downloadMp4(videoUrl, tmpPath)

      onProgress(`Chunk ${i + 1}: downloaded.`)

      completedChunks.push({ videoId, path: tmpPath })
    } catch (err) {
      // Per D-06: stop processing remaining chunks; preserve successful chunks; rethrow
      const successSummary = completedChunks
        .map((c) => `chunk video ID ${c.videoId} at ${c.path}`)
        .join(', ')

      const successMsg = completedChunks.length > 0
        ? ` Successful chunks preserved: [${successSummary}].`
        : ''

      throw new Error(
        `Chunk ${i + 1}/${chunks.length} failed: ${(err as Error).message}.${successMsg}`,
      )
    }
  }

  // Assemble final output
  if (completedChunks.length === 1) {
    // Single chunk — rename/copy to output path
    const singlePath = completedChunks[0]!.path
    try {
      await rename(singlePath, outputPath)
    } catch {
      // rename may fail across filesystems; fall back to copy + delete
      await copyFile(singlePath, outputPath)
      await unlink(singlePath).catch(() => {})
    }
  } else {
    // Multiple chunks — concat and clean up
    const chunkPaths = completedChunks.map((c) => c.path)
    await concatMp4s(chunkPaths, outputPath)

    // Per D-04: delete individual chunk MP4s after successful concat
    for (const p of chunkPaths) {
      await unlink(p).catch(() => {})
    }
  }

  return { videoPath: outputPath, warnings }
}
