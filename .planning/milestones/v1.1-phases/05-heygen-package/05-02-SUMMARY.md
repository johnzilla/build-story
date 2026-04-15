---
phase: 05-heygen-package
plan: "02"
subsystem: cli
tags: [heygen, renderer, cli, commander, tsup, config]

# Dependency graph
requires:
  - phase: 05-heygen-package/05-01
    provides: "@buildstory/heygen package with preflightHeyGenCheck, estimateHeyGenCost, HeyGenConfig types"
provides:
  - "--renderer=heygen flag on both render and run commands"
  - "HeyGen dispatch branch in render.ts and run.ts with preflight, cost estimate, dry-run exit"
  - "BuildStoryConfig extended with video.renderer and heygen.avatarId/voiceId sections"
  - "ensureHeyGenPackage and detectHeyGenPackage lazy install functions in lazy.ts"
  - "@buildstory/heygen marked external in tsup config for lazy dynamic import"
affects:
  - "05-heygen-package/05-03"
  - "future-render-phases"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Renderer dispatch: CLI flag > config > default (remotion) resolution order"
    - "Lazy install pattern extended to @buildstory/heygen using shared askYesNo from lazy.ts"
    - "External tsup config entry for lazily-installed optional packages"

key-files:
  created: []
  modified:
    - packages/cli/src/config.ts
    - packages/cli/src/lazy.ts
    - packages/cli/src/commands/render.ts
    - packages/cli/src/commands/run.ts
    - packages/cli/src/index.ts
    - packages/cli/tsup.config.ts

key-decisions:
  - "API key read only from process.env['HEYGEN_API_KEY'] -- never from config files (T-05-04 mitigation)"
  - "Mark @buildstory/heygen as external in tsup config so dynamic import survives bundling"
  - "HeyGen install uses same askYesNo private function in lazy.ts (not extracted -- Pitfall 2 avoided)"
  - "Phase 7 boundary stub: actual HeyGen video submission exits with error (not silently no-op)"

patterns-established:
  - "Optional renderer packages: mark external in tsup, lazy-install on demand, dynamic import after install"
  - "Deep merge pattern for new config sections: both video and heygen added to loadConfig return"

requirements-completed:
  - REND-12
  - SAFE-03

# Metrics
duration: 15min
completed: 2026-04-15
---

# Phase 05 Plan 02: HeyGen CLI Integration Summary

**`--renderer=heygen` flag wired into render and run commands with preflight validation, credit/USD cost display, and dry-run exit; config schema extended with video.renderer and heygen.avatarId/voiceId sections**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-15T00:00:00Z
- **Completed:** 2026-04-15T00:15:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Extended `BuildStoryConfig` with `video?` and `heygen?` sections including deep merge in `loadConfig`
- Added `detectHeyGenPackage` and `ensureHeyGenPackage` to `lazy.ts` reusing private `askYesNo`
- Added `--renderer <renderer>` option to both `render` and `run` commands in `index.ts`
- Implemented full HeyGen dispatch branch in `render.ts`: ensureHeyGenPackage, preflight, cost estimate (scenes/credits/USD), dry-run exit, Phase 7 stub error
- Implemented matching HeyGen dispatch branch in `run.ts` using `arc.beats`
- Fixed tsup build by marking `@buildstory/heygen` as external (Rule 3 deviation)

## Task Commits

1. **Task 1: Extend config schema and add HeyGen lazy install** - `d884827` (feat)
2. **Task 2: Add --renderer flag and HeyGen dispatch** - `b68d6ea` (feat)

## Files Created/Modified

- `packages/cli/src/config.ts` - Added `video?` and `heygen?` interface sections with deep merge
- `packages/cli/src/lazy.ts` - Added `detectHeyGenPackage` and `ensureHeyGenPackage` exports
- `packages/cli/src/commands/render.ts` - Added `renderer?` opt, renderer resolution, HeyGen branch wrapping existing Remotion path
- `packages/cli/src/commands/run.ts` - Added `renderer?` opt, renderer resolution, HeyGen branch in `!skipVideo` block
- `packages/cli/src/index.ts` - Added `--renderer <renderer>` option to `render` and `run` commands
- `packages/cli/tsup.config.ts` - Added `external: ['@buildstory/heygen']` for lazy dynamic import

## Decisions Made

- API key sourced only from `process.env['HEYGEN_API_KEY']` -- never from config (T-05-04 threat mitigation)
- `@buildstory/heygen` marked external in tsup config so the dynamic import is preserved at runtime rather than bundled or erroring at build time
- Phase 7 boundary: HeyGen branch exits with error after dry-run/preflight rather than silently no-op, preventing confusion

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mark @buildstory/heygen as external in tsup config**
- **Found during:** Task 2 (build step)
- **Issue:** `@buildstory/heygen` is not a declared workspace dependency (intentionally -- lazily installed), so esbuild could not resolve the dynamic import at bundle time, causing build failure with "Could not resolve @buildstory/heygen"
- **Fix:** Added `external: ['@buildstory/heygen']` to `packages/cli/tsup.config.ts` so esbuild leaves the dynamic import path as-is in the output bundle
- **Files modified:** `packages/cli/tsup.config.ts`
- **Verification:** `pnpm --filter buildstory build` exits 0
- **Committed in:** `b68d6ea` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for build to succeed. The plan's lazy install pattern implicitly requires this tsup config entry -- it was an omission in the plan, not a scope change.

## Issues Encountered

None beyond the tsup external fix documented above.

## User Setup Required

None - no external service configuration required for this plan. (HEYGEN_API_KEY is required at runtime when using `--renderer=heygen`, but that is documented in Phase 05-01.)

## Known Stubs

- `HeyGen video submission not yet implemented (Phase 7).` -- render.ts line 75 and run.ts corresponding line. Intentional Phase 7 boundary. Both branches reach this stub only after passing preflight and dry-run checks.

## Next Phase Readiness

- CLI fully wired for `--renderer=heygen` with preflight and cost estimation
- `buildstory render --renderer=heygen --dry-run` works end-to-end (pending HEYGEN_API_KEY, avatarId, voiceId)
- Ready for Phase 7: actual HeyGen video submission implementation

---
*Phase: 05-heygen-package*
*Completed: 2026-04-15*
