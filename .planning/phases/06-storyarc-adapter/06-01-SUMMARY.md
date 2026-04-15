---
phase: 06-storyarc-adapter
plan: "01"
subsystem: heygen-adapter
tags: [tdd, pure-function, type-safety, beat-colors, chunking, truncation]
dependency_graph:
  requires:
    - "@buildstory/core (StoryArc, StoryBeat, BeatType)"
    - "packages/heygen/src/types.ts (HeyGenOptions, PreflightResult)"
  provides:
    - "adaptStoryArc() — StoryArc → AdaptResult (chunks of HeyGenScene[])"
    - "HeyGenScene type (character, voice, background shape)"
    - "AdaptOptions / AdaptOptionsSchema (avatarId, voiceId, speed, avatarStyle)"
    - "AdaptResult type (chunks + warnings)"
  affects:
    - "packages/heygen/src/index.ts (new exports)"
    - "packages/core/src/index.ts (BeatType + BeatTypeSchema now public)"
tech_stack:
  added: []
  patterns:
    - "Record<BeatType, string> for compile-time exhaustive color map"
    - "Sentence-boundary truncation with regex backward scan + hard-cut fallback"
    - "Generic chunkBeats<T> returning [[]] for empty input"
    - "Warning accumulator pattern (no console.warn)"
    - "Conditional spread for optional scene fields (speed, avatarStyle)"
key_files:
  created:
    - packages/heygen/src/adapter.ts
    - packages/heygen/src/__tests__/adapter.test.ts
  modified:
    - packages/heygen/src/types.ts
    - packages/heygen/src/index.ts
    - packages/core/src/index.ts
decisions:
  - "Used StoryBeat['type'] equivalently via BeatType — added BeatType export to @buildstory/core (was missing, needed by adapter for Record<BeatType, string>)"
  - "Dropped 'as const' from BEAT_COLOR_MAP — Record<BeatType, string> annotation already enforces exhaustiveness; 'as const' caused TS2322 on lookup result"
  - "Conditional spread pattern for optional HeyGenScene fields — keeps undefined out of the emitted object without extra conditionals"
metrics:
  duration: "~3 minutes"
  completed: "2026-04-15"
  tasks_completed: 2
  files_changed: 5
requirements_addressed:
  - HGVR-05
  - HGVR-06
  - HGVR-07
---

# Phase 6 Plan 1: StoryArc Adapter Summary

**One-liner:** Pure `adaptStoryArc()` function mapping StoryArc beats to chunked HeyGenScene arrays with D-02 color palette, 1500-char sentence-boundary truncation, and warning accumulation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add adapter types + failing tests | c70ea40 | types.ts, `__tests__/adapter.test.ts` |
| 2 (GREEN) | Implement adaptStoryArc | 78fd9fd | adapter.ts, index.ts (heygen), index.ts (core) |

## What Was Built

`packages/heygen/src/adapter.ts` implements:

- **`adaptStoryArc(arc, opts)`** — exported pure function; maps each beat through `beatToScene`, chunks scenes into groups of max 10, returns `{ chunks, warnings }`
- **`BEAT_COLOR_MAP`** — `Record<BeatType, string>` with all 9 D-02 hex values; compile-time exhaustiveness check via TypeScript
- **`truncateSummary(text)`** — internal helper; returns `{ text, truncated }`; if text exceeds 1500 chars, finds last `.`/`!`/`?` boundary before the limit; falls back to hard-cut if none found
- **`chunkBeats<T>(items, size)`** — generic internal helper; returns `[[]]` for empty input, otherwise standard slice loop
- **`beatToScene(beat, opts)`** — internal helper building `HeyGenScene` from a beat and adapt options

`packages/heygen/src/types.ts` additions:

- `HeyGenScene` interface (character/voice/background nested shape)
- `AdaptOptionsSchema` Zod schema + `AdaptOptions` inferred type
- `AdaptResult` interface (chunks + warnings)

`packages/heygen/src/index.ts` additions:

- `export { adaptStoryArc }` from adapter.js
- `export { AdaptOptionsSchema }` from types.js
- `export type { HeyGenScene, AdaptOptions, AdaptResult }` from types.js

`packages/core/src/index.ts` additions:

- `export { BeatTypeSchema }` and `export type { BeatType }` — required for adapter's `Record<BeatType, string>` type annotation

## Test Coverage

36 tests across 5 describe blocks:

| Block | Tests |
|-------|-------|
| beat-to-scene mapping | 12 |
| beat-type colors | 9 (one per BeatType) |
| chunking | 8 |
| truncation | 4 |
| warnings | 3 |

All 36 pass. Build succeeds for both `@buildstory/core` and `@buildstory/heygen`.

## TDD Gate Compliance

- RED gate: commit `c70ea40` — `test(06-01): add failing tests for StoryArc adapter`
- GREEN gate: commit `78fd9fd` — `feat(06-01): implement adaptStoryArc with color map, truncation, and chunking`
- REFACTOR gate: not needed — implementation was clean on first pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] BeatType not exported from @buildstory/core**
- **Found during:** Task 2 (build / DTS phase)
- **Issue:** `adapter.ts` imports `BeatType` from `@buildstory/core` per the plan spec, but the type was not in core's public exports — causing `TS2305: Module '@buildstory/core' has no exported member 'BeatType'`
- **Fix:** Added `BeatTypeSchema` and `BeatType` to `packages/core/src/index.ts` exports alongside existing story type exports
- **Files modified:** `packages/core/src/index.ts`
- **Commit:** 78fd9fd

**2. [Rule 1 - Bug] TS2322 on BEAT_COLOR_MAP lookup with `as const`**
- **Found during:** Task 2 (build / DTS phase)
- **Issue:** `as const` on the `Record<BeatType, string>` object caused TypeScript to infer values as literal string types, making `BEAT_COLOR_MAP[beat.type]` return `string | undefined` instead of `string`
- **Fix:** Removed `as const` — the `Record<BeatType, string>` type annotation already enforces compile-time exhaustiveness; `as const` was redundant and counterproductive here
- **Files modified:** `packages/heygen/src/adapter.ts`
- **Commit:** 78fd9fd

## Known Stubs

None — `adaptStoryArc` returns fully populated HeyGenScene objects from real StoryArc beat data.

## Threat Flags

No new security surface introduced. `AdaptOptions` intentionally excludes `apiKey` (T-06-01 mitigation confirmed present). `BEAT_COLOR_MAP` is a plain object constant (T-06-02 accepted).

## Self-Check: PASSED
