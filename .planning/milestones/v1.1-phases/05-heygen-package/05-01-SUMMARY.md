---
phase: 05-heygen-package
plan: 01
subsystem: renderer
tags: [heygen, zod, typescript, workspace-package, cost-estimation, preflight]

# Dependency graph
requires:
  - phase: 01-scaffold
    provides: monorepo structure, tsconfig.base.json, pnpm workspaces
  - phase: 02-scanner
    provides: StoryBeat type from @buildstory/core
provides:
  - "@buildstory/heygen workspace package with HeyGenOptions, HeyGenConfig, HeyGenCostEstimate, PreflightResult types"
  - "preflightHeyGenCheck: validates apiKey, avatarId, voiceId presence before any API call"
  - "estimateHeyGenCost: calculates credits and USD from StoryBeat data without calling HeyGen API"
  - "Barrel index.ts with proper .js extensions for NodeNext module resolution"
affects:
  - "05-02 (HeyGen API client will import preflightHeyGenCheck and estimateHeyGenCost)"
  - "CLI render command (will call preflightHeyGenCheck with HeyGenConfig)"

# Tech tracking
tech-stack:
  added:
    - "@buildstory/heygen workspace package (new)"
    - "p-retry ^6.2.1 (polling dependency, added to heygen package)"
    - "zod ^4.3.6 (already in monorepo, used for HeyGenOptionsSchema)"
  patterns:
    - "HeyGenConfig = z.input<...> for optional defaults in function params (vs HeyGenOptions = z.infer<...> for full output)"
    - "duration_seconds !== undefined guard prevents NaN in word-count fallback"
    - "Separate export/export type lines in barrel index.ts"

key-files:
  created:
    - packages/heygen/package.json
    - packages/heygen/tsup.config.ts
    - packages/heygen/tsconfig.json
    - packages/heygen/src/types.ts
    - packages/heygen/src/preflight.ts
    - packages/heygen/src/cost.ts
    - packages/heygen/src/index.ts

key-decisions:
  - "Used HeyGenConfig (z.input) not HeyGenOptions (z.infer) as parameter type so callers pass { apiKey, avatarId, voiceId } without supplying width/height/speed/timeoutSeconds defaults"
  - "estimateHeyGenCost uses b.duration_seconds !== undefined (not just !b.duration_seconds) to avoid NaN when duration_seconds is 0"

patterns-established:
  - "Zod z.input<> for function parameter types when schema has .default() fields"
  - "Cost estimation: word-count heuristic at 150wpm fallback when duration_seconds absent"

requirements-completed: [REND-13, HGVR-01, SAFE-01, SAFE-02, SAFE-04]

# Metrics
duration: 2min
completed: 2026-04-15
---

# Phase 5 Plan 01: @buildstory/heygen Package Scaffold Summary

**Standalone `@buildstory/heygen` workspace package with Zod-typed preflight validation and credit/USD cost estimation, zero imports from `@buildstory/video`**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-15T11:26:06Z
- **Completed:** 2026-04-15T11:27:47Z
- **Tasks:** 2
- **Files modified:** 7 created + pnpm-lock.yaml updated

## Accomplishments

- Created `@buildstory/heygen` as an isolated workspace package with no Remotion/video/OpenAI dependencies (REND-13 compliant)
- Implemented `preflightHeyGenCheck(opts: HeyGenConfig)` with three presence checks and actionable error messages linking to HeyGen API docs
- Implemented `estimateHeyGenCost(beats, opts: HeyGenConfig)` using CREDITS_PER_MINUTE=1, USD_PER_CREDIT=0.99, Math.ceil rounding, and a safe `!== undefined` guard to avoid NaN when duration_seconds is 0
- Package builds successfully with tsup producing ESM + `.d.ts` output

## Task Commits

Each task was committed atomically:

1. **Task 1: Create @buildstory/heygen package scaffold and type definitions** - `0ac170d` (feat)
2. **Task 2: Implement preflight validation, cost estimation, and barrel exports** - `53733e5` (feat)

**Plan metadata:** (final commit below)

## Files Created/Modified

- `packages/heygen/package.json` - Workspace package definition with @buildstory/core, zod, p-retry deps; no video/remotion deps
- `packages/heygen/tsup.config.ts` - ESM+dts build config (matches core pattern)
- `packages/heygen/tsconfig.json` - Extends tsconfig.base.json, no composite/references
- `packages/heygen/src/types.ts` - HeyGenOptionsSchema, HeyGenOptions (z.infer), HeyGenConfig (z.input), HeyGenCostEstimate, PreflightResult
- `packages/heygen/src/preflight.ts` - preflightHeyGenCheck with three failure checks
- `packages/heygen/src/cost.ts` - estimateHeyGenCost with word-count heuristic fallback and NaN guard
- `packages/heygen/src/index.ts` - Barrel exports with .js extensions
- `pnpm-lock.yaml` - Updated for new workspace package

## Decisions Made

- Used `HeyGenConfig = z.input<typeof HeyGenOptionsSchema>` as the parameter type for both `preflightHeyGenCheck` and `estimateHeyGenCost`. This lets callers pass `{ apiKey, avatarId, voiceId }` directly without specifying `width`, `height`, `speed`, or `timeoutSeconds`. The full `HeyGenOptions = z.infer<...>` type (all fields required) is reserved for Phase 7 API submission after schema parse applies defaults.
- Used `b.duration_seconds !== undefined` (explicit undefined check) rather than `!b.duration_seconds` to guard the word-count fallback. This prevents NaN if a beat has `duration_seconds: 0`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Built @buildstory/core before heygen DTS build**
- **Found during:** Task 2 build step
- **Issue:** `pnpm --filter @buildstory/heygen build` DTS phase failed with `Cannot find module '@buildstory/core'` — the worktree has an isolated filesystem and `packages/core/dist/` was not yet built in this worktree
- **Fix:** Ran `pnpm --filter @buildstory/core build` first; worktree needed its own build artifacts (unlike the main repo which had pre-built dist/)
- **Files modified:** packages/core/dist/ (generated, not committed — gitignored build output)
- **Verification:** `pnpm --filter @buildstory/heygen build` then succeeded
- **Committed in:** N/A — build artifacts are gitignored; fix was a prerequisite build step

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Normal worktree isolation behavior. Core dist is gitignored, so the heygen build just needed core built first. No scope creep.

## Issues Encountered

- Worktree isolation: `packages/core/dist/` not present in fresh worktree. Resolved by building core first before heygen DTS generation. This is expected behavior in worktrees — no code changes required.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `@buildstory/heygen` is a fully registered workspace package
- `preflightHeyGenCheck` and `estimateHeyGenCost` are exported and typed correctly
- `HeyGenConfig` (z.input) is ready for CLI consumption in Phase 5 Plan 2
- `HeyGenOptions` (z.infer) is available for Phase 7 API submission
- Phase 5 Plan 2 can import `preflightHeyGenCheck` and `estimateHeyGenCost` from `@buildstory/heygen`

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes beyond those modeled in the plan's threat register. The `preflightHeyGenCheck` function reads API key presence from input only — it does not make network calls. No unmodeled threat surface introduced.

---
*Phase: 05-heygen-package*
*Completed: 2026-04-15*
