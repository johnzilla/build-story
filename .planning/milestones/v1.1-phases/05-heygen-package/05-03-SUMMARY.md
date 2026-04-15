---
phase: 05-heygen-package
plan: 03
status: complete
started: 2026-04-15
completed: 2026-04-15
gap_closure: true
key_files:
  modified:
    - packages/cli/src/commands/render.ts
deviations: []
decisions: []
self_check: PASSED
---

# Plan 05-03: VideoRenderer Interface (Gap Closure)

## What was done

Added the `VideoRenderer` interface declaration to `packages/cli/src/commands/render.ts` to satisfy REND-12. The interface defines the type contract for renderer plugins with three members: `readonly name`, `preflight(opts)`, and `estimateCost(beats)`. Added `StoryBeat` to the type import from `@buildstory/core`.

## Gap closed

- **REND-12**: "Pluggable VideoRenderer interface exists so CLI can dispatch to Remotion or HeyGen by name" — now satisfied with the inline interface declaration per D-02 (no plugin registry).

## What changed

- `packages/cli/src/commands/render.ts`: Added `VideoRenderer` interface (lines 11-15), added `StoryBeat` to type import (line 5)

## Verification

- `grep "interface VideoRenderer" packages/cli/src/commands/render.ts` — 1 match
- `pnpm --filter buildstory build` — exits 0
- No runtime behavior change — existing if/else dispatch untouched

## Self-Check: PASSED

All acceptance criteria verified. CLI builds successfully with the new type.
