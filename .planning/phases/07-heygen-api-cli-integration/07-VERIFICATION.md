---
phase: 07-heygen-api-cli-integration
verified: 2026-04-15T12:30:00Z
status: human_needed
score: 9/9
overrides_applied: 0
human_verification:
  - test: "Run `buildstory render --renderer=heygen <story-arc.json>` with a real HEYGEN_API_KEY and a small StoryArc"
    expected: "Spinner shows 'Submitting to HeyGen...', updates with poll status messages (e.g. 'processing'), then succeeds with 'HeyGen render complete' and prints the MP4 path"
    why_human: "Requires a live HeyGen API key, actual API submission, and real polling — cannot simulate the full network round-trip programmatically"
  - test: "Run `buildstory run --renderer=heygen <paths>` end-to-end"
    expected: "Scan -> narrate -> HeyGen submit pipeline completes, step counter shows [3/N], MP4 saved to output directory"
    why_human: "Requires live Anthropic/OpenAI + HeyGen API keys for the full pipeline"
  - test: "Let a HeyGen submission exceed the configured timeout"
    expected: "Command exits with a message containing the video ID and the URL https://app.heygen.com/videos/{id} so user can check manually"
    why_human: "Cannot trigger a real timeout without waiting the full timeout duration against the live API"
  - test: "Configure buildstory.toml with [video] renderer = 'heygen' and [heygen] avatar_id / voice_id, then run buildstory render without any CLI flags"
    expected: "The avatar and voice from the TOML file are used (visible in cost estimate output), not the defaults"
    why_human: "Requires verifying actual config resolution in a live run with the values reflected in HeyGen API calls"
---

# Phase 7: HeyGen API + CLI Integration — Verification Report

**Phase Goal:** Users can submit a StoryArc to HeyGen, wait for completion with visible polling progress, download the MP4, and select this path via `--renderer=heygen` — the full end-to-end flow works
**Verified:** 2026-04-15T12:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All 9 must-haves derived from roadmap success criteria and PLAN frontmatter are VERIFIED by static analysis, unit tests, and code inspection. Four human verification items require a live HeyGen API key and cannot be checked programmatically.

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `buildstory render --renderer=heygen <story-arc.json>` submits to HeyGen, polls with progress output, and saves the downloaded MP4 to the output directory | VERIFIED | `renderWithHeyGen` called at render.ts:91 with storyArc, heygenOpts, outputPath, and onProgress callback updating ora spinner. Spinner text updated on each poll cycle via callback. |
| 2 | If HeyGen does not complete within the configured timeout, the command exits with a clear error and the video ID so the user can check manually | VERIFIED | `HeyGenTimeoutError` thrown at api.ts:198 with message `"Timeout after ${N}s. Video ID: ${videoId} -- check status at https://app.heygen.com/videos/${videoId}"`. Caught in render.ts catch block and displayed via chalk.red. |
| 3 | `buildstory run --renderer=heygen <paths>` runs the full scan -> narrate -> HeyGen render pipeline end-to-end | VERIFIED | `renderWithHeyGen` wired into run.ts:171 with step-numbered spinner `[3/${totalSteps}]`. `mp4Path` assigned from result.videoPath for final summary. No placeholder code remains. |
| 4 | `buildstory.toml` with `[video] renderer = "heygen"` and `[heygen] avatar_id` / `voice_id` is respected without any CLI flags | VERIFIED | config.ts defines `heygen?: { avatarId?, voiceId? }` and `video?: { renderer? }`. render.ts:43 resolves `opts.renderer ?? config.video?.renderer ?? 'remotion'`. heygenOpts.avatarId reads from `config.heygen?.avatarId`. |

### PLAN Frontmatter Must-Haves (Plan 01)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | renderWithHeyGen submits scene chunks to HeyGen v2 API sequentially | VERIFIED | api.ts processes chunks in sequential for loop (lines 261+). Each chunk: submitChunk -> pollUntilComplete -> downloadMp4. |
| 6 | Polling uses exponential backoff and detects stuck-state after 10 minutes unchanged | VERIFIED | api.ts pollUntilComplete uses backoff intervals `[15_000, 30_000, 60_000, 120_000]`. `lastStatusChangeAt` tracked; stuck detection throws `HeyGenVideoError` after 10 min same status. |
| 7 | Timeout produces an actionable error with video_id and manual check URL | VERIFIED | `HeyGenTimeoutError` message includes `app.heygen.com/videos/${videoId}` (api.ts:199). |
| 8 | MP4 download uses the presigned URL from the completed poll response immediately | VERIFIED | `downloadMp4(videoUrl, tmpPath)` called immediately after pollUntilComplete returns URL. No URL caching across iterations. |
| 9 | Multi-chunk arcs are concatenated via FFmpeg demuxer into a single MP4; chunk MP4s deleted after successful concatenation | VERIFIED | `concatMp4s` uses `child_process.spawn` with FFmpeg concat demuxer. Post-concat cleanup: `for (const p of chunkPaths) await unlink(p).catch(() => {})`. No fluent-ffmpeg import. |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/heygen/src/api.ts` | HeyGen API client: submitChunk, pollUntilComplete, downloadMp4, concatMp4s, renderWithHeyGen | VERIFIED | All 5 functions present. Zod response schemas, 3 error classes, pRetry, adaptStoryArc wired. ~300 lines, fully implemented. |
| `packages/heygen/src/index.ts` | Barrel re-export of renderWithHeyGen, HeyGenRenderResult, and error classes | VERIFIED | Line 4: `export { renderWithHeyGen, HeyGenApiError, HeyGenTimeoutError, HeyGenVideoError }`. Line 5: `export type { HeyGenRenderResult }`. |
| `packages/heygen/src/__tests__/api.test.ts` | Unit tests for api.ts with mocked fetch | VERIFIED | Substantive test file with submitChunk, pollUntilComplete, downloadMp4, renderWithHeyGen coverage. All 49 tests pass (2 test files). |
| `packages/cli/src/commands/render.ts` | HeyGen submission flow replacing the process.exit(1) placeholder | VERIFIED | `renderWithHeyGen` at line 82. No "not yet implemented" or "Phase 7" strings present. Spinner, success path, error path, warnings — all wired. |
| `packages/cli/src/commands/run.ts` | HeyGen submission flow replacing the process.exit(1) placeholder | VERIFIED | `renderWithHeyGen` at line 164. Step-numbered spinner. `mp4Path = heygenResult.videoPath`. No placeholder code. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/heygen/src/api.ts` | `packages/heygen/src/adapter.ts` | `import { adaptStoryArc }` | WIRED | api.ts:14 imports adaptStoryArc; called at api.ts:258 inside renderWithHeyGen |
| `packages/heygen/src/api.ts` | `packages/heygen/src/types.ts` | `import { HeyGenOptionsSchema }` | WIRED | api.ts:13 imports HeyGenOptionsSchema; parsed at api.ts:255 in renderWithHeyGen |
| `packages/heygen/src/index.ts` | `packages/heygen/src/api.ts` | `export { renderWithHeyGen }` | WIRED | index.ts:4 exports renderWithHeyGen from api.js |
| `packages/cli/src/commands/render.ts` | `packages/heygen/src/api.ts` | dynamic import('@buildstory/heygen') then renderWithHeyGen | WIRED | render.ts:48 dynamic import; render.ts:82 destructures renderWithHeyGen; called at render.ts:91 |
| `packages/cli/src/commands/run.ts` | `packages/heygen/src/api.ts` | dynamic import('@buildstory/heygen') then renderWithHeyGen | WIRED | run.ts:134 dynamic import; run.ts:164 destructures renderWithHeyGen; called at run.ts:171 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `render.ts` | `storyArc` | `readFile(storyArcPath)` + `StoryArcSchema.parse()` | Yes — parsed from user-supplied JSON file | FLOWING |
| `render.ts` | `heygenOpts` | `config.heygen?.avatarId`, `config.heygen?.voiceId`, `process.env['HEYGEN_API_KEY']` | Yes — reads real env var and TOML config values | FLOWING |
| `run.ts` | `arc` | Returned from real `narrate()` call in prior pipeline step | Yes — upstream pipeline produces real StoryArc | FLOWING |
| `api.ts` | `videoUrl` | `HeyGenStatusResponseSchema.parse()` on live API response | Yes — Zod-validated from HeyGen API; no hardcoded fallbacks | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `renderWithHeyGen` present in compiled dist | `grep "renderWithHeyGen" packages/heygen/dist/index.js` | Found — `async function renderWithHeyGen(arc, config, outputPath, onProgress)` | PASS |
| All 49 heygen tests pass | `pnpm --filter @buildstory/heygen test` | 2 test files passed, 49 tests passed | PASS |
| No placeholder code in CLI files | `grep "not yet implemented\|Phase 7" render.ts run.ts` | No matches | PASS |
| `--renderer` flag registered in CLI | `grep "renderer.*heygen" packages/cli/src/index.ts` | Line 30: `.option('--renderer <renderer>', 'Video renderer (remotion|heygen)', 'remotion')` | PASS |
| Commits 4f51cef, a0eb42a, 4ef72b9, 85825f4 | `git log --oneline` | All 4 commits found | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| HGVR-02 | Plan 01 | HeyGen renderer submits a video generation request to HeyGen v2 API from a StoryArc | SATISFIED | `submitChunk` POSTs to `https://api.heygen.com/v2/video/generate` with Zod-validated response. `renderWithHeyGen` orchestrates the full arc submission. |
| HGVR-03 | Plan 01 | HeyGen renderer polls for video completion with exponential backoff and configurable timeout | SATISFIED | `pollUntilComplete` in api.ts implements [15s/30s/60s/120s] exponential backoff, 10-min stuck detection, configurable `timeoutSeconds`. |
| HGVR-04 | Plan 01 | HeyGen renderer downloads completed MP4 to the standard output directory | SATISFIED | `downloadMp4` streams MP4 to `outputPath` via `pipeline(Readable.fromWeb(...), createWriteStream(...))`. Final path passed back as `result.videoPath`. |
| CLI-08 | Plan 02 | `--renderer=heygen` flag selects HeyGen renderer for render and run commands | SATISFIED | CLI index.ts line 30 registers `--renderer <renderer>` option. render.ts:43 and run.ts:130 resolve renderer from flag, TOML config, or default. |
| CLI-09 | Plan 02 | `buildstory.toml` supports `[video] renderer` and `[heygen]` section with avatar_id, voice_id | SATISFIED | config.ts schema includes `video?.renderer` and `heygen?: { avatarId?, voiceId? }`. Merge logic in config.ts:69. Values read in render.ts:54-55 and run.ts:139-140. |

No orphaned requirements. All 5 Phase 7 requirements (HGVR-02, HGVR-03, HGVR-04, CLI-08, CLI-09) are claimed by plans and verified.

### Anti-Patterns Found

No blockers or warnings detected.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|---------|--------|
| `packages/heygen/src/__tests__/adapter.test.ts` | 49, 54, 59... | TS2532 `Object is possibly 'undefined'` (32 errors) | Info | Pre-existing before Phase 7; does not affect api.ts or any Phase 7 code. Tests still pass. |

### Human Verification Required

#### 1. Live HeyGen Render via `buildstory render --renderer=heygen`

**Test:** With `HEYGEN_API_KEY` set, a valid `buildstory.toml` with `[heygen] avatar_id` and `voice_id`, and a small `story-arc.json` file (2-3 beats), run: `buildstory render --renderer=heygen story-arc.json`
**Expected:** Spinner shows "Submitting to HeyGen...", updates with real poll status messages, eventually shows "HeyGen render complete" and prints the MP4 file path. The MP4 file exists on disk.
**Why human:** Requires a live HeyGen API key, network access to api.heygen.com, and real video generation — cannot be simulated programmatically.

#### 2. Live Full Pipeline via `buildstory run --renderer=heygen`

**Test:** With all required API keys set, run: `buildstory run --renderer=heygen ./some-repo`
**Expected:** Step-numbered progress: `[1/N] Scanning...`, `[2/N] Narrating...`, `[3/N] Submitting to HeyGen...`, then `[3/N] HeyGen render complete`. Output summary shows MP4 path.
**Why human:** Requires live Anthropic/OpenAI and HeyGen API keys for the full scan → narrate → render pipeline.

#### 3. Timeout Error Message

**Test:** Configure `timeoutSeconds = 10` in config, run against a story arc that will take longer than 10 seconds to generate.
**Expected:** Command fails with a message containing the video ID (e.g., `vid-abc123`) and the URL `https://app.heygen.com/videos/vid-abc123`.
**Why human:** Cannot trigger a real timeout without waiting against the live HeyGen API.

#### 4. TOML Config Resolution (No CLI Flags)

**Test:** Create a `buildstory.toml` with `[video]` `renderer = "heygen"` and `[heygen]` `avatar_id = "Monica_chair_front_public"` `voice_id = "some-voice-id"`. Run `buildstory render story-arc.json` with no `--renderer` flag.
**Expected:** Cost estimate output shows the avatar ID from the TOML file (`avatar: Monica_chair_front_public`). The submission uses those values, not defaults.
**Why human:** Config resolution is verified by code inspection, but the actual values flowing through to the HeyGen API call require a live test to confirm.

### Gaps Summary

No gaps found. All 9 must-haves are VERIFIED by static analysis and unit tests. The 4 human verification items above are the only outstanding checks — they require a live HeyGen API key and cannot be automated.

---

_Verified: 2026-04-15T12:30:00Z_
_Verifier: Claude (gsd-verifier)_
