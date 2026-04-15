---
phase: 07-heygen-api-cli-integration
fixed_at: 2026-04-15T00:00:00Z
review_path: .planning/phases/07-heygen-api-cli-integration/07-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 07: Code Review Fix Report

**Fixed at:** 2026-04-15T00:00:00Z
**Source review:** .planning/phases/07-heygen-api-cli-integration/07-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (WR-01 through WR-04; IN-01 and IN-02 excluded by fix_scope=critical_warning)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: `fetchVideoStatus` does not guard against HTTP errors

**Files modified:** `packages/heygen/src/api.ts`
**Commit:** 1b0e858
**Applied fix:** Added `if (!response.ok)` guard in `fetchVideoStatus` that throws a `HeyGenApiError` with the HTTP status code and status text before attempting `response.json()`. Non-2xx responses (429, 503, etc.) now produce a descriptive error instead of an opaque ZodError.

### WR-02: Step counter is wrong for the HeyGen renderer path in `run.ts`

**Files modified:** `packages/cli/src/commands/run.ts`
**Commit:** 9fe5be8
**Applied fix:** Added `heygenRenderer` boolean computed from `opts.renderer ?? config.video?.renderer ?? 'remotion'` before `totalSteps` is calculated. Updated `totalSteps` to use `heygenRenderer ? 3 : 4` for the non-include-text video path and `2 + (heygenRenderer ? 1 : 2) + formatTypes.length` for the include-text path. Updated `stepOffset` at line 265 to `skipVideo ? 2 : heygenRenderer ? 3 : 4` so format steps are numbered correctly for all three modes.

### WR-03: `pollUntilComplete` sleeps before checking the deadline

**Files modified:** `packages/heygen/src/api.ts`
**Commit:** 4a3a0f5
**Applied fix:** Restructured `pollUntilComplete` from `while (Date.now() < deadline)` to `while (true)` with an explicit `if (Date.now() >= deadline) throw HeyGenTimeoutError` check at the top of the loop body, before the sleep call. The deadline is now evaluated on every loop entry including the first iteration. Removed the now-unreachable trailing `throw HeyGenTimeoutError` after the loop.

### WR-04: `heygenOpts` passes empty string for `avatarId`/`voiceId` — ZodError instead of clear message

**Files modified:** `packages/cli/src/commands/render.ts`, `packages/cli/src/commands/run.ts`
**Commit:** 3f45122
**Applied fix:** Added explicit validation of `heygenOpts` fields in both `render.ts` and `run.ts` immediately after building the options object. Collects missing fields (`HEYGEN_API_KEY env var`, `heygen.avatarId in buildstory.toml`, `heygen.voiceId in buildstory.toml`) into an array, prints a formatted error with `chalk.red`, and calls `process.exit(1)` before reaching preflight or `renderWithHeyGen`. Applied consistently to both command files.

---

_Fixed: 2026-04-15T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
