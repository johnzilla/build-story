---
phase: 06-storyarc-adapter
plan: "02"
subsystem: heygen-adapter
tags: [public-api, exports, build-verification]
dependency_graph:
  requires:
    - "06-01 (adaptStoryArc implementation, adapter types)"
    - "packages/heygen/src/adapter.ts"
    - "packages/heygen/src/types.ts"
  provides:
    - "adaptStoryArc importable from '@buildstory/heygen'"
    - "AdaptOptionsSchema importable from '@buildstory/heygen'"
    - "HeyGenScene, AdaptOptions, AdaptResult types importable from '@buildstory/heygen'"
  affects:
    - "packages/heygen/src/index.ts (adapter re-exports)"
tech_stack:
  added: []
  patterns:
    - "Re-export pattern: value exports on one line, type exports on separate export type line"
key_files:
  created: []
  modified:
    - packages/heygen/src/index.ts
decisions:
  - "06-01 agent proactively wired index.ts exports during adapter implementation (Rule 2 — exports required for package to be usable); 06-02 verification confirmed correct wiring"
metrics:
  duration: "~2 minutes"
  completed: "2026-04-15"
  tasks_completed: 1
  files_changed: 0
requirements_addressed:
  - HGVR-05
---

# Phase 6 Plan 2: Public API Wire-up Summary

**One-liner:** Verified `adaptStoryArc`, `AdaptOptionsSchema`, and adapter types (`HeyGenScene`, `AdaptOptions`, `AdaptResult`) are correctly re-exported from `@buildstory/heygen` public API — build and all 36 tests pass.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Verify adapter exports in index.ts + build | 78fd9fd (06-01) | packages/heygen/src/index.ts |

## What Was Built

The `@buildstory/heygen` package's public `index.ts` exposes the full adapter API:

- `adaptStoryArc` (function) — re-exported from `./adapter.js`
- `AdaptOptionsSchema` (Zod schema) — re-exported from `./types.js`
- `HeyGenScene`, `AdaptOptions`, `AdaptResult` (types) — re-exported from `./types.js`

All original exports remain intact: `preflightHeyGenCheck`, `estimateHeyGenCost`, `HeyGenOptionsSchema`, and existing type exports.

## Verification Results

- `pnpm --filter @buildstory/heygen build` — SUCCESS (ESM + DTS in ~297ms)
- `pnpm --filter @buildstory/heygen exec vitest run` — 36/36 tests pass
- Built `dist/index.d.ts` confirms `adaptStoryArc`, `AdaptOptionsSchema`, `HeyGenScene`, `AdaptOptions`, and `AdaptResult` are all in the exported surface

## Deviations from Plan

### Pre-completed by Prior Wave

**[Rule 2 - Missing Critical Functionality] index.ts exports were wired during 06-01**

- **Found during:** Task 1 (initial read)
- **Issue:** When the 06-01 agent implemented `adaptStoryArc` in `adapter.ts`, it also wired the public exports into `index.ts` in the same commit (`78fd9fd`). This was correct behavior — leaving a new function un-exported would have broken the package's public API contract.
- **Impact on 06-02:** All acceptance criteria were already satisfied at the start of this plan. No code changes were needed.
- **Verification performed:** Build + test suite confirmed all exports are present and functional.

## Known Stubs

None.

## Threat Flags

None. This plan is re-export wiring only — no new logic, network I/O, or trust boundaries introduced.

## Self-Check: PASSED

- `packages/heygen/src/index.ts` contains `export { adaptStoryArc } from './adapter.js'` — FOUND
- `packages/heygen/src/index.ts` contains `export { AdaptOptionsSchema }` — FOUND
- `packages/heygen/src/index.ts` contains `export type { HeyGenScene, AdaptOptions, AdaptResult }` — FOUND
- Build exits 0 — CONFIRMED
- 36/36 tests pass — CONFIRMED
- `dist/index.d.ts` contains `adaptStoryArc` — CONFIRMED
