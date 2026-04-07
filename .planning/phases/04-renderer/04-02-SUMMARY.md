---
phase: 04-renderer
plan: 02
subsystem: video-package
tags: [tts, ffprobe, preflight, video]
key-files:
  created:
    - packages/video/package.json
    - packages/video/tsconfig.json
    - packages/video/tsup.config.ts
    - packages/video/src/index.ts
    - packages/video/src/tts/types.ts
    - packages/video/src/tts/generate.ts
    - packages/video/src/tts/measure.ts
    - packages/video/src/tts/index.ts
    - packages/video/src/preflight.ts
  modified:
    - pnpm-lock.yaml
metrics:
  tasks: 3
  commits: 4
  files_created: 9
  files_modified: 1
---

# Plan 04-02 Summary: @buildstory/video Package + TTS + Preflight

## What Was Built

Created the `@buildstory/video` workspace package with TTS orchestration, ffprobe-based audio duration measurement, preflight dependency checks, and cost estimation. This package owns all rendering I/O per D-17 — core stays pure.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `42107b4` | Scaffold @buildstory/video package with dependencies |
| 2 | `ecbd137` | Implement TTS generation, ffprobe measurement, and cost estimation |
| 3 | `d8e7c6c` | Add preflight checks for Remotion, Chrome, ffprobe, and API key |
| - | `cb9cf0f` | Update lockfile for @buildstory/video dependencies |

## Key Deliverables

- **TTS generation** (`generate.ts`): Per-scene audio via OpenAI `audio.speech.create()` with exponential backoff (3 attempts, 2s/4s/8s) and 4096 char chunking
- **ffprobe measurement** (`measure.ts`): Actual audio duration via ffprobe subprocess. `FFPROBE_PATH` env var override supported.
- **TTS orchestrator** (`tts/index.ts`): Concurrent TTS generation (default: 2), cost estimation ($0.015/1000 chars), silence gaps (0.3s between scenes, 1s bookend)
- **Preflight checks** (`preflight.ts`): Upfront verification of Remotion, ffprobe, Chrome, and API key. Single failure report per D-12.
- **Package scaffold**: ESM-only, Remotion 4.0.446 pinned without `^`, tsup build config, workspace linking

## Deviations

None

## Self-Check: PASSED

- `pnpm --filter @buildstory/video build` exits 0
- All acceptance criteria verified
- All key artifacts created and exported
