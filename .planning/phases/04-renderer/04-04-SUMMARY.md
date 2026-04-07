---
phase: 04-renderer
plan: 04
subsystem: cli
tags: [cli, render, run, lazy-install, tts]
key-files:
  created:
    - packages/cli/src/commands/render.ts
    - packages/cli/src/lazy.ts
  modified:
    - packages/cli/src/commands/run.ts
    - packages/cli/src/index.ts
    - packages/cli/src/config.ts
    - packages/cli/package.json
    - package.json
metrics:
  tasks: 3
  commits: 2
  files_created: 2
  files_modified: 5
---

# Plan 04-04 Summary: CLI Wiring

## What Was Built

Wired the complete CLI surface for video rendering: `buildstory render` command, extended `buildstory run` with TTS + render pipeline, lazy `@buildstory/video` install detection, cost estimation display, Remotion progress indicators, and all CLI flags.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `657a63c` | Add lazy install detection, config TTS section, CLI package dependency |
| 2 | `0abf339` | Create render command and extend run command with TTS+render pipeline |
| 3 | (verified) | Human checkpoint — build and CLI help verified |

## Key Deliverables

- **`buildstory render <story-arc.json>`** — new command renders MP4 + SRT from existing story arc with preflight checks, cost estimation, TTS, and Remotion rendering
- **`buildstory run` extended** — defaults to `--style story`, includes TTS + render pipeline unless `--skip-video`
- **Lazy install** (`lazy.ts`): Detects `@buildstory/video` via dynamic import, prompts Y/n for ~200MB install
- **Config TTS section**: `[tts]` in buildstory.toml with voice/speed settings
- **All CLI flags**: `--skip-video`, `--include-text`, `--dry-run`, `--no-title-card`, `--no-stats-card`
- **Progress indicators**: Remotion `onProgress` wired to ora spinner with frame count

## Deviations

None

## Self-Check: PASSED

- `pnpm build` exits 0 for all 3 packages
- `buildstory run --help` shows style default "story" and all video flags
- `buildstory render --help` shows story-arc argument and render-specific flags
- `buildstory narrate --help` shows style default "overview"
