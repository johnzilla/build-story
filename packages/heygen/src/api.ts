import { concatMp4s } from './assembly.js'
import { consumeWithTimeout } from './http.js'
import { BudgetExceededError } from '@buildstory/core'
import { writeFile, unlink, rename, copyFile, mkdir, rm, stat, readFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { z } from 'zod'
import type { StoryArc, SpendBudget } from '@buildstory/core'
import type { HeyGenConfig, HeyGenScene } from './types.js'
import { HeyGenOptionsSchema } from './types.js'
import { adaptStoryArc } from './adapter.js'

// ---------------------------------------------------------------------------
// Zod response schemas — validate every HeyGen API response; never trust raw JSON
// ---------------------------------------------------------------------------

const HeyGenSubmitResponseSchema = z.object({
  data: z.object({ video_id: z.string().min(1) }).nullable(),
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

  // A lost response can still mean a paid job was accepted. Never retry POST.
  return consumeWithTimeout(
    'https://api.heygen.com/v2/video/generate',
    {
      method: 'POST',
      headers: { 'X-Api-Key': opts.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    SUBMIT_TIMEOUT_MS,
    async (response) => {
      const text = await response.text()
      let json: unknown
      try {
        json = JSON.parse(text)
      } catch {
        throw new Error(`HeyGen submit: HTTP ${response.status} (non-JSON response)`)
      }
      const parsed = HeyGenSubmitResponseSchema.parse(json)
      if (!response.ok || parsed.error || !parsed.data) {
        throw new HeyGenApiError(
          parsed.error?.code ?? String(response.status),
          parsed.error?.message ?? 'Submission did not return a successful job',
        )
      }
      return parsed.data.video_id
    },
  )
}

// ---------------------------------------------------------------------------
// fetchVideoStatus (internal helper)
// ---------------------------------------------------------------------------

async function fetchVideoStatus(videoId: string, apiKey: string, timeoutMs: number) {
  return consumeWithTimeout(
    `https://api.heygen.com/v2/videos/${encodeURIComponent(videoId)}`,
    { headers: { 'X-Api-Key': apiKey } },
    timeoutMs,
    async (response) => {
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
    },
  )
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

  const checkDeadline = () => {
    if (Date.now() >= deadline) {
      throw new HeyGenTimeoutError(
        `Timeout after ${opts.timeoutSeconds}s. Video ID: ${videoId} -- check status at https://app.heygen.com/videos/${videoId}`,
        videoId,
      )
    }
  }
  while (true) {
    checkDeadline()
    const delay = intervals[Math.min(attempt, intervals.length - 1)] ?? 120_000
    await sleep(Math.min(delay, deadline - Date.now()))
    checkDeadline()
    attempt++

    // All retry delays and response reads share the overall polling deadline.
    const readStatus = async () => {
      for (let retry = 0; ; retry++) {
        checkDeadline()
        try {
          return await fetchVideoStatus(videoId, opts.apiKey, Math.min(STATUS_TIMEOUT_MS, deadline - Date.now()))
        } catch (error) {
          checkDeadline()
          if (error instanceof HeyGenApiError || retry >= 2) throw error
          await sleep(Math.min(1000 * 2 ** retry, deadline - Date.now()))
        }
      }
    }
    const status = await readStatus()
    checkDeadline()
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
  try {
    await consumeWithTimeout(videoUrl, {}, DOWNLOAD_TIMEOUT_MS, async (response, signal) => {
      if (!response.ok || !response.body) throw new Error(`Download failed: HTTP ${response.status}`)
      await pipeline(Readable.fromWeb(response.body as NodeReadableStream), createWriteStream(destPath), { signal })
    })
  } catch (error) {
    await unlink(destPath).catch(() => {})
    throw error
  }
}

// ---------------------------------------------------------------------------
// renderWithHeyGen (public)
// ---------------------------------------------------------------------------

/** Hash the complete paid request, including dimensions. Legacy scene-only
 * cache files cannot prove their dimensions and are deliberately not reused. */
function chunkKey(scenes: HeyGenScene[], width: number, height: number): string {
  return createHash('sha256')
    .update(JSON.stringify({ video_inputs: scenes, dimension: { width, height } }))
    .digest('hex')
}

const JobSchema = z.discriminatedUnion('state', [
  z.object({ version: z.literal(1), key: z.string(), state: z.literal('submitting') }),
  z.object({ version: z.literal(1), key: z.string(), state: z.literal('submitted'), videoId: z.string().min(1) }),
])

async function readJob(path: string, key: string) {
  try {
    const job = JobSchema.parse(JSON.parse(await readFile(path, 'utf8')))
    if (job.key !== key) throw new Error('Request fingerprint does not match')
    return job
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw new Error(`Cannot read HeyGen job record ${path}; no new job will be submitted. ${(error as Error).message}`)
  }
}

function uncertainSubmission(path: string): Error {
  return new Error(`Submission outcome is uncertain. No automatic resubmission will be made. Check your HeyGen account before retrying. Recovery record: ${path}. If a job exists, set state to "submitted" and add its "videoId" to this record; otherwise remove the record only after confirming no job was created. Stop other renders using this output before recovery.`)
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
  budget?: SpendBudget,
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
  // content-keyed name; job records preserve paid IDs across failures.
  // Removed only on success.
  const partsDir = `${outputPath}.parts`
  await mkdir(partsDir, { recursive: true })

  const completedChunks: Array<{ path: string }> = []

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!
    const key = chunkKey(chunk, opts.width, opts.height)
    const chunkPath = join(partsDir, `chunk-${i}-${key}.mp4`)
    const jobPath = join(partsDir, `chunk-${i}-${key}.job.json`)

    try {
      if (await existingFile(chunkPath)) {
        budget?.reuse('HeyGen cached chunk')
        onProgress(`Chunk ${i + 1}/${chunks.length}: reusing already-rendered chunk (resume).`)
        completedChunks.push({ path: chunkPath })
        continue
      }

      const job = await readJob(jobPath, key)
      let videoId: string
      if (job?.state === 'submitting') throw uncertainSubmission(jobPath)
      if (job?.state === 'submitted') {
        budget?.reuse('HeyGen existing job')
        videoId = job.videoId
        onProgress(`Chunk ${i + 1}: resuming video ID ${videoId}.`)
      } else {
        const legacyKey = createHash('sha1').update(JSON.stringify(chunk)).digest('hex').slice(0, 12)
        const legacyPath = join(partsDir, `chunk-${i}-${legacyKey}.mp4`)
        if (await existingFile(legacyPath)) {
          throw new Error(`Legacy paid chunk found at ${legacyPath}, but its dimensions are unknown. No new job was submitted. Verify its content and dimensions before renaming it to ${chunkPath}, then rerun.`)
        }
        onProgress(`Submitting chunk ${i + 1}/${chunks.length} to HeyGen...`)
        // Exclusive creation prevents concurrent runs from both paying for this
        // request. A crash anywhere after this write leaves a blocking marker.
        // HeyGen does not provide a binding price before submission. Keep its
        // per-chunk reservation explicitly estimated, including minute rounding.
        const minutes = chunk.reduce((sum, scene) => sum + scene.voice.input_text.trim().split(/\s+/).length / (150 * (scene.voice.speed ?? 1)), 0)
        const estimate = Math.ceil(minutes) * 0.99
        const charge = budget?.reserve('HeyGen submission', estimate)
        try {
          await writeFile(jobPath, JSON.stringify({ version: 1, key, state: 'submitting' }), { flag: 'wx', mode: 0o600, flush: true })
        } catch (error) {
          charge?.settle(0, 'estimate')
          throw error
        }
        try {
          videoId = await submitChunk(chunk, opts)
          charge?.settle(estimate, 'estimate')
        } catch (error) {
          throw new Error(`${(error as Error).message}. ${uncertainSubmission(jobPath).message}`)
        }
        // Save the ID before callbacks, polling, or downloading can fail.
        try {
          const temporary = `${jobPath}.tmp`
          await writeFile(temporary, JSON.stringify({ version: 1, key, state: 'submitted', videoId }), { mode: 0o600, flush: true })
          await rename(temporary, jobPath)
        } catch (error) {
          throw new Error(`Paid job ${videoId} was accepted but its ID could not be saved to ${jobPath}. Record this videoId before retrying. ${(error as Error).message}`)
        }
        onProgress(`Chunk ${i + 1}: submitted (video ID: ${videoId}). Polling for completion...`)
      }

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
      if (err instanceof BudgetExceededError) throw err
      // Per D-06: stop on first failure; rethrow with context. partsDir is left
      // in place so the next run resumes from the chunks already completed.
      throw new Error(
        `Chunk ${i + 1}/${chunks.length} failed: ${(err as Error).message}`,
      )
    }
  }

  // Stage beside the saved chunks; publish only a complete assembled file.
  const assembledPath = join(partsDir, 'assembled.mp4')
  try {
    if (completedChunks.length === 1) {
      await copyFile(completedChunks[0]!.path, assembledPath)
    } else {
      await concatMp4s(completedChunks.map(c => c.path), assembledPath, partsDir)
    }

    await rename(assembledPath, outputPath)
  } catch (error) {
    await unlink(assembledPath).catch(() => {})
    throw new Error(`Failed to write output ${outputPath}: ${(error as Error).message}`)
  }

  // Success — remove the parts dir and all completed chunks / concat list.
  await rm(partsDir, { recursive: true, force: true }).catch(() => {})

  return { videoPath: outputPath, warnings }
}
