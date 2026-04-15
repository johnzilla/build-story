# Roadmap: BuildStory

## Milestones

- ✅ **v1.0 MVP** - Phases 1-4 (shipped 2026-04-14)
- 🚧 **v1.1 HeyGen Renderer Exploration** - Phases 5-7 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) - SHIPPED 2026-04-14</summary>

BuildStory goes from zero to narrated MP4 in four phases. Phase 1 locks in the monorepo scaffold and package boundaries — the ESLint enforcement and core/CLI separation that make everything else safe to build. Phase 2 delivers the scanner: artifact-aware markdown extraction combined with git history produces the Timeline JSON that all downstream phases consume. Phase 3 turns Timeline into StoryArc via LLM narration with style presets, beat classification, and cost guards, then formats it into multiple text outputs. Phase 4 closes the loop with frame generation, TTS, FFmpeg assembly, and a complete CLI surface — producing a watchable MP4 from real planning artifacts.

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
**Goal**: Users can run one command and get a narrated video of their build journey with engaging voice, visual timeline, and decision callouts — something they'd share on X
**Depends on**: Phase 3
**Requirements**: NARR-10, NARR-11, NARR-12, REND-01, REND-02, REND-03, REND-04, REND-05, REND-06, REND-07, REND-08, REND-09, REND-10, REND-11, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07
**Design doc**: `~/.gstack/projects/johnzilla-build-story/john-main-design-20260406-213135.md` (APPROVED, 8/10)
**Success Criteria** (what must be TRUE):
  1. `buildstory run ~/my-project` produces an MP4 video with narrated audio and visual timeline in `buildstory-out/<project>/`
  2. The narration sounds like a person telling a story, not a bot reading docs — punchy, second-person, with stakes
  3. Audio and video are in sync (ffprobe-measured durations, not estimated)
  4. `buildstory render <story-arc.json>` produces MP4 + SRT from an existing story arc
  5. Running render before Remotion is installed, Chrome is available, or API keys are set fails immediately with actionable error messages
  6. Total pipeline time under 10 minutes for a typical project (100-200 events)
**Plans:** 4 plans

Plans:
- [x] 04-01-PLAN.md — Core type extensions (StoryBeat schema, "story" style prompt, warning accumulation)
- [x] 04-02-PLAN.md — @buildstory/video package scaffold, TTS orchestration, ffprobe measurement, preflight checks
- [x] 04-03-PLAN.md — Remotion composition, 4 scene components, renderVideo() orchestrator, SRT generation
- [x] 04-04-PLAN.md — CLI wiring (render command, run pipeline extension, lazy install, all flags)

</details>

### v1.1 HeyGen Renderer Exploration (In Progress)

**Milestone Goal:** Add HeyGen as a standalone alternative video renderer — avatar-narrated build stories via a pluggable provider interface — without touching the existing Remotion pipeline.

#### Phase 5: HeyGen Package
**Goal**: The `@buildstory/heygen` package exists with a VideoRenderer interface, API key configuration, preflight validation, cost estimation, and dry-run support — so no HeyGen credits are spent before the user has verified intent
**Depends on**: Phase 4
**Requirements**: REND-12, REND-13, HGVR-01, SAFE-01, SAFE-02, SAFE-03, SAFE-04
**Success Criteria** (what must be TRUE):
  1. `@buildstory/heygen` builds independently as a workspace package with zero imports from `@buildstory/video`
  2. Running any HeyGen render command without `HEYGEN_API_KEY` set prints an actionable error and exits — no API call is made
  3. `buildstory render --renderer=heygen --dry-run <story-arc.json>` prints the full plan (scene count, estimated credits, avatar, voice) and exits without calling HeyGen
  4. Cost estimation output shows estimated credits and USD before any submission prompt
**Plans:** 2 plans

Plans:
- [x] 05-01-PLAN.md — @buildstory/heygen package scaffold with types, preflight validation, and cost estimation
- [x] 05-02-PLAN.md — CLI integration: config schema, lazy install, --renderer flag, renderer dispatch

#### Phase 6: StoryArc Adapter
**Goal**: StoryArc beats are faithfully translated into HeyGen video_inputs — with beat-type background colors and automatic chunking for large arcs — as a pure, unit-tested function that never calls the HeyGen API
**Depends on**: Phase 5
**Requirements**: HGVR-05, HGVR-06, HGVR-07
**Success Criteria** (what must be TRUE):
  1. A StoryArc with 5 beats produces a single video_inputs array where each beat's narration text appears as the scene script
  2. Each beat type (idea, pivot, obstacle, decision, etc.) maps to a visually distinct background color in the HeyGen scene
  3. A StoryArc with 15 beats is split into two chunked calls (≤10 beats each) with no narration text dropped
  4. The adapter function is fully unit-tested without any network calls or HeyGen credentials
**Plans:** 2 plans

Plans:
- [x] 06-01-PLAN.md — TDD: adapter types, unit tests, and adaptStoryArc implementation (color map, truncation, chunking)
- [x] 06-02-PLAN.md — Wire adapter exports into @buildstory/heygen public API and verify build

#### Phase 7: HeyGen API + CLI Integration
**Goal**: Users can submit a StoryArc to HeyGen, wait for completion with visible polling progress, download the MP4, and select this path via `--renderer=heygen` — the full end-to-end flow works
**Depends on**: Phase 6
**Requirements**: HGVR-02, HGVR-03, HGVR-04, CLI-08, CLI-09
**Success Criteria** (what must be TRUE):
  1. `buildstory render --renderer=heygen <story-arc.json>` submits to HeyGen, polls with progress output, and saves the downloaded MP4 to the output directory
  2. If HeyGen does not complete within the configured timeout, the command exits with a clear error and the video ID so the user can check manually
  3. `buildstory run --renderer=heygen <paths>` runs the full scan → narrate → HeyGen render pipeline end-to-end
  4. `buildstory.toml` with `[video] renderer = "heygen"` and `[heygen] avatar_id` / `voice_id` is respected without any CLI flags
**Plans**: TBD
**UI hint**: no

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Scaffold | v1.0 | 2/2 | Complete | 2026-04-05 |
| 2. Scanner | v1.0 | 3/3 | Complete | 2026-04-05 |
| 3. Narrator | v1.0 | 3/3 | Complete | - |
| 4. Renderer | v1.0 | 4/4 | Complete | 2026-04-14 |
| 5. HeyGen Package | v1.1 | 2/2 | Complete | - |
| 6. StoryArc Adapter | v1.1 | 0/2 | Planned | - |
| 7. HeyGen API + CLI Integration | v1.1 | 0/TBD | Not started | - |
