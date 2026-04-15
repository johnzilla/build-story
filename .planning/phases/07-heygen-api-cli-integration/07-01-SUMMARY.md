---
phase: 07-heygen-api-cli-integration
plan: "01"
subsystem: "@buildstory/heygen"
tags: [heygen, api-client, video-rendering, polling, ffmpeg]
dependency_graph:
  requires: []
  provides:
    - renderWithHeyGen function in @buildstory/heygen
    - HeyGenRenderResult type
    - HeyGenApiError, HeyGenTimeoutError, HeyGenVideoError error classes
  affects:
    - packages/heygen/src/index.ts (barrel exports)
tech_stack:
  added: []
  patterns:
    - Zod validate-at-boundary on all external API responses
    - p-retry for transient network errors (not polling state transitions)
    - Exponential backoff polling [15s/30s/60s/120s cap] with stuck-state detection
    - child_process.spawn for FFmpeg concat (no fluent-ffmpeg)
    - Stream pipeline for MP4 download (no URL caching)
    - onProgress callback for CLI spinner integration
key_files:
  created:
    - packages/heygen/src/api.ts
    - packages/heygen/src/__tests__/api.test.ts
  modified:
    - packages/heygen/src/index.ts
    - packages/heygen/tsconfig.json
decisions:
  - "ffmpegBin defaults to 'ffmpeg' (system PATH) rather than reading process.env in api.ts; callers can pass custom binary via HeyGenConfig extension if needed"
  - "tsconfig.json updated with types:node and lib:DOM to enable fetch/ReadableStream/Node API types in heygen package"
  - "Used NodeReadableStream type import from node:stream/web to resolve DOM vs Node ReadableStream conflict in pipeline call"
  - "submitChunk internal; pollUntilComplete internal; all tested indirectly via renderWithHeyGen integration tests"
metrics:
  duration: "7 minutes"
  completed_date: "2026-04-15"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 07 Plan 01: HeyGen API Client Summary

**One-liner:** HeyGen v2 API client with Zod-validated submission, exponential-backoff polling with stuck detection, streaming MP4 download, and FFmpeg concat via child_process.spawn.

## What Was Built

`packages/heygen/src/api.ts` implements the full HeyGen rendering pipeline as a single public function `renderWithHeyGen()`:

1. **submitChunk** — POSTs scene arrays to `/v2/video/generate`; wraps fetch in `p-retry` (3 retries); terminal API errors (including code `400140` daily rate limit) are not retried via `shouldRetry` guard.

2. **pollUntilComplete** — Polls `/v2/videos/{id}` with exponential backoff [15s/30s/60s/120s cap]; tracks `lastStatus` + `lastStatusChangeAt` to detect stuck-at-33%/97% after 10 minutes; timeout produces actionable error with video_id and `https://app.heygen.com/videos/{id}` URL per D-02.

3. **downloadMp4** — Streams video via native `fetch()` → `pipeline(Readable.fromWeb(...), createWriteStream(...))` immediately on `completed` status; no URL caching per Pitfall B.

4. **concatMp4s** — Writes FFmpeg concat demuxer list file to `os.tmpdir()`; spawns `ffmpeg` (or `FFMPEG_PATH` override via caller) with `-c copy`; cleans up list file on completion per D-04.

5. **renderWithHeyGen** — Public function: validates config at boundary via `HeyGenOptionsSchema.parse()`, calls `adaptStoryArc()`, processes chunks sequentially, handles partial failure per D-06, returns `{ videoPath, warnings }`.

The barrel `index.ts` now exports `renderWithHeyGen`, `HeyGenRenderResult`, and all three error classes so the CLI can catch them for specific error handling.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create api.ts with full HeyGen API client | 4f51cef | packages/heygen/src/api.ts, packages/heygen/tsconfig.json |
| 2 | Update barrel exports and create unit tests | a0eb42a | packages/heygen/src/index.ts, packages/heygen/src/__tests__/api.test.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tsconfig.json missing node and DOM type declarations**
- **Found during:** Task 1 verification (tsc --noEmit)
- **Issue:** `tsconfig.base.json` has `lib: ["ES2022"]` with no `types` field; `fetch`, `ReadableStream`, `process`, `setTimeout`, and all `node:*` imports were unresolved.
- **Fix:** Added `"types": ["node"]` and `"lib": ["ES2022", "DOM"]` to `packages/heygen/tsconfig.json`.
- **Files modified:** packages/heygen/tsconfig.json
- **Commit:** 4f51cef

**2. [Rule 1 - Bug] DOM ReadableStream vs Node ReadableStream type conflict**
- **Found during:** Task 1 verification (tsc --noEmit) after DOM lib added
- **Issue:** `Readable.fromWeb()` expects `node:stream/web.ReadableStream` but DOM lib provides `DOM.ReadableStream`; the types are incompatible.
- **Fix:** Added `import type { ReadableStream as NodeReadableStream } from 'node:stream/web'` and cast `response.body` to `NodeReadableStream` instead of DOM `ReadableStream`.
- **Files modified:** packages/heygen/src/api.ts
- **Commit:** 4f51cef

**3. [Rule 2 - Missing] process.env removed from api.ts to satisfy acceptance criterion**
- **Found during:** Task 1 acceptance criteria check
- **Issue:** Acceptance criterion `! grep -q "process.env"` failed because `concatMp4s` used `process.env['FFMPEG_PATH']`. The plan anti-pattern is specifically about API keys, but the criterion is broader.
- **Fix:** Changed `concatMp4s` to accept optional `ffmpegBin` parameter defaulting to `'ffmpeg'`. Callers can pass the binary path; system FFmpeg is the default.
- **Files modified:** packages/heygen/src/api.ts
- **Commit:** 4f51cef

**4. [Rule 1 - Bug] Unhandled rejection in polling failure tests**
- **Found during:** Task 2 test run
- **Issue:** Tests using `vi.useRealTimers()` before `await expect(resultPromise).rejects...` caused unhandled rejection warnings because the timer advancement triggered rejection before the assertion handler was attached.
- **Fix:** Changed pattern to `const caught = resultPromise.catch((e) => e)` before advancing timers, then `const err = await caught` for assertion.
- **Files modified:** packages/heygen/src/__tests__/api.test.ts
- **Commit:** a0eb42a

**5. [Rule 1 - Bug] Attempted import of internal function submitChunk in test**
- **Found during:** Task 2 TypeScript check
- **Issue:** Test had `const { submitChunk: _submitChunk } = await import('../api.js')` but `submitChunk` is not exported; this caused a TS2339 error.
- **Fix:** Replaced that test with a full `renderWithHeyGen` integration test that verifies submit behavior through the public API.
- **Files modified:** packages/heygen/src/__tests__/api.test.ts
- **Commit:** a0eb42a

### Pre-existing Issues (Out of Scope)

- `adapter.test.ts` has 32 `TS2532: Object is possibly 'undefined'` errors from array index access under `noUncheckedIndexedAccess`. These pre-date this plan and are not caused by changes here. Logged as deferred.

## Known Stubs

None — all functions are fully implemented. No placeholder data or TODO comments.

## Threat Flags

All threats from the plan's threat model are mitigated:

| T-ID | Mitigation Status |
|------|-------------------|
| T-07-01 | apiKey never logged; only video_id and status strings passed to onProgress |
| T-07-02 | Zod parse on every HeyGen response (HeyGenSubmitResponseSchema, HeyGenStatusResponseSchema) |
| T-07-03 | tmpdir() + controlled filenames; no user input interpolated into paths |
| T-07-04 | Exponential backoff [15s/30s/60s/120s], 600s timeout, 10min stuck detection |
| T-07-05 | URL used immediately on completed status; not cached |

## Self-Check: PASSED

- packages/heygen/src/api.ts: FOUND
- packages/heygen/src/__tests__/api.test.ts: FOUND
- packages/heygen/src/index.ts: FOUND (modified)
- Commit 4f51cef: FOUND
- Commit a0eb42a: FOUND
- All 49 tests: PASSED
- TypeScript errors in api.ts: NONE (pre-existing adapter.test.ts errors excluded)
