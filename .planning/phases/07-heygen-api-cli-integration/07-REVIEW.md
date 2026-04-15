---
phase: 07-heygen-api-cli-integration
reviewed: 2026-04-15T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - packages/heygen/src/api.ts
  - packages/heygen/src/__tests__/api.test.ts
  - packages/heygen/src/index.ts
  - packages/cli/src/commands/render.ts
  - packages/cli/src/commands/run.ts
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-04-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files covering the HeyGen API integration layer and CLI command wiring were reviewed. The overall structure is solid: Zod validation at the public boundary, pRetry for transient network errors, proper polling with stuck-detection, and correct chunk-to-concat assembly. No critical security or data-loss issues were found.

Four warnings surface: an unchecked HTTP response in the polling helper (`fetchVideoStatus`) that will throw an opaque ZodError instead of a useful network error on non-2xx status; step-counter display bugs in `run.ts` when the HeyGen renderer is selected; a non-fatal but real issue where `pollUntilComplete` sleeps before the first poll even when the deadline is already passed (making `timeoutSeconds: 0` tests flaky); and a missing `response.ok` guard in `downloadMp4` that doesn't fully protect against an empty body on non-2xx. Two informational items round out the report.

---

## Warnings

### WR-01: `fetchVideoStatus` does not guard against HTTP errors — non-2xx response causes an opaque ZodError

**File:** `packages/heygen/src/api.ts:133-139`

**Issue:** `fetchVideoStatus` calls `response.json()` and feeds the result straight to `HeyGenStatusResponseSchema.parse()` without checking `response.ok`. When HeyGen returns a 429 rate-limit, 503 service unavailable, or any other non-2xx, the body is an error envelope that does not match the schema. The resulting `ZodError` is unhandled inside the polling loop and will bubble up wrapped in a generic "Chunk N/M failed" message with no indication of the HTTP status code or rate-limit. This makes debugging significantly harder and prevents the caller from distinguishing a transient HTTP error from a real video failure.

**Fix:**
```typescript
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
```

---

### WR-02: Step counter is wrong for the HeyGen renderer path in `run.ts`

**File:** `packages/cli/src/commands/run.ts:77-81` and `263`

**Issue:** `totalSteps` is computed as `4` for video mode without `--include-text` (comment says: scan + narrate + TTS + render). But the HeyGen path has only **3** steps: scan(1) + narrate(2) + HeyGen(3). The spinner therefore shows `[3/4]` and the summary line `[3/4] HeyGen render complete` when there is no step 4. In addition, when `--include-text` is combined with `--renderer=heygen`, `stepOffset` is hardcoded to `4` at line 263, so format steps are numbered `[5/N]`, `[6/N]` ... skipping step 4 in the display entirely.

**Fix:** Compute steps based on the actual renderer in use:

```typescript
const heygenRenderer = (opts.renderer ?? config.video?.renderer ?? 'remotion') === 'heygen'

const totalSteps = skipVideo
  ? 2 + formatTypes.length
  : includeText
    ? 2 + (heygenRenderer ? 1 : 2) + formatTypes.length
    : heygenRenderer ? 3 : 4
```

And at line 263:
```typescript
const stepOffset = skipVideo ? 2 : heygenRenderer ? 3 : 4
```

---

### WR-03: `pollUntilComplete` sleeps before checking the deadline — makes `timeoutSeconds: 0` semantics unreliable

**File:** `packages/heygen/src/api.ts:155-161`

**Issue:** The polling loop calls `await sleep(delay)` at the top of the loop body before the `Date.now() < deadline` check is re-evaluated. When `timeoutSeconds` is very small (e.g., `0` or `1`), the first iteration always waits a minimum of 15 seconds before discovering the deadline has passed. This is why the test at `api.test.ts:243-256` requires `vi.advanceTimersByTimeAsync(16_000)` to trigger the timeout — a 16-second advance for a 0-second timeout. The immediate practical risk is that a caller who sets a short custom timeout gets a 15-second delay before the timeout error regardless of their intent.

**Fix:** Move the deadline guard before the sleep, or restructure to check on entry:

```typescript
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
  // ... rest of loop
}
```

---

### WR-04: `heygenOpts` passes empty string for `avatarId` and `voiceId` when config fields are absent — preflight passes but Zod rejects later

**File:** `packages/cli/src/commands/render.ts:51-56` and `packages/cli/src/commands/run.ts:137-141`

**Issue:** Both command files build `heygenOpts` with `config.heygen?.avatarId ?? ''` and `config.heygen?.voiceId ?? ''`. `HeyGenOptionsSchema` requires `avatarId` and `voiceId` to be `z.string().min(1)`. If the user omits `[heygen]` from `buildstory.toml`, the preflight call (`preflightHeyGenCheck(heygenOpts)`) receives empty strings. Whether preflight itself validates these fields depends on its implementation, but `renderWithHeyGen` will definitively throw a `ZodError` at line 255 of `api.ts`. The user receives an unformatted Zod validation error rather than a clear "avatarId is required — add it to buildstory.toml" message. Since the same pattern appears in both `render.ts` and `run.ts`, this is a systematic gap.

**Fix:** Validate `heygenOpts` before preflight and surface a clear error:

```typescript
const heygenOpts = {
  apiKey: process.env['HEYGEN_API_KEY'] ?? '',
  avatarId: config.heygen?.avatarId ?? '',
  voiceId: config.heygen?.voiceId ?? '',
}

const missingFields: string[] = []
if (!heygenOpts.apiKey) missingFields.push('HEYGEN_API_KEY env var')
if (!heygenOpts.avatarId) missingFields.push('heygen.avatarId in buildstory.toml')
if (!heygenOpts.voiceId) missingFields.push('heygen.voiceId in buildstory.toml')

if (missingFields.length > 0) {
  console.error(chalk.red('\n  HeyGen configuration missing:\n'))
  missingFields.forEach((f) => console.error(chalk.red(`    - ${f}`)))
  console.error()
  process.exit(1)
}
```

---

## Info

### IN-01: `submitChunk` retries on all errors except `HeyGenApiError` — but HTTP 4xx responses never reach pRetry's `shouldRetry`

**File:** `packages/heygen/src/api.ts:99-113`

**Issue:** The `pRetry` wrapper is configured with `shouldRetry: (err) => !(err instanceof HeyGenApiError)`. However, `pRetry` only calls `shouldRetry` when the wrapped function throws. The wrapped function is the `fetch(...)` call, which does not throw on 4xx/5xx — it resolves with the response. The `HeyGenApiError` is thrown *after* `pRetry` resolves (lines 115-124), so it is never seen by `shouldRetry`. The net effect is that all transient 5xx responses from the submit endpoint will be retried 3 times (because `fetch` succeeding with a 500 body doesn't throw), which is actually the desired behavior for 5xx — but the `shouldRetry` guard is dead code. This is not a bug in practice, but the intent in the comment ("5xx and network errors are retried") is achieved accidentally, not by design.

**Suggestion:** Either restructure so the throw happens inside the `pRetry` callback (allowing `shouldRetry` to work as intended), or remove the now-misleading `shouldRetry` option and add a comment explaining why it's not needed.

---

### IN-02: `concatMp4s` does not clean up the list file on FFmpeg failure

**File:** `packages/heygen/src/api.ts:221-242`

**Issue:** The temp concat list file at `listPath` is written at line 229. If the `spawn` promise rejects (FFmpeg exits non-zero or errors), the `unlink(listPath)` at line 241 is never reached. The file is left in `tmpdir()`. On long runs with many retries this is a minor temp-file leak.

**Suggestion:** Use a `try/finally` block:

```typescript
await writeFile(listPath, listContent)
try {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegBin, args, { stdio: 'pipe' })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg concat exited with code ${code}`))
    })
    proc.on('error', reject)
  })
} finally {
  await unlink(listPath).catch(() => {})
}
```

---

_Reviewed: 2026-04-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
