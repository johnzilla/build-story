---
phase: 07-heygen-api-cli-integration
plan: "02"
subsystem: cli
tags: [heygen, cli, render, run, integration]
dependency_graph:
  requires: [07-01]
  provides: [CLI-08, CLI-09]
  affects: [packages/cli/src/commands/render.ts, packages/cli/src/commands/run.ts]
tech_stack:
  added: ["@buildstory/heygen workspace dependency in CLI package.json"]
  patterns: ["ora spinner with onProgress callback", "try/catch error display with chalk.red", "dynamic import with destructured renderWithHeyGen"]
key_files:
  modified:
    - packages/cli/src/commands/render.ts
    - packages/cli/src/commands/run.ts
    - packages/cli/package.json
    - packages/core/tsconfig.json
    - pnpm-lock.yaml
decisions:
  - "renderWithHeyGen destructured from already-imported heygen module at the call site (no second dynamic import)"
  - "run.ts uses [3/totalSteps] step numbering matching existing Remotion pattern; HeyGen combines TTS+render into one step"
  - "mp4Path is assigned from heygenResult.videoPath so final summary block picks up the correct video path"
  - "Added @buildstory/heygen as workspace dependency to CLI package.json so TypeScript resolves types for dynamic import"
  - "Added composite:true to core tsconfig.json to fix pre-existing project reference error"
metrics:
  completed_date: "2026-04-15"
  tasks_completed: 2
  files_modified: 5
---

# Phase 07 Plan 02: HeyGen CLI Integration Summary

**One-liner:** Replace Phase 7 placeholder stubs in render.ts and run.ts with actual renderWithHeyGen() calls, spinner progress, and error handling — completing the end-to-end HeyGen pipeline.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire renderWithHeyGen into render.ts | 4ef72b9 | packages/cli/src/commands/render.ts, packages/cli/package.json, packages/core/tsconfig.json, pnpm-lock.yaml |
| 2 | Wire renderWithHeyGen into run.ts | 85825f4 | packages/cli/src/commands/run.ts |

## What Was Built

### render.ts (Task 1)

Replaced the Phase 7 `process.exit(1)` placeholder (lines 81-83) with:

- `renderWithHeyGen` destructured from the already-imported `heygen` module
- Output directory and MP4 path constructed via `resolve(opts.output, projectName)`
- `ora` spinner started as "Submitting to HeyGen..." with `onProgress` callback updating `spinner.text` on each poll cycle
- Success path: spinner succeeds with chalk.green, displays warnings if any, prints video output path
- Error path: spinner fails with chalk.red, prints `err.message`, exits with code 1

### run.ts (Task 2)

Replaced the Phase 7 `console.error + process.exit(1)` placeholder (lines 163-164) with:

- `renderWithHeyGen` destructured from the already-imported `heygen` module
- `mp4Path` assigned to `resolve(outputDir, projectName + '.mp4')` before call
- Step-numbered spinner `[3/${totalSteps}] Submitting to HeyGen...` matching Remotion's pattern
- `onProgress` callback prefixes HeyGen status messages with the step number
- `mp4Path = heygenResult.videoPath` after success so final summary block picks up the video path
- Warnings displayed with chalk.yellow; error path matches render.ts pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing dependency] Added @buildstory/heygen to CLI package.json**
- **Found during:** Task 1 verification
- **Issue:** `@buildstory/heygen` was not declared as a dependency in the CLI package.json, so TypeScript could not resolve types for the dynamic import, producing `TS2307: Cannot find module '@buildstory/heygen'`
- **Fix:** Added `"@buildstory/heygen": "workspace:*"` to `dependencies` in `packages/cli/package.json` and ran `pnpm install`
- **Files modified:** packages/cli/package.json, pnpm-lock.yaml
- **Commit:** 4ef72b9

**2. [Rule 1 - Bug] Added composite:true to core tsconfig.json**
- **Found during:** Task 1 verification
- **Issue:** `packages/core/tsconfig.json` was missing `"composite": true`, causing `TS6306: Referenced project must have setting "composite": true` when the CLI tsconfig referenced it. This was a pre-existing error.
- **Fix:** Added `"composite": true` to the `compilerOptions` in `packages/core/tsconfig.json`
- **Files modified:** packages/core/tsconfig.json
- **Commit:** 4ef72b9

### Pre-existing Errors (Out of Scope)

The following TypeScript errors existed before this plan and remain unchanged — they are not caused by plan changes and are out of scope:

- `src/__tests__/run.test.ts(38,3)` — mock missing `getUsage` property
- `src/adapters/git-source.ts(5,15)` — simple-git import type issue
- `src/adapters/git-source.ts(39,17)` — implicit `any` type
- `src/commands/narrate.ts(143)` — undefined index type
- `src/commands/run.ts(91)` — ScanOptions exactOptionalPropertyTypes mismatch (pre-existing)
- `src/commands/run.ts(285)` — undefined index type (pre-existing)
- `src/commands/scan.ts(33)` — ScanOptions exactOptionalPropertyTypes mismatch (pre-existing)
- `src/index.ts(31)` — commander action return type mismatch

## Known Stubs

None. The renderWithHeyGen integration is fully wired — no placeholder code remains in render.ts or run.ts.

## Threat Flags

No new network endpoints, auth paths, or trust boundaries introduced. The `outputPath` construction uses `path.resolve` (T-07-07 mitigation applied). Error display shows only `err.message` (T-07-06 mitigation applied).

## Self-Check: PASSED

- `packages/cli/src/commands/render.ts` — modified and committed (4ef72b9)
- `packages/cli/src/commands/run.ts` — modified and committed (85825f4)
- `packages/cli/package.json` — @buildstory/heygen added (4ef72b9)
- `packages/core/tsconfig.json` — composite:true added (4ef72b9)
- No "not yet implemented" or "Phase 7" strings in render.ts or run.ts
- renderWithHeyGen called in both files
- TypeScript errors in render.ts and run.ts specific to new HeyGen code: 0
