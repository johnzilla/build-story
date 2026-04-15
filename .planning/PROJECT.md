# BuildStory

## What This Is

BuildStory is a TypeScript monorepo toolkit that scans GStack/GSD planning artifacts across repositories, reconstructs a chronological development timeline, generates a narrative script via LLM, and renders narrated video documentaries. The core logic lives in `@buildstory/core` with thin wrappers for CLI, n8n nodes, and future integrations (MCP server, GitHub Actions).

## Core Value

Extract the build story from planning artifacts and make it consumable — the structured narrative script is the product; video is one output format among many.

## Current State

**Shipped:** v1.1 HeyGen Renderer Exploration (2026-04-15)

BuildStory now supports two video renderers:
- **Remotion** (default) — programmatic React-based video with custom scene components
- **HeyGen** (`--renderer=heygen`) — avatar-narrated video via HeyGen v2 API

The full pipeline works end-to-end: `buildstory run --renderer=heygen <path>` scans artifacts, narrates via LLM, adapts beats to HeyGen scenes with beat-type colors, submits to HeyGen API, polls for completion, downloads MP4, and concatenates chunks for large arcs.

**Packages:** `@buildstory/core`, `@buildstory/video` (Remotion), `@buildstory/heygen`, `buildstory` (CLI)

## Requirements

### Validated

- [x] Monorepo scaffold with pnpm workspaces (`@buildstory/core`, `buildstory` CLI) — v1.0 Phase 1
- [x] Core library with clean public API: `scan()`, `narrate()`, `format()` — v1.0 Phase 1
- [x] Configuration via `buildstory.toml` (project-level and global) — v1.0 Phase 1
- [x] ESLint boundary rule preventing core from importing CLI/config concerns — v1.0 Phase 1
- [x] Filesystem walker detecting GStack/GSD artifacts plus generic planning files — v1.0 Phase 2
- [x] Markdown parser extracting headings, dates, content summaries, status, cross-references — v1.0 Phase 2
- [x] Git history integration: commit messages, git blame dating, tags — v1.0 Phase 2
- [x] Timeline output as structured JSON with events, metadata, and date ranges — v1.0 Phase 2
- [x] LLM narrator supporting Anthropic and OpenAI providers — v1.0 Phase 3
- [x] Four narrative styles: technical, overview, retrospective, pitch — v1.0 Phase 3
- [x] Scene segmentation with visual type assignments and duration pacing — v1.0 Phase 3
- [x] Script output as structured JSON with scenes, narration text, and source event links — v1.0 Phase 3
- [x] Frame generation and Remotion video composition — v1.0 Phase 4
- [x] TTS integration with OpenAI TTS — v1.0 Phase 4
- [x] FFmpeg assembly: frame stitching, audio mixing, fade transitions, subtitle generation — v1.0 Phase 4
- [x] CLI wrapper: `buildstory scan`, `buildstory narrate`, `buildstory render`, `buildstory run` — v1.0 Phase 4
- [x] Configurable artifact detection patterns (include/exclude/custom) — v1.0 Phase 2

### Active

(No active requirements — next milestone TBD)

### Out of Scope

- n8n nodes — deferred to a later milestone after core + CLI ship
- MCP server wrapper — future milestone
- GitHub Action wrapper — future milestone
- Web UI or dashboard — not planned
- Real-time/streaming video — not planned
- Cloud hosting of generated videos — not planned
- Non-GStack/GSD planning tool support — extensibility comes later
- Interactive script editing (TUI/web) — open question, not v1
- Multi-project cross-repo narratives — open question, not v1
- Incremental scanning (diff against previous timeline) — open question, not v1
- Hybrid/composite mode (HeyGen + Remotion in one video) — explore standalone first
- Advanced HeyGen features (interactive video, translation, branding) — future if HeyGen proves valuable
- Training digital twins — out of scope for exploration
- Multi-language support — future milestone

## Context

- Target users are solo devs and small teams using Claude Code CLI with GStack/GSD workflows
- Users already have the raw material (planning artifacts); this tool assembles it into shareable content
- Primary output goes to personal sites, YouTube, and other video/content platforms
- The core library pattern enables future wrappers (n8n, MCP, GitHub Actions) without duplicating logic
- Pivoted from Rust to TypeScript for ecosystem alignment — monorepo consumers (n8n, MCP) are all JS/TS
- OpenAI TTS is the default v1 TTS engine; Piper (local/free) and ElevenLabs (premium) are abstracted for later

## Constraints

- **Tech stack**: TypeScript monorepo with pnpm workspaces — all packages in `packages/`
- **External dependency**: FFmpeg required for render phase (video assembly)
- **External dependency**: LLM API key required for narrate phase (Anthropic or OpenAI)
- **External dependency**: TTS API key required for render phase (OpenAI TTS for v1)
- **Package boundary**: `@buildstory/core` must have zero knowledge of CLI args, config files, or n8n — pure typed inputs/outputs

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript over Rust | Monorepo consumers (n8n, MCP, future wrappers) are all JS/TS; single-language ecosystem | ✓ Good — 4 packages share types seamlessly |
| Core library + thin wrappers | Same business logic across CLI, n8n, MCP, GitHub Actions — no duplication | ✓ Good — CLI is thin, core stays pure |
| pnpm workspaces | Fast, strict, good monorepo support with workspace protocol | ✓ Good — workspace:* protocol works well |
| Anthropic + OpenAI for narrator | Two most capable LLM providers; user wants both from the start | ✓ Good — both providers shipped in v1.0 |
| OpenAI TTS as default | Good quality/cost balance; abstract engine so Piper/ElevenLabs plug in later | ✓ Good — quality is solid |
| Scan + narrate + render = v1 | Full pipeline through video output is the first milestone | ✓ Good — shipped v1.0 |
| n8n deferred to later milestone | Ship core + CLI first; n8n wraps the same core functions after they're solid | — Pending |
| GStack/GSD + generic artifacts | Also detect ADRs, CHANGELOG, README, docs/ — not just GStack/GSD-specific files | ✓ Good — shipped in v1.0 Phase 2 |
| HeyGen as standalone package | Separate @buildstory/heygen with zero imports from @buildstory/video | ✓ Good — clean separation, independent build |
| child_process.spawn over fluent-ffmpeg | fluent-ffmpeg archived May 2025; direct spawn with concat demuxer is simpler | ✓ Good — no deprecated dependency |
| Narrative arc color palette | Beat types map to story-energy colors (cool→warm→green) for HeyGen backgrounds | — Pending human testing |

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-04-15 after v1.1 milestone*

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-14 after milestone v1.1 start*
