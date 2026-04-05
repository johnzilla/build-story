# BuildStory

## What This Is

BuildStory is a TypeScript monorepo toolkit that scans GStack/GSD planning artifacts across repositories, reconstructs a chronological development timeline, generates a narrative script via LLM, and renders narrated video documentaries. The core logic lives in `@buildstory/core` with thin wrappers for CLI, n8n nodes, and future integrations (MCP server, GitHub Actions).

## Core Value

Extract the build story from planning artifacts and make it consumable — the structured narrative script is the product; video is one output format among many.

## Requirements

### Validated

- [x] Monorepo scaffold with pnpm workspaces (`@buildstory/core`, `buildstory` CLI) — Validated in Phase 1: Scaffold
- [x] Core library with clean public API: `scan()`, `narrate()`, `format()` — no CLI args, no n8n imports — Validated in Phase 1: Scaffold
- [x] Configuration via `buildstory.toml` (project-level and global) — Validated in Phase 1: Scaffold
- [x] ESLint boundary rule preventing core from importing CLI/config concerns — Validated in Phase 1: Scaffold

### Active

- [ ] Monorepo scaffold with pnpm workspaces (`@buildstory/core`, `buildstory` CLI, `n8n-nodes-buildstory`)
- [ ] Core library with clean public API: `scan()`, `narrate()`, `format()` — no CLI args, no n8n imports
- [ ] Filesystem walker detecting GStack/GSD artifacts plus generic planning files (ADRs, CHANGELOG, docs/)
- [ ] Markdown parser extracting headings, dates, content summaries, status, cross-references
- [ ] Git history integration: commit messages, git blame dating, branch/merge events, tags
- [ ] Timeline output as structured JSON with events, metadata, and date ranges
- [ ] LLM narrator supporting Anthropic and OpenAI providers
- [ ] Four narrative styles: technical, overview, retrospective, pitch
- [ ] Scene segmentation with visual type assignments and duration pacing
- [ ] Script output as structured JSON with scenes, narration text, and source event links
- [ ] Frame generation using node-canvas or sharp for each visual type
- [ ] TTS integration starting with OpenAI TTS, abstracted for Piper and ElevenLabs
- [ ] FFmpeg assembly: frame stitching, audio mixing, fade transitions, subtitle generation
- [ ] CLI wrapper: `buildstory scan`, `buildstory narrate`, `buildstory render`, `buildstory run`
- [ ] Configuration via `buildstory.toml` (project-level and global)
- [ ] Configurable artifact detection patterns (include/exclude/custom)

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
| TypeScript over Rust | Monorepo consumers (n8n, MCP, future wrappers) are all JS/TS; single-language ecosystem | — Pending |
| Core library + thin wrappers | Same business logic across CLI, n8n, MCP, GitHub Actions — no duplication | — Pending |
| pnpm workspaces | Fast, strict, good monorepo support with workspace protocol | — Pending |
| Anthropic + OpenAI for narrator | Two most capable LLM providers; user wants both from the start | — Pending |
| OpenAI TTS as default | Good quality/cost balance; abstract engine so Piper/ElevenLabs plug in later | — Pending |
| Scan + narrate + render = v1 | Full pipeline through video output is the first milestone | — Pending |
| n8n deferred to later milestone | Ship core + CLI first; n8n wraps the same core functions after they're solid | — Pending |
| GStack/GSD + generic artifacts | Also detect ADRs, CHANGELOG, README, docs/ — not just GStack/GSD-specific files | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

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
*Last updated: 2026-04-05 after Phase 1 completion*
