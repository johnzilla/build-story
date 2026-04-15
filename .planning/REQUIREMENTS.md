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
- [ ] **NARR-10**: "story" narrative style with punchy second-person voice, humor, stakes — avg sentence under 15 words
- [ ] **NARR-11**: StoryBeat schema extension: optional visual_cue, tone, duration_seconds fields for video rendering
- [ ] **NARR-12**: Narration warnings returned in StoryArc metadata (not console.warn) — core stays pure

### Rendering

- [ ] **REND-01**: Video composition via Remotion (React-based programmatic video) in new `@buildstory/video` package
- [ ] **REND-02**: TTS audio generation via OpenAI TTS API with parallel concurrency (default: 2)
- [ ] **REND-03**: TTS cost estimation printed before API calls; --dry-run flag to preview costs without calling APIs
- [ ] **REND-04**: Remotion renders MP4 via headless Chrome — no custom canvas+FFmpeg pipeline
- [ ] **REND-05**: Video output as MP4 (H.264 + AAC)
- [ ] **REND-06**: Subtitle generation as SRT file from narration text
- [ ] **REND-07**: 4 scene components: TitleCard, TimelineBar, DecisionCallout, StatsCard with beat-type mapping
- [ ] **REND-08**: Per-scene audio via Remotion `<Audio>` components with ffprobe-measured startFrom offsets
- [ ] **REND-09**: ffprobe-measured TTS duration drives frame count (not estimated duration)
- [ ] **REND-10**: Lazy Remotion install — @buildstory/video installed on first `render` use (~200MB)
- [ ] **REND-11**: Preflight checks before TTS: verify Remotion installed, headless Chrome available, API keys present. Fail fast.

### CLI

- [ ] **CLI-01**: `buildstory scan <paths>` command outputs timeline.json
- [ ] **CLI-02**: `buildstory narrate <timeline.json>` command outputs story-arc.json + text formats
- [ ] **CLI-03**: `buildstory render <story-arc.json>` command outputs MP4 + SRT from existing story arc
- [ ] **CLI-04**: `buildstory run <paths>` command runs full pipeline (scan → narrate → TTS → render)
- [ ] **CLI-05**: `run` defaults to style:"story"; `narrate` keeps style:"overview"
- [ ] **CLI-06**: Progress indicators during long-running operations including Remotion render frame count
- [ ] **CLI-07**: Video mode skips text format generation; --include-text flag to add them back

## v1.1 Requirements

Requirements for HeyGen Renderer Exploration milestone.

### Renderer Infrastructure

- [ ] **REND-12**: Pluggable VideoRenderer interface exists so CLI can dispatch to Remotion or HeyGen by name
- [ ] **REND-13**: `@buildstory/heygen` is a standalone workspace package with no imports from `@buildstory/video`

### HeyGen Core

- [ ] **HGVR-01**: User can configure `HEYGEN_API_KEY` via environment variable
- [ ] **HGVR-02**: HeyGen renderer submits a video generation request to HeyGen v2 API from a StoryArc
- [ ] **HGVR-03**: HeyGen renderer polls for video completion with exponential backoff and configurable timeout
- [ ] **HGVR-04**: HeyGen renderer downloads completed MP4 to the standard output directory
- [ ] **HGVR-05**: StoryArc beats are mapped to HeyGen video_inputs via an adapter (Strategy A: concatenated narration)
- [ ] **HGVR-06**: Beat types (idea, pivot, obstacle, etc.) map to distinct background colors in HeyGen scenes
- [ ] **HGVR-07**: Story arcs with more than 10 beats are chunked into multiple API calls and output is concatenated

### CLI & Config

- [ ] **CLI-08**: `--renderer=heygen` flag selects HeyGen renderer for render and run commands
- [ ] **CLI-09**: `buildstory.toml` supports `[video] renderer` and `[heygen]` section with avatar_id, voice_id

### Safety & Cost

- [ ] **SAFE-01**: Preflight check validates HEYGEN_API_KEY is set and valid before any API call
- [ ] **SAFE-02**: Cost estimation displays estimated credits and USD before submitting to HeyGen
- [ ] **SAFE-03**: `--dry-run` mode shows full plan (scenes, cost, avatar, voice) without calling HeyGen API
- [ ] **SAFE-04**: Missing API key or invalid configuration fails with an actionable error message

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
- **TTS-03**: TTS checkpoint/resume — persist manifest of completed segments for partial failure recovery

### HeyGen Extensions (v1.2+)

- **CLI-10**: `--avatar` and `--voice` CLI flags override config per-run
- **CLI-11**: `buildstory heygen list-avatars` and `list-voices` discovery commands
- **HGVR-08**: Pre-generated audio passthrough (upload BuildStory TTS audio to HeyGen)
- **HGVR-09**: SRT subtitle generation from audio timing for HeyGen videos

### Advanced Features

- **ADV-01**: MCP server exposing scan and narrate as tools
- **ADV-02**: GitHub Action wrapper
- **ADV-03**: Multi-repo scanning and cross-project timelines
- **ADV-04**: Incremental scanning (diff against previous timeline)
- **ADV-05**: Custom visual themes/color schemes
- **ADV-06**: Interactive script editing (TUI or web preview)
- **ADV-07**: Background music mixing with configurable volume
- **ADV-08**: Live Build Radio — real-time narrated audio of build sessions
- **ADV-09**: GitHub Wrapped / Build Wrapped — shareable HTML stats page
- **ADV-10**: Remotion cloud rendering via Lambda

## Out of Scope

| Feature | Reason |
|---------|--------|
| Web UI or dashboard | Duplicates CLI; adds frontend stack, auth, session management |
| Real-time/streaming video | Wrong architecture for offline CLI tool |
| Cloud hosting of videos | Turns toolkit into SaaS with storage/CDN costs; users upload to YouTube themselves |
| AI-generated imagery (Midjourney, SD) | Cost, consistency, latency problems; data-driven frames are deterministic and fast |
| Automatic social media publishing | OAuth complexity; n8n already solves this downstream |
| Non-GStack/GSD planning tools | Extensibility comes in v2+; custom patterns provide an escape hatch |
| Custom canvas+FFmpeg renderer | Replaced by Remotion per office-hours design review (2026-04-06) |
| TTS engine abstraction (v1) | OpenAI TTS only for v1; Piper/ElevenLabs deferred to v2 (TTS-01, TTS-02) |
| Background music mixing (v1) | Deferred to v2 (ADV-07); focus on narration quality first |
| buildstory config command | Deferred; users edit buildstory.toml directly |
| Hybrid composite mode (HeyGen + Remotion) | Explore standalone HeyGen first before combining |
| Digital twin training | Enterprise-only HeyGen feature; out of scope for exploration |
| Multi-language translation via HeyGen | Future milestone if HeyGen proves valuable |
| Voice cloning via HeyGen | Enterprise/Business tier feature |
| Advanced HeyGen features (interactive, branding) | Future if HeyGen proves valuable |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| INFRA-05 | Phase 1 | Complete |
| INFRA-06 | Phase 1 | Complete |
| SCAN-01 | Phase 2 | Complete |
| SCAN-02 | Phase 2 | Complete |
| SCAN-03 | Phase 2 | Complete |
| SCAN-04 | Phase 2 | Complete |
| SCAN-05 | Phase 2 | Complete |
| SCAN-06 | Phase 2 | Complete |
| SCAN-07 | Phase 2 | Complete |
| SCAN-08 | Phase 2 | Complete |
| SCAN-09 | Phase 2 | Complete |
| SCAN-10 | Phase 2 | Complete |
| SCAN-11 | Phase 2 | Complete |
| CLI-01 | Phase 2 | Complete |
| NARR-01 | Phase 3 | Complete |
| NARR-02 | Phase 3 | Complete |
| NARR-03 | Phase 3 | Complete |
| NARR-04 | Phase 3 | Complete |
| NARR-05 | Phase 3 | Complete |
| NARR-06 | Phase 3 | Complete |
| NARR-07 | Phase 3 | Complete |
| NARR-08 | Phase 3 | Complete |
| NARR-09 | Phase 3 | Complete |
| CLI-02 | Phase 3 | Complete |
| NARR-10 | Phase 4 | Complete |
| NARR-11 | Phase 4 | Complete |
| NARR-12 | Phase 4 | Complete |
| REND-01 | Phase 4 | Complete |
| REND-02 | Phase 4 | Complete |
| REND-03 | Phase 4 | Complete |
| REND-04 | Phase 4 | Complete |
| REND-05 | Phase 4 | Complete |
| REND-06 | Phase 4 | Complete |
| REND-07 | Phase 4 | Complete |
| REND-08 | Phase 4 | Complete |
| REND-09 | Phase 4 | Complete |
| REND-10 | Phase 4 | Complete |
| REND-11 | Phase 4 | Complete |
| CLI-03 | Phase 4 | Complete |
| CLI-04 | Phase 4 | Complete |
| CLI-05 | Phase 4 | Complete |
| CLI-06 | Phase 4 | Complete |
| CLI-07 | Phase 4 | Complete |
| REND-12 | Phase 5 | Pending |
| REND-13 | Phase 5 | Pending |
| HGVR-01 | Phase 5 | Pending |
| SAFE-01 | Phase 5 | Pending |
| SAFE-02 | Phase 5 | Pending |
| SAFE-03 | Phase 5 | Pending |
| SAFE-04 | Phase 5 | Pending |
| HGVR-05 | Phase 6 | Pending |
| HGVR-06 | Phase 6 | Pending |
| HGVR-07 | Phase 6 | Pending |
| HGVR-02 | Phase 7 | Pending |
| HGVR-03 | Phase 7 | Pending |
| HGVR-04 | Phase 7 | Pending |
| CLI-08 | Phase 7 | Pending |
| CLI-09 | Phase 7 | Pending |

**Coverage:**
- v1.0 requirements: 47 total — all mapped, all complete
- v1.1 requirements: 15 total — all mapped, pending
- Unmapped: 0
- Phases 1-4: 47 Complete (v1.0)
- Phase 5: 7 Pending (REND-12, REND-13, HGVR-01, SAFE-01-04)
- Phase 6: 3 Pending (HGVR-05, HGVR-06, HGVR-07)
- Phase 7: 5 Pending (HGVR-02, HGVR-03, HGVR-04, CLI-08, CLI-09)

---
*Requirements defined: 2026-04-05*
*Last updated: 2026-04-14 after v1.1 roadmap creation — added phase mappings for REND-12/13, HGVR-01-07, CLI-08/09, SAFE-01-04*
