# Roadmap: BuildStory

## Overview

BuildStory goes from zero to narrated MP4 in four phases. Phase 1 locks in the monorepo scaffold and package boundaries — the ESLint enforcement and core/CLI separation that make everything else safe to build. Phase 2 delivers the scanner: artifact-aware markdown extraction combined with git history produces the Timeline JSON that all downstream phases consume. Phase 3 turns Timeline into StoryArc via LLM narration with style presets, beat classification, and cost guards, then formats it into multiple text outputs. Phase 4 closes the loop with frame generation, TTS, FFmpeg assembly, and a complete CLI surface — producing a watchable MP4 from real planning artifacts.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Scaffold** - Monorepo foundation with enforced core/CLI boundary and typed pipeline stubs
- [ ] **Phase 2: Scanner** - Artifact-aware timeline extraction from planning files and git history
- [ ] **Phase 3: Narrator** - LLM narration with style presets, beat classification, format generation, and cost guards
- [ ] **Phase 4: Renderer** - Frame generation, TTS, FFmpeg assembly, and complete CLI surface

## Phase Details

### Phase 1: Scaffold
**Goal**: The monorepo is set up with enforced boundaries so all subsequent phases build on a safe, consistent foundation
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06
**Success Criteria** (what must be TRUE):
  1. `pnpm install` succeeds and `@buildstory/core` and `buildstory` CLI packages are independently buildable
  2. `buildstory run` executes without error and returns empty/stub results (pipeline wired end-to-end)
  3. ESLint reports an error if any file in `packages/core/src/` imports `fs`, `process.env`, or config libraries
  4. `buildstory.toml` is loaded by the CLI and surfaced as typed options passed to core functions
**Plans:** 2 plans
Plans:
- [x] 01-01-PLAN.md — Monorepo scaffold with core package, typed stubs, and ESLint boundary rule
- [x] 01-02-PLAN.md — CLI wrapper with Commander, TOML config, and buildstory run end-to-end

### Phase 2: Scanner
**Goal**: Users can scan a directory of planning artifacts and produce a structured Timeline JSON capturing the full decision arc
**Depends on**: Phase 1
**Requirements**: SCAN-01, SCAN-02, SCAN-03, SCAN-04, SCAN-05, SCAN-06, SCAN-07, SCAN-08, SCAN-09, SCAN-10, SCAN-11, CLI-01
**Success Criteria** (what must be TRUE):
  1. `buildstory scan <path>` produces a valid `timeline.json` with chronologically ordered events and stable event IDs
  2. GStack artifacts (PLANNING.md, ROADMAP.md, DECISIONS.md, etc.) and GSD artifacts (TASKS.md, SESSION_LOG.md, etc.) appear as distinct typed events in the timeline
  3. Git tags appear as milestone events in the timeline; file events are enriched with git commit dates (branch/merge events deferred per D-04)
  4. Cross-references between artifacts are detected and represented in the timeline event graph
  5. Custom artifact include/exclude patterns in `buildstory.toml` or ScanOptions are respected by the walker
**Plans:** 3 plans
Plans:
- [x] 02-01-PLAN.md — Extend type contracts (GitSource, ArtifactSource, TimelineEvent) and install scanner dependencies
- [x] 02-02-PLAN.md — Core scan implementation (file-walker, artifact-parser, timeline-builder, scan orchestrator)
- [x] 02-03-PLAN.md — CLI adapters (fs-source with redaction, git-source with simple-git) and buildstory scan command

### Phase 3: Narrator
**Goal**: Users can generate a StoryArc from a Timeline via LLM narration with 4 style presets, then format it into 4 text outputs (outline, thread, blog, video-script) with token cost guards
**Depends on**: Phase 2
**Requirements**: NARR-01, NARR-02, NARR-03, NARR-04, NARR-05, NARR-06, NARR-07, NARR-08, NARR-09, CLI-02
**Success Criteria** (what must be TRUE):
  1. `buildstory narrate <timeline.json>` produces a valid StoryArc JSON and 4 text format files (outline.md, thread.md, blog.md, video-script.md)
  2. Passing `--style technical|overview|retrospective|pitch` produces meaningfully different narration for the same timeline
  3. Running narrate twice with the same input and `temperature: 0` produces equivalent output (deterministic prompts)
  4. Narrate fails with a clear error message when estimated input tokens exceed the configured `maxInputTokens` limit
**Plans:** 3 plans
Plans:
- [x] 03-01-PLAN.md — Install LLM SDKs, LLMProvider interface, style/format prompts, token guard, chunker
- [x] 03-02-PLAN.md — Anthropic and OpenAI provider implementations, narrate() and format() orchestration
- [x] 03-03-PLAN.md — CLI narrate command, run command update, end-to-end verification

### Phase 4: Renderer
**Goal**: Users can render a Script JSON into a watchable MP4 with synchronized narration audio, subtitles, and scene transitions
**Depends on**: Phase 3
**Requirements**: REND-01, REND-02, REND-03, REND-04, REND-05, REND-06, REND-07, REND-08, REND-09, REND-10, REND-11, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07
**Success Criteria** (what must be TRUE):
  1. `buildstory render <script.json>` produces an MP4 (H.264 + AAC) and an SRT subtitle file in `buildstory-out/`
  2. Audio and video are in sync — narration speech matches the correct scene throughout the video
  3. `buildstory run <path>` executes all three pipeline phases in sequence and produces the final MP4
  4. Running render before FFmpeg is installed or without a TTS API key fails immediately with an actionable error message
  5. `buildstory config` shows the active configuration and `--verbose`, `--quiet`, `--config` flags work across all subcommands
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scaffold | 2/2 | Complete | 2026-04-05 |
| 2. Scanner | 3/3 | Complete | 2026-04-05 |
| 3. Narrator | 0/3 | Executing | - |
| 4. Renderer | 0/? | Not started | - |
