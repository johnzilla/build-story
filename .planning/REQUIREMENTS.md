# Requirements: BuildStory

**Defined:** 2026-04-05
**Core Value:** Extract the build story from planning artifacts and make it consumable

## v1 Requirements

### Infrastructure

- [ ] **INFRA-01**: Monorepo scaffold with pnpm workspaces (`@buildstory/core`, `buildstory` CLI)
- [ ] **INFRA-02**: `@buildstory/core` exposes typed public API (`scan()`, `narrate()`, `render()`) with zero CLI/config imports
- [ ] **INFRA-03**: CLI wrapper parses args and loads `buildstory.toml`, delegates to core functions
- [ ] **INFRA-04**: `buildstory.toml` configuration at project-level and `~/.config/buildstory/config.toml` for global defaults
- [ ] **INFRA-05**: ESLint boundary rule preventing core from importing CLI/config concerns
- [ ] **INFRA-06**: `buildstory run` command executes full pipeline (scan -> narrate -> render)

### Scanning

- [ ] **SCAN-01**: Filesystem walker traverses directories with configurable include/exclude glob patterns
- [ ] **SCAN-02**: Detects GStack artifacts (PLANNING.md, PLAN.md, ARCHITECTURE.md, DECISIONS.md, ROADMAP.md, STATUS.md, CHANGELOG.md, *.gstack, .gstack/)
- [ ] **SCAN-03**: Detects GSD artifacts (TASKS.md, TODO.md, SESSION_LOG.md, BLOCKERS.md, *.gsd, .gsd/)
- [ ] **SCAN-04**: Detects generic planning artifacts (ADR/ directories, docs/, .claude/, README.md)
- [ ] **SCAN-05**: Extracts markdown structure: headings, dates, content summaries, status markers, cross-references
- [ ] **SCAN-06**: Git history integration: commit messages with timestamps, git blame per-line dating, branch/merge events, tags
- [ ] **SCAN-07**: Produces structured Timeline JSON with events, metadata, and date ranges
- [ ] **SCAN-08**: Planning-artifact timeline merges document events with git events to capture the decision arc
- [ ] **SCAN-09**: Cross-reference detection between artifacts via path references and link patterns
- [ ] **SCAN-10**: User can configure custom artifact patterns via `buildstory.toml` or ScanOptions
- [ ] **SCAN-11**: Configurable max directory depth (default: 5)

### Narration

- [ ] **NARR-01**: LLM narrator supports Anthropic (Claude) provider via official SDK
- [ ] **NARR-02**: LLM narrator supports OpenAI provider via official SDK
- [ ] **NARR-03**: Four narrative style presets: technical, overview, retrospective, pitch
- [ ] **NARR-04**: Beat classification using 9 beat types (idea, goal, attempt, obstacle, pivot, side_quest, decision, result, open_loop) per StoryBeat schema
- [ ] **NARR-05**: Each scene includes source event links tracing back to timeline events
- [ ] **NARR-06**: Word count and estimated reading time per format output
- [ ] **NARR-07**: Produces StoryArc JSON with beats + text format outputs (outline.md, thread.md, blog.md, video-script.md)
- [ ] **NARR-08**: LLM cost guard: configurable max input tokens to prevent runaway API costs on large repos
- [ ] **NARR-09**: Deterministic output: same input produces equivalent script (seed-stable prompts)

### Rendering

- [ ] **REND-01**: Frame generation for each visual type using node-canvas or sharp
- [ ] **REND-02**: TTS audio generation via OpenAI TTS API
- [ ] **REND-03**: TTS engine abstraction allowing future Piper and ElevenLabs integration
- [ ] **REND-04**: FFmpeg assembly via direct child_process spawn (not fluent-ffmpeg)
- [ ] **REND-05**: Video output as MP4 (H.264 + AAC)
- [ ] **REND-06**: Subtitle generation as SRT file from narration text
- [ ] **REND-07**: Scene transitions (crossfade, slide, cut)
- [ ] **REND-08**: Background music mixing with configurable volume
- [ ] **REND-09**: ffprobe-measured TTS duration drives frame count (not estimated duration)
- [ ] **REND-10**: Batch-and-release frame generation to prevent node-canvas memory leaks
- [ ] **REND-11**: Preflight checks: fail fast with actionable error if FFmpeg, API keys, or TTS are missing

### CLI

- [ ] **CLI-01**: `buildstory scan <paths>` command outputs timeline.json
- [ ] **CLI-02**: `buildstory narrate <timeline.json>` command outputs story-arc.json + outline.md, thread.md, blog.md, video-script.md
- [ ] **CLI-03**: `buildstory render <script.json>` command outputs MP4 + SRT
- [ ] **CLI-04**: `buildstory run <paths>` command runs full pipeline
- [ ] **CLI-05**: Global options: --verbose, --quiet, --config
- [ ] **CLI-06**: Progress indicators during long-running operations (scan, narrate, render)
- [ ] **CLI-07**: `buildstory config` command to show/edit configuration

## v2 Requirements

### n8n Integration

- **N8N-01**: Scanner node wrapping `@buildstory/core` scan()
- **N8N-02**: Narrator node wrapping `@buildstory/core` narrate()
- **N8N-03**: Renderer node wrapping `@buildstory/core` render()
- **N8N-04**: Credential definitions for Anthropic and TTS APIs
- **N8N-05**: Published to npm as `n8n-nodes-buildstory`

### Extended TTS

- **TTS-01**: Piper (local/free/offline) TTS engine support
- **TTS-02**: ElevenLabs TTS engine support with voice cloning

### Advanced Features

- **ADV-01**: MCP server exposing scan and narrate as tools
- **ADV-02**: GitHub Action wrapper
- **ADV-03**: Multi-repo scanning and cross-project timelines
- **ADV-04**: Incremental scanning (diff against previous timeline)
- **ADV-05**: Custom visual themes/color schemes
- **ADV-06**: Interactive script editing (TUI or web preview)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Web UI or dashboard | Duplicates CLI; adds frontend stack, auth, session management |
| Real-time/streaming video | FFmpeg requires all frames; wrong architecture for offline CLI tool |
| Cloud hosting of videos | Turns toolkit into SaaS with storage/CDN costs; users upload to YouTube themselves |
| AI-generated imagery (Midjourney, SD) | Cost, consistency, latency problems; data-driven frames are deterministic and fast |
| Automatic social media publishing | OAuth complexity; n8n already solves this downstream |
| Non-GStack/GSD planning tools | Extensibility comes in v2+; custom patterns provide an escape hatch |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| INFRA-05 | Phase 1 | Pending |
| INFRA-06 | Phase 1 | Pending |
| SCAN-01 | Phase 2 | Pending |
| SCAN-02 | Phase 2 | Pending |
| SCAN-03 | Phase 2 | Pending |
| SCAN-04 | Phase 2 | Pending |
| SCAN-05 | Phase 2 | Pending |
| SCAN-06 | Phase 2 | Pending |
| SCAN-07 | Phase 2 | Pending |
| SCAN-08 | Phase 2 | Pending |
| SCAN-09 | Phase 2 | Pending |
| SCAN-10 | Phase 2 | Pending |
| SCAN-11 | Phase 2 | Pending |
| NARR-01 | Phase 3 | Pending |
| NARR-02 | Phase 3 | Pending |
| NARR-03 | Phase 3 | Pending |
| NARR-04 | Phase 3 | Pending |
| NARR-05 | Phase 3 | Pending |
| NARR-06 | Phase 3 | Pending |
| NARR-07 | Phase 3 | Pending |
| NARR-08 | Phase 3 | Pending |
| NARR-09 | Phase 3 | Pending |
| REND-01 | Phase 4 | Pending |
| REND-02 | Phase 4 | Pending |
| REND-03 | Phase 4 | Pending |
| REND-04 | Phase 4 | Pending |
| REND-05 | Phase 4 | Pending |
| REND-06 | Phase 4 | Pending |
| REND-07 | Phase 4 | Pending |
| REND-08 | Phase 4 | Pending |
| REND-09 | Phase 4 | Pending |
| REND-10 | Phase 4 | Pending |
| REND-11 | Phase 4 | Pending |
| CLI-01 | Phase 2 | Pending |
| CLI-02 | Phase 3 | Pending |
| CLI-03 | Phase 4 | Pending |
| CLI-04 | Phase 4 | Pending |
| CLI-05 | Phase 4 | Pending |
| CLI-06 | Phase 4 | Pending |
| CLI-07 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 44 total
- Mapped to phases: 44
- Unmapped: 0

---
*Requirements defined: 2026-04-05*
*Last updated: 2026-04-06 after Phase 3 plan 01 — realigned NARR-04, NARR-06, NARR-07, CLI-02 per D-09/D-11/D-12*
