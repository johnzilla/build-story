# Phase 7: HeyGen API + CLI Integration - Research

**Researched:** 2026-04-15
**Domain:** HeyGen v2 REST API — async video submission, exponential-backoff polling, MP4 download, multi-chunk FFmpeg concatenation, CLI integration
**Confidence:** HIGH (codebase verified), MEDIUM (HeyGen API shapes — no live API call possible in research session)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use an `ora` spinner showing HeyGen's status text on each poll cycle (e.g., "Processing scene 3/8..."). Matches the existing Remotion render spinner pattern in `render.ts`.
- **D-02:** On timeout (default 600s from `HeyGenOptions.timeoutSeconds`), exit with a clear error including the HeyGen `video_id` and a direct URL to check status manually. Example: `Timeout after 600s. Video ID: abc123 — check status at https://app.heygen.com/videos/abc123`
- **D-03:** When `AdaptResult.chunks` has multiple entries, submit each chunk sequentially (one at a time, not parallel), download each completed MP4, then concatenate all chunk MP4s into a single output file using `fluent-ffmpeg` (already a dependency via `@buildstory/video`). _(Note: fluent-ffmpeg is archived — see Standard Stack for resolution.)_
- **D-04:** Delete individual chunk MP4 files after successful concatenation. User gets one clean final MP4. Chunks are temporary artifacts.
- **D-05:** Fail fast with an actionable error message on HeyGen API errors. No automatic retry. Print error code, error message, and suggest what to check.
- **D-06:** For multi-chunk arcs, if any chunk fails, stop submitting remaining chunks immediately. Report which chunks succeeded (with video IDs and downloaded files) and which failed. Keep downloaded MP4s for successful chunks.

### Claude's Discretion

- HeyGen v2 API client implementation details (HTTP client choice, request/response handling)
- Exponential backoff parameters for polling (initial interval, max interval, jitter)
- FFmpeg concat method (demuxer concat vs filter complex — demuxer is simpler for same-codec files)
- Where the API client module lives within `packages/heygen/src/`
- Temporary directory strategy for chunk downloads before concat

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HGVR-02 | HeyGen renderer submits a video generation request to HeyGen v2 API from a StoryArc | New `submit()` function calling `POST /v2/video/generate`; input is `HeyGenScene[][]` from existing `adaptStoryArc()` |
| HGVR-03 | HeyGen renderer polls for video completion with exponential backoff and configurable timeout | New `pollUntilComplete()` function; `p-retry` already in package.json for network errors; manual backoff loop for status polling |
| HGVR-04 | HeyGen renderer downloads completed MP4 to the standard output directory | `downloadMp4()` using Node `fetch` + `pipeline`; fresh URL on each poll per Pitfall 14 |
| CLI-08 | `--renderer=heygen` flag selects HeyGen renderer for render and run commands | Already wired in `render.ts` and `run.ts` — the placeholder at line 82 of render.ts is the only gap |
| CLI-09 | `buildstory.toml` supports `[video] renderer` and `[heygen]` section with avatar_id, voice_id | Already wired in `config.ts` — no CLI changes needed |

</phase_requirements>

---

## Summary

Phase 7 replaces a single `process.exit(1)` placeholder in `packages/cli/src/commands/render.ts` (line 82) and its parallel in `run.ts` (line 163) with the full HeyGen submission + polling + download flow. The surrounding infrastructure is already complete: preflight, cost estimation, dry-run, lazy install, config loading, and the `adaptStoryArc()` chunker from Phase 6 are all wired and tested.

The work is entirely contained in `packages/heygen/src/` — a new module (`api.ts` or `client.ts`) that calls the HeyGen v2 REST API using Node 22 native `fetch`, polls with exponential backoff, downloads MP4s, and (for multi-chunk arcs) concatenates them using a direct `child_process.spawn` call to FFmpeg rather than the archived `fluent-ffmpeg` library.

The key implementation risks are: (1) polling that is robust to both long waits and the known HeyGen stuck-at-33%/97% failure mode; (2) MP4 concatenation that handles the codec-mismatch edge case; and (3) clear error classification between retryable network errors and terminal API errors (rate limits, invalid avatar, etc.).

**Primary recommendation:** Add a single new file `packages/heygen/src/api.ts` implementing `submitChunk()`, `pollUntilComplete()`, and `downloadMp4()`. Wire these into a public `renderWithHeyGen()` function exported from `packages/heygen/src/index.ts`. The CLI replaces the `process.exit(1)` placeholder with a `renderWithHeyGen()` call and a spinner loop.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HeyGen API calls (submit, poll, download) | `@buildstory/heygen` package | — | Isolated from CLI concerns per established package boundary rules |
| CLI progress display (ora spinner) | `packages/cli` (render.ts / run.ts) | — | Spinner belongs in the CLI layer; heygen package accepts `onProgress` callback |
| Config loading (avatar_id, voice_id) | `packages/cli` (config.ts) | — | Already done — heygen package never reads TOML |
| MP4 concatenation | `packages/heygen/src/api.ts` | CLI output dir | Concat is part of the render result, not CLI UX |
| Temp file management | `packages/heygen/src/api.ts` | OS `os.tmpdir()` | Chunk MP4s live in temp dir until concat succeeds; then deleted |

---

## Standard Stack

### Core (Phase 7 — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node 22 native `fetch` | built-in | HeyGen REST API calls | [VERIFIED: codebase] Already declared runtime; no SDK or http client needed |
| `p-retry` | 6.2.1 (in package.json) | Exponential backoff on network errors | [VERIFIED: packages/heygen/package.json] Already installed; ESM, TypeScript types bundled |
| `zod` | 4.3.6 (in package.json) | Validate API response shapes | [VERIFIED: packages/heygen/package.json] Already installed; parse every HeyGen response |
| `ora` | existing in CLI | Spinner for poll progress | [VERIFIED: packages/cli/src/commands/render.ts] Already imported; same pattern as Remotion render |
| `child_process.spawn` | built-in | FFmpeg concat invocation | [VERIFIED: PITFALLS.md] `fluent-ffmpeg` is archived (May 2025); use direct spawn |
| `node:fs/promises` | built-in | File download write stream, temp dir ops | [VERIFIED: codebase pattern in render.ts] Standard pattern across CLI |
| `os.tmpdir()` | built-in | Temp directory for chunk MP4s before concat | [ASSUMED] Standard Node pattern |

### FFmpeg Binary Resolution

The concat step requires an FFmpeg binary. `ffmpeg-static` is a workspace dependency and the existing pattern in `@buildstory/video`. System FFmpeg is also available on this machine (v7.1.2).

| Method | How | Priority |
|--------|-----|----------|
| `process.env.FFMPEG_PATH` | User override | First |
| `ffmpeg-static` (workspace dep) | `require('ffmpeg-static')` path | Second |
| System `ffmpeg` in `PATH` | `ffmpeg` as command | Fallback |

Since `@buildstory/heygen` currently has no dependency on `ffmpeg-static`, the simplest path is to use the system `ffmpeg` binary via `child_process.spawn('ffmpeg', args)` and document that FFmpeg must be installed. Alternatively, import `ffmpeg-static` as a dev/peer dep — but that adds a ~60MB binary download to the heygen package unnecessarily given the project already has it in `@buildstory/video`. [ASSUMED] recommendation: use `process.env.FFMPEG_PATH ?? 'ffmpeg'` as the binary path, matching the `@buildstory/video` convention.

**No new packages need to be installed for Phase 7.** All required libraries are already present.

---

## Architecture Patterns

### System Architecture Diagram

```
render.ts / run.ts
    │
    ├── [preflight, cost, dry-run — already implemented]
    │
    └── renderWithHeyGen(arc, opts, onProgress)  ← NEW in packages/heygen/src/api.ts
            │
            ├── adaptStoryArc(arc, opts)   [existing — Phase 6]
            │     └── AdaptResult { chunks: HeyGenScene[][], warnings: string[] }
            │
            ├── FOR each chunk (sequential per D-03):
            │     │
            │     ├── submitChunk(chunk, opts)  → video_id
            │     │       POST /v2/video/generate
            │     │
            │     ├── pollUntilComplete(video_id, opts, onProgress)  → video_url
            │     │       GET /v2/videos/{video_id}   (exponential backoff)
            │     │       ora spinner updates on each poll cycle
            │     │       timeout → exit with video_id + manual check URL (D-02)
            │     │       chunk failure → keep prior MP4s, stop (D-06)
            │     │
            │     └── downloadMp4(video_url, tmpPath)  → local file path
            │             GET video_url → write to os.tmpdir()/{video_id}.mp4
            │
            └── [if chunks > 1] concatMp4s(chunkPaths, outputPath)
                    │   child_process.spawn('ffmpeg', concat-demuxer args)
                    └── delete chunk MP4s (D-04)
```

### Recommended Project Structure (new files only)

```
packages/heygen/src/
├── api.ts          ← NEW: submitChunk, pollUntilComplete, downloadMp4, concatMp4s, renderWithHeyGen
├── adapter.ts      ← existing (Phase 6)
├── cost.ts         ← existing (Phase 5)
├── preflight.ts    ← existing (Phase 5)
├── types.ts        ← existing; may add HeyGenVideoStatus type
├── index.ts        ← add export for renderWithHeyGen
└── __tests__/
    ├── adapter.test.ts   ← existing
    └── api.test.ts       ← NEW: unit tests with fetch mocked
```

### Pattern 1: HeyGen API Response Validation with Zod

Every response from the HeyGen API must be parsed through a Zod schema. Never trust raw JSON shapes.

```typescript
// Source: STACK.md v1.1 Addendum — request/response shapes
// packages/heygen/src/api.ts

import { z } from 'zod'

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
```

### Pattern 2: Exponential Backoff Polling Loop

Per decisions D-01, D-02 and Pitfall 10, polling must use exponential backoff and heartbeat logging.

```typescript
// Source: PITFALLS.md §Pitfall 10 — polling strategy
// packages/heygen/src/api.ts

async function pollUntilComplete(
  videoId: string,
  opts: { apiKey: string; timeoutSeconds: number },
  onProgress: (msg: string) => void,
): Promise<string> {
  const intervals = [15_000, 30_000, 60_000, 120_000] // ms; cap at 120s
  const deadline = Date.now() + opts.timeoutSeconds * 1000
  let lastStatus = ''
  let lastStatusChangeAt = Date.now()
  let attempt = 0

  while (Date.now() < deadline) {
    const delay = intervals[Math.min(attempt, intervals.length - 1)] ?? 120_000
    await sleep(delay)
    attempt++

    const status = await fetchVideoStatus(videoId, opts.apiKey)
    const elapsed = Math.round((Date.now() - /* submission time */ 0) / 1000)
    onProgress(`Still processing... (${elapsed}s elapsed, status: ${status.status})`)

    if (status.status === 'completed') {
      return status.video_url! // validated by Zod schema
    }
    if (status.status === 'failed') {
      throw new HeyGenVideoError(status.error?.message ?? 'Video generation failed', videoId)
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

  throw new HeyGenTimeoutError(
    `Timeout after ${opts.timeoutSeconds}s. Check status at https://app.heygen.com/videos/${videoId}`,
    videoId,
  )
}
```

### Pattern 3: FFmpeg Concat Demuxer (no fluent-ffmpeg)

`fluent-ffmpeg` was archived May 2025 (Pitfall 1). Use `child_process.spawn` directly.

```typescript
// Source: PITFALLS.md §Pitfall 1 — direct spawn pattern
// packages/heygen/src/api.ts

import { writeFile, unlink } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

async function concatMp4s(chunkPaths: string[], outputPath: string): Promise<void> {
  // Build concat list file for FFmpeg demuxer
  const listContent = chunkPaths.map((p) => `file '${p}'`).join('\n')
  const listPath = join(tmpdir(), `buildstory-concat-${Date.now()}.txt`)
  await writeFile(listPath, listContent)

  const ffmpegBin = process.env['FFMPEG_PATH'] ?? 'ffmpeg'
  const args = [
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    '-c', 'copy',      // no re-encode — same codec from HeyGen
    '-y',              // overwrite output
    outputPath,
  ]

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegBin, args, { stdio: 'pipe' })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg concat exited with code ${code}`))
    })
    proc.on('error', reject)
  })

  // Cleanup list file
  await unlink(listPath).catch(() => {})
}
```

### Pattern 4: Download with Immediate Write (no URL caching)

Per Pitfall 14, `video_url` is a presigned S3 URL — fetch and write immediately without caching.

```typescript
// Source: PITFALLS.md §Pitfall 14
// packages/heygen/src/api.ts

import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

async function downloadMp4(videoUrl: string, destPath: string): Promise<void> {
  const response = await fetch(videoUrl)
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: HTTP ${response.status}`)
  }
  const dest = createWriteStream(destPath)
  await pipeline(Readable.fromWeb(response.body as ReadableStream), dest)
}
```

### Pattern 5: API Error Classification (no retry on 400s)

Per Pitfall 13 and D-05, classify errors before deciding whether to retry.

```typescript
// Error code 400140 = daily rate limit — terminal, never retry
// Any 4xx from /v2/video/generate = terminal (invalid avatar/voice, quota)
// 5xx or network error = retryable (handled by p-retry on the fetch call)

function classifyHeyGenError(httpStatus: number, errorCode: string): 'terminal' | 'retryable' {
  if (errorCode === '400140') return 'terminal' // daily rate limit
  if (httpStatus >= 400 && httpStatus < 500) return 'terminal'
  return 'retryable'
}
```

### Pattern 6: Spinner Handoff (CLI layer)

The CLI owns the spinner; `renderWithHeyGen` accepts an `onProgress` callback. This keeps `@buildstory/heygen` free of any CLI imports.

```typescript
// packages/cli/src/commands/render.ts — replaces the process.exit(1) at line 82

const { renderWithHeyGen } = await import('@buildstory/heygen')

const outputDir = resolve(opts.output, projectName)
await mkdir(outputDir, { recursive: true })
const outputPath = resolve(outputDir, `${projectName}.mp4`)

const heygenOpts = HeyGenOptionsSchema.parse({
  apiKey: process.env['HEYGEN_API_KEY'] ?? '',
  avatarId: config.heygen?.avatarId ?? '',
  voiceId: config.heygen?.voiceId ?? '',
  // width, height, speed, timeoutSeconds pick up Zod defaults
})

const spinner = ora('Submitting to HeyGen...').start()

const result = await renderWithHeyGen(storyArc, heygenOpts, outputPath, (msg: string) => {
  spinner.text = msg
})

spinner.succeed(chalk.green(`HeyGen render complete`))
console.log(`  Video: ${result.videoPath}`)
```

### Anti-Patterns to Avoid

- **Importing `fluent-ffmpeg`:** Archived May 2025. Use `child_process.spawn` directly (see Pattern 3).
- **Caching `video_url` across polls:** Presigned URLs expire. Always use the URL from the most recent status call (Pattern 4).
- **Retrying `400140` error:** Daily rate limit is terminal — not a transient condition (Pattern 5).
- **Importing anything from `@buildstory/video`:** The heygen package must have zero Remotion/canvas/sharp deps (Pitfall 16).
- **Using `AudioManifest` in HeyGen renderer:** HeyGen does its own TTS internally — no local audio files are involved.
- **Parallel chunk submission:** Sequential only (D-03) to avoid rate limiting and simplify partial-failure handling.
- **Logging `video_id` only after polling:** Log `video_id` immediately after submission so the user can recover manually if the process dies during polling.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Network-error retry on API calls | Custom retry loop | `p-retry` (already installed) | Handles backoff, max attempts, error classification correctly |
| HeyGen status polling | Custom setTimeout loop | Plain `while` + `sleep()` helper is fine — but add stuck detection | p-retry is for network errors, not status transitions |
| FFmpeg invocation | `fluent-ffmpeg` | `child_process.spawn` with explicit args array | fluent-ffmpeg archived May 2025 |
| HeyGen REST calls | Any SDK (`@teamduality/heygen-typescript-sdk`) | Node 22 native `fetch` | No official Node SDK; community SDK unmaintained |
| Response validation | TypeScript `as HeyGenResponse` cast | Zod schema parse | Runtime safety; LLM-style trust boundary applies here too |

**Key insight:** The HeyGen API surface for Phase 7 is exactly 3 endpoints (generate, status, download via URL). The total API client is ~150 lines of typed fetch calls + Zod parsing. No abstraction layer needed.

---

## Common Pitfalls

### Pitfall A: Polling Without Stuck-State Detection — Hangs Forever

**What goes wrong:** `pending` → `processing` → stuck at 33% or 97% (known HeyGen failure mode). Status never changes. Polling loop runs until timeout (10 minutes by default) while user watches a spinner.
**Why it happens:** Simple `while (status !== 'completed')` loop with no change detection.
**How to avoid:** Track last-seen status + timestamp. If unchanged for 10+ minutes, treat as failed. Log `video_id` and exit with non-zero code (see Pattern 2).
**Warning signs:** No `lastStatusChangeAt` tracking in polling loop.

### Pitfall B: Caching `video_url` Across Poll Iterations

**What goes wrong:** `video_url` is a presigned S3 URL with a short TTL. Caching it and downloading later produces a 403.
**Why it happens:** Status response parsed once, URL saved to variable, download attempted after additional processing.
**How to avoid:** Download immediately when status transitions to `completed`. Use the URL from that specific poll response, not a stored copy (see Pattern 4).
**Warning signs:** `video_url` assigned to an outer-scope variable before download.

### Pitfall C: Treating 400 Rate Limit as Retryable

**What goes wrong:** Error code `400140` (daily rate limit) triggers retry logic. CLI loops against a non-resolvable condition for minutes.
**Why it happens:** Generic "retry all 4xx" pattern.
**How to avoid:** Check error code explicitly. `400140` is terminal — exit with "Daily rate limit reached. Wait 24 hours." (see Pattern 5).
**Warning signs:** Retry logic doesn't branch on `error.code`.

### Pitfall D: `fluent-ffmpeg` Import for Concat

**What goes wrong:** Build fails or produces unmaintained-behavior warnings. Concat may silently break when FFmpeg updates its argument interface.
**Why it happens:** `fluent-ffmpeg` appears in workspace via `@buildstory/video` — available on disk without being declared in `@buildstory/heygen`.
**How to avoid:** Never import `fluent-ffmpeg` in `packages/heygen`. Use direct `spawn` with explicit args. Add `@buildstory/video` to the pnpm phantom-dep watchlist.
**Warning signs:** `fluent-ffmpeg` in any import in `packages/heygen/src/`.

### Pitfall E: HeyGen Processing Time Surprise (No Estimated Wait)

**What goes wrong:** User submits a 5-minute story arc and sees "Still processing..." for 50 minutes with no context. Assumes the CLI has hung and kills it.
**Why it happens:** No upfront time estimate printed at submission.
**How to avoid:** At submission time, print: `"Estimated wait: ~${Math.round(estimatedMinutes * 10)} minutes (HeyGen averages 10 min per 1 min of video)"`. Also log the HeyGen status page URL and `video_id` before polling starts.
**Warning signs:** No estimated wait printed at submission.

### Pitfall F: Leaving Chunk MP4s on Disk After Concat Failure

**What goes wrong:** If concat fails, chunk MP4s accumulate in the output directory across runs. User doesn't know which are partial.
**Why it happens:** No cleanup on concat error path.
**How to avoid:** Per D-06, keep chunk MP4s if any individual chunk fails (so the user doesn't lose credits). But if concat itself fails (after all chunks downloaded), the chunk MP4s are already in the output directory — document their names clearly in the error message so the user knows what they have. Do not delete them; the user may want to concat manually.
**Warning signs:** Silent failure path with no messaging about leftover files.

---

## Code Examples

### Submit a chunk to HeyGen v2

```typescript
// Source: STACK.md v1.1 Addendum §Key Endpoints
// POST https://api.heygen.com/v2/video/generate

async function submitChunk(
  scenes: HeyGenScene[],
  opts: { apiKey: string; width?: number; height?: number },
): Promise<string> {
  const body = {
    video_inputs: scenes,
    dimension: { width: opts.width ?? 1280, height: opts.height ?? 720 },
  }

  const response = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: {
      'X-Api-Key': opts.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const json = await response.json()
  const parsed = HeyGenSubmitResponseSchema.parse(json)

  if (parsed.error || !parsed.data) {
    const code = parsed.error?.code ?? String(response.status)
    const msg = parsed.error?.message ?? 'Unknown error'
    throw new HeyGenApiError(code, msg)
  }

  return parsed.data.video_id
}
```

### Fetch video status

```typescript
// Source: STACK.md v1.1 Addendum §Video status response shape
// GET https://api.heygen.com/v2/videos/{video_id}

async function fetchVideoStatus(videoId: string, apiKey: string) {
  const response = await fetch(`https://api.heygen.com/v2/videos/${videoId}`, {
    headers: { 'X-Api-Key': apiKey },
  })
  const json = await response.json()
  return HeyGenStatusResponseSchema.parse(json).data
}
```

### render.ts placeholder replacement (line 82)

The `process.exit(1)` at line 82 of `packages/cli/src/commands/render.ts` is replaced with:

```typescript
// New exports to add to packages/heygen/src/index.ts:
//   renderWithHeyGen(arc, opts, outputPath, onProgress): Promise<{ videoPath: string }>

const { renderWithHeyGen } = await import('@buildstory/heygen')

const outputDir = resolve(opts.output, projectName)
await mkdir(outputDir, { recursive: true })
const outputPath = resolve(outputDir, `${projectName}.mp4`)

const heygenFull = HeyGenOptionsSchema.parse({
  apiKey: heygenOpts.apiKey,
  avatarId: heygenOpts.avatarId,
  voiceId: heygenOpts.voiceId,
})

const heygenSpinner = ora('Submitting to HeyGen...').start()

const result = await renderWithHeyGen(
  storyArc,
  heygenFull,
  outputPath,
  (msg: string) => { heygenSpinner.text = msg },
)

heygenSpinner.succeed(chalk.green('HeyGen render complete'))
console.log(chalk.bold('\n  Output:'))
console.log(`    Video: ${result.videoPath}`)
console.log()
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `fluent-ffmpeg` for video assembly | `child_process.spawn` with explicit FFmpeg args | May 2025 (archived) | No wrapper layer; must build arg arrays manually |
| HeyGen webhooks for completion | Polling with exponential backoff | Ongoing — webhooks require public URL | Polling is correct for local CLI; design accordingly |
| HeyGen v1 single-scene endpoint | HeyGen v2 multi-scene `video/generate` | Current | v2 supports the `video_inputs[]` array format needed |

**Deprecated/outdated:**
- `fluent-ffmpeg`: Archived May 22, 2025. Do not use. Project research already flagged this in PITFALLS.md Pitfall 1.
- `@teamduality/heygen-typescript-sdk`: Community SDK, last major update January 2025, not HeyGen-official. Do not use.
- HeyGen v1 API (`/v1/video_status.get`): Some docs reference this older endpoint. Always use v2 (`/v2/videos/{video_id}` for status).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `process.env.FFMPEG_PATH ?? 'ffmpeg'` resolves to a working FFmpeg binary on the user's machine | Standard Stack — FFmpeg Resolution | Concat fails silently; mitigation: preflight should check FFmpeg availability |
| A2 | HeyGen `video_url` is always an HTTPS URL (not requiring additional auth headers) — downloaded with plain `fetch()` | Pattern 4 | Download fails with auth error; mitigation: test with real API key |
| A3 | Multi-chunk HeyGen output videos use the same H.264+AAC codec profile, making `-c copy` concat safe | Pattern 3 — FFmpeg concat | Codec mismatch causes garbled concat output; mitigation: could use `-c:v libx264 -c:a aac` re-encode as fallback |
| A4 | `HeyGenOptionsSchema.parse()` is importable from the heygen package by the CLI (it is currently exported from `types.ts` and re-exported from `index.ts`) | Pattern 6 — CLI integration | TS import error; mitigation: verify exports before implementing |
| A5 | `p-retry` in the heygen package should be used for HTTP network errors only, not for polling state transitions | Pattern 2 | If used incorrectly for state polling, will mask legitimate terminal errors |

---

## Open Questions

1. **FFmpeg availability for concat in single-chunk scenarios**
   - What we know: Multi-chunk arcs (>10 beats) need concat; single-chunk arcs do not.
   - What's unclear: Should the preflight check for FFmpeg availability upfront (always) or lazily (only if multiple chunks exist after adapt)?
   - Recommendation: Run adapt first, then conditionally check FFmpeg only if `chunks.length > 1`. Print a warning at cost-estimate time if the arc has >10 beats and FFmpeg is not found.

2. **`HeyGenOptions` vs `HeyGenConfig` in CLI**
   - What we know: `HeyGenConfig` is the z.input type (optional defaults); `HeyGenOptions` is the z.infer type (all fields required after defaults applied). The CLI currently passes a `HeyGenConfig` object to `preflightHeyGenCheck` and `estimateHeyGenCost`, but `renderWithHeyGen` needs full `HeyGenOptions`.
   - What's unclear: Should the CLI call `HeyGenOptionsSchema.parse()` before calling `renderWithHeyGen`, or should `renderWithHeyGen` parse internally?
   - Recommendation: Have `renderWithHeyGen` accept `HeyGenConfig` (the looser input type) and parse internally to `HeyGenOptions`. This keeps the CLI code simple and validation centralized.

3. **Chunk MP4 naming in temp directory**
   - What we know: `os.tmpdir()` is the location; chunk downloads are temporary.
   - What's unclear: Whether to name them `{video_id}.mp4` or `chunk-{n}-{video_id}.mp4`.
   - Recommendation: `chunk-{chunkIndex}-{videoId}.mp4` for debuggability when D-06 partial-failure reporting applies.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | native `fetch` | ✓ | v22.22.0 | — |
| FFmpeg | MP4 concat (multi-chunk) | ✓ | 7.1.2 (system) | ffmpeg-static via workspace |
| `p-retry` | Network-error backoff | ✓ | 8.0.0 (installed in heygen package) | Plain `while` loop with try/catch |
| `@buildstory/heygen` (built) | Phase 7 integration | ✓ | 0.1.0 (dist/ present) | — |
| HEYGEN_API_KEY | All HeyGen API calls | ✗ (not set in dev env) | — | Cannot test live API without key |

**Missing dependencies with no fallback:**
- `HEYGEN_API_KEY`: Required for end-to-end testing. Unit tests must mock `fetch`. Integration tests require a real key.

**Missing dependencies with fallback:**
- System FFmpeg available (v7.1.2); `ffmpeg-static` available as workspace fallback.

---

## Security Domain

> `security_enforcement` not explicitly set to false — including this section.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — no user auth; API key auth to external service | `HEYGEN_API_KEY` from `process.env` only, never config files (existing pattern) |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | Yes — HeyGen API responses | Zod schema on every response (existing project pattern) |
| V6 Cryptography | No | — |
| V7 Error Handling | Yes | Never expose raw API errors with internal stack traces; classify and surface actionable messages |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key exposure in logs | Information Disclosure | Never log `HEYGEN_API_KEY`; only log `video_id` and status |
| Presigned URL caching → expired URL reuse | Spoofing / DoS | Download immediately on `completed`; never cache URL (Pattern 4) |
| Path traversal in output file naming | Tampering | Use `resolve(outputDir, safeFilename)` — never interpolate user input directly into paths |
| Unvalidated API response shapes | Tampering | Zod parse on all HeyGen responses (Pattern 1) |

---

## Sources

### Primary (HIGH confidence)
- `packages/heygen/src/types.ts` — `HeyGenOptions`, `HeyGenScene`, `AdaptResult` type shapes (verified in codebase)
- `packages/heygen/src/adapter.ts` — `adaptStoryArc()` behavior, HEYGEN_CHAR_LIMIT=1500, HEYGEN_MAX_SCENES=10 (verified)
- `packages/cli/src/commands/render.ts` — exact integration point: line 82 `process.exit(1)` placeholder (verified)
- `packages/cli/src/commands/run.ts` — parallel placeholder at line 163 (verified)
- `packages/cli/src/config.ts` — `BuildStoryConfig.heygen` shape already wired (verified)
- `packages/cli/src/lazy.ts` — `ensureHeyGenPackage()` already wired (verified)
- `packages/heygen/package.json` — `p-retry ^6.2.1`, `zod ^4.3.6` confirmed present (verified)
- `.planning/research/STACK.md §v1.1 Addendum` — HeyGen API endpoints, request/response shapes, `p-retry` rationale
- `.planning/research/PITFALLS.md §HeyGen Integration Pitfalls` — Pitfalls 9–17 (polling, rate limits, download URL expiry, fluent-ffmpeg archived)
- `.planning/research/FEATURES.md §SECTION 2` — API workflow, video status values, processing time estimates

### Secondary (MEDIUM confidence)
- HeyGen API endpoint shapes in STACK.md derived from official docs (docs.heygen.com/reference) — verified at research time 2026-04-14 but not re-verified in this session
- Processing time estimate (10 min per 1 min of video) from FEATURES.md — community-reported; actual times vary

### Tertiary (LOW confidence)
- Codec homogeneity claim (A3): HeyGen outputs consistent H.264+AAC across chunks — assumed, not verified

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in codebase; no new packages needed
- Architecture: HIGH — integration point is a single identified placeholder; surrounding code already implemented
- HeyGen API shapes: MEDIUM — verified in prior research session (STACK.md v1.1), not re-called in this session
- Pitfalls: HIGH — PITFALLS.md sourced from official HeyGen docs and community reports; cross-verified

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (HeyGen API policy stable through October 2026 per STACK.md; fluent-ffmpeg status permanent)
