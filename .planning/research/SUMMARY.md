# Project Research Summary

**Project:** BuildStory
**Domain:** TypeScript monorepo — developer artifact scanning, LLM narration, video rendering
**Researched:** 2026-04-05
**Confidence:** HIGH

## Executive Summary

BuildStory is a locally-runnable CLI toolkit that reads planning artifacts (GStack/GSD files, ADRs, docs, git history) and produces a narrated MP4 video telling the story of how a project was built. The recommended approach is a pnpm monorepo with two packages at v1: `@buildstory/core` (all business logic) and `buildstory` (thin CLI wrapper). The pipeline has three discrete phases — scan (artifact + git ingestion → Timeline JSON), narrate (Timeline + LLM → Script JSON), and render (Script + TTS + FFmpeg → MP4). These phases must be designed as serializable checkpoints from day one so that re-runs avoid redundant LLM calls and users can iterate on just the render step without paying for re-narration.

The key market differentiation is reading GStack/GSD planning artifacts — no competitor (Gource, git-story, GitStory, Narakeet) ingests `.planning/` directories, milestone docs, or ADRs. All existing tools either visualize commits without narrative (Gource, git-story) or require the user to supply the script (Narakeet). BuildStory generates the narrative from the planning record, which is why artifact-aware markdown extraction (not generic heading parsing) is the most important part of the scanner. The `@buildstory/core` library also enables post-v1 wrappers (n8n node, MCP server, GitHub Action) without any logic duplication — this architecture decision must be locked in at scaffold time.

The dominant risks are: (1) `fluent-ffmpeg` was archived May 2025 and must not be used — replace with direct `child_process.spawn`; (2) the core library will absorb config/CLI concerns unless an ESLint rule enforces the boundary at scaffold time; (3) LLM cost runaway during development is a real risk that requires hard spend limits and a `maxInputTokens` guard in `narrate()` before the first real API call. Audio/video sync is the most technically subtle pitfall — scene durations must be derived from `ffprobe` measurements of actual TTS output, never from word-count estimates.

## Key Findings

### Recommended Stack

The stack is fully pinned and high-confidence. The core library uses remark/unified (ESM-only) for markdown parsing, simple-git for git history, Anthropic and OpenAI SDKs for LLM and TTS, node-canvas + sharp for frame generation, and direct FFmpeg spawning (not fluent-ffmpeg) for video assembly. The entire stack is wired together with TypeScript 6, pnpm workspaces, tsup for dual CJS/ESM builds, and Vitest for testing.

The most significant build-time constraint is that the remark/unified ecosystem is ESM-only. `@buildstory/core` must be configured as ESM (or dual-module via tsup). The n8n nodes package is the exception: it must compile to CJS because n8n's loader uses `require()`.

**Core technologies:**
- TypeScript 6 + pnpm 10 workspaces — language and monorepo manager; already decided
- remark 15 + remark-parse 11 — markdown AST extraction; unified ecosystem required for structured extraction (not marked/markdown-it which return HTML only)
- simple-git 3.33 — git history; preferred over isomorphic-git for CLI tools where git binary is available
- @anthropic-ai/sdk 0.82 + openai 6.33 — LLM and TTS; openai SDK covers both chat completions and `audio.speech.create()`
- canvas 3.2 + sharp 0.34 — frame generation; canvas for programmatic drawing, sharp for compositing and export
- ffmpeg-static 5.3 + child_process.spawn — video assembly; ffmpeg-static provides a bundled binary, spawn replaces the archived fluent-ffmpeg
- zod 4.3 — runtime validation; mandatory on all LLM JSON responses and config inputs
- commander 14 — CLI argument parsing; 35M+ weekly downloads, correct fit for 4-subcommand CLI
- smol-toml 1.6 — TOML config parsing; most-downloaded, TOML 1.1.0 compliant

### Expected Features

The full v1 feature set is well-defined. Every feature is either a hard dependency of another (timeline JSON is required before narration can run) or a differentiator with clear competitive justification. Nothing in the v1 list is optional — remove any of it and the core product promise breaks.

**Must have (table stakes):**
- Git history ingestion — every comparable tool does this; absence is a product regression
- CLI with composable subcommands (`scan`, `narrate`, `render`, `run`) — dev tool ergonomics expectation
- LLM provider choice (Anthropic + OpenAI) — PRD requirement; provider abstraction is in the architecture
- TTS voice narration (OpenAI TTS) — silent video is not the product
- Subtitle/SRT generation — accessibility and YouTube/LinkedIn upload requirement
- MP4 video output — the deliverable users share
- `buildstory.toml` configuration — required for usable defaults and repo-specific patterns
- Preflight checks with actionable errors — FFmpeg and API key absence must fail fast before expensive operations

**Should have (competitive):**
- GStack/GSD planning artifact awareness — the core differentiator; no competitor reads `.planning/` dirs
- Narrative style presets (technical / overview / retrospective / pitch) — four LLM prompt templates
- Scene segmentation with visual type assignments (timeline / code diff / milestone card / quote pull) — drives frame generation
- Source event links in Script JSON (`scene.sourceEventIds[]`) — audit trail unique in the market
- Configurable pacing per scene — derived from event significance
- Modular `@buildstory/core` public API — enables n8n, MCP, GitHub Actions wrappers post-v1

**Defer (v2+):**
- Multi-project cross-repo narratives — requires timeline merge strategy not worth the complexity in v1
- Incremental scanning (diff against previous timeline) — on-demand `buildstory run` is sufficient for v1
- Interactive script editor (TUI or web) — JSON editing serves power users; validate demand first

### Architecture Approach

The architecture is a strict layered pipeline: external wrappers (CLI, n8n nodes, future MCP) depend only on `@buildstory/core`; core has zero knowledge of wrappers, config files, or `process.env`. The three pipeline phases each produce versioned, serializable JSON (`Timeline`, `Script`) that can be written to disk between phases — this enables partial re-runs, debugging, and cost containment. Provider abstractions (LLMProvider, TTSProvider) are narrow interfaces that isolate external API integrations and serve as the unit-test boundary.

**Major components:**
1. `FileWalker` + `GitReader` + `ArtifactParser` → `Timeline` — scan phase; artifact-aware extraction on top of the remark AST is the most important design decision here
2. `LLMProvider` + `ScriptBuilder` → `Script` — narrate phase; four style presets, scene segmentation, pacing; all LLM output validated through Zod schemas
3. `FrameGenerator` + `TTSProvider` + `FFmpegAssembler` → MP4 — render phase; frames batched to avoid node-canvas memory leaks; TTS duration measured via ffprobe before frame count is calculated
4. `buildstory` CLI — thin wrapper: loads `buildstory.toml`, resolves typed options, calls core functions, writes output; zero business logic
5. `n8n-nodes-buildstory` (post-v1) — same thin-wrapper pattern; compiles to CJS for n8n compatibility

### Critical Pitfalls

1. **fluent-ffmpeg is archived (May 2025)** — use `child_process.spawn` directly with a thin `runFFmpeg(args: string[]): Promise<void>` helper; establish this before any video assembly code is written
2. **Core library boundary violation** — enforce with an ESLint rule banning `fs`, `process.env`, and config libraries from `packages/core/src/` at scaffold time; recovery is a full refactor
3. **LLM cost runaway** — set hard spend limits on Anthropic and OpenAI dashboards before the first API call; add a `maxInputTokens` parameter to `narrate()` with a conservative default
4. **Audio/video desync** — never use script-estimated `durationSeconds` for frame count; always call `ffprobe` on the TTS output file and use the measured duration
5. **LLM output schema drift** — parse every LLM response through `z.parse(ScriptOutputSchema)` immediately after `JSON.parse()`; use OpenAI Structured Outputs and Anthropic tool_use to constrain the model at generation time
6. **Generic markdown parsing misses GSD/GStack semantics** — write an artifact-aware extraction layer on top of mdast that recognizes GSD file patterns, requirement checkboxes, status markers, and cross-references; generic heading extraction is not sufficient
7. **node-canvas memory leaks** — process frames in batches; null canvas references after each frame is written to disk; do not use `new Canvas()` in an unbounded loop

## Implications for Roadmap

Based on the feature dependency graph and pitfall phase mapping, five phases emerge naturally. The ordering is dictated by hard dependencies: Timeline JSON must exist before narration; Script JSON must exist before rendering. Infrastructure and boundary enforcement must precede all business logic to prevent the most costly pitfall (core boundary violation).

### Phase 1: Monorepo Scaffold and Infrastructure

**Rationale:** Establishes the package boundaries and tooling that all subsequent phases build on. The two most costly pitfalls (fluent-ffmpeg and core boundary violation) must be addressed here before any business logic exists. Recovery from a boundary violation after three phases of code is a full refactor.

**Delivers:** Working pnpm workspace with `@buildstory/core` and `buildstory` CLI packages; TypeScript 6 + tsup + Vitest configured; ESLint rule banning fs/process.env in core enforced; `buildstory.toml` schema and loader in CLI; preflight check pattern established; placeholder `scan()` / `narrate()` / `render()` functions with typed signatures exported from core; `buildstory run` wired end-to-end (returns empty results)

**Addresses:** `buildstory.toml` configuration, preflight checks, composable CLI subcommands

**Avoids:** Core boundary violation, phantom dependency access, fluent-ffmpeg introduction

**Research flag:** Standard patterns — monorepo scaffold is well-documented; skip phase research

### Phase 2: Scanner — Timeline Extraction

**Rationale:** Timeline JSON is the master record for all downstream phases. Scan quality gates matter most: errors introduced here cannot be corrected by narration or rendering. Artifact-aware extraction (the primary differentiator) must be designed carefully before the data contract is locked.

**Delivers:** `scan()` function returning validated `Timeline` JSON with stable event IDs; FileWalker (fast-glob, configurable include/exclude patterns); GitReader (simple-git, commits/tags/blame, date range limiting); ArtifactParser with GSD/GStack-aware extraction layer on top of remark mdast; Timeline merger and chronological sort; `buildstory scan` CLI command writing timeline.json to disk

**Addresses:** GStack/GSD artifact awareness, git history ingestion, markdown parsing, structured JSON output, configurable artifact patterns

**Avoids:** Generic markdown parsing losing artifact semantics; unbounded git log traversal (`--max-count` required)

**Research flag:** May need phase research for GSD/GStack artifact pattern recognition — the specific file conventions and structure markers are project-specific knowledge

### Phase 3: Narrator — LLM Script Generation

**Rationale:** Narration is the core "magic" of the product. It transforms structured data into a human script. Depends entirely on stable Timeline JSON from Phase 2. LLM cost and schema validation must be addressed here before production use.

**Delivers:** `narrate()` function accepting Timeline and returning validated `Script` JSON; LLMProvider abstract interface with Anthropic and OpenAI implementations; four narrative style presets (technical / overview / retrospective / pitch); ScriptBuilder with scene segmentation, visual type assignments, and duration pacing; Zod schema for all LLM output; `maxInputTokens` budget guard; `buildstory narrate` CLI command with `--input` / `--output` flags

**Addresses:** LLM provider choice, narrative style presets, scene segmentation with visual types, source event links in Script JSON, configurable pacing

**Avoids:** LLM cost runaway (budget guard), LLM output schema drift (Zod), calling narrate with raw markdown instead of structured timeline

**Research flag:** Standard patterns — OpenAI Structured Outputs and Anthropic tool_use are well-documented; skip phase research

### Phase 4: Renderer — Frames, TTS, Video Assembly

**Rationale:** The most complex phase with the most integration points and the most pitfalls. Depends on stable Script JSON from Phase 3. Establishes the FFmpeg spawn pattern (not fluent-ffmpeg) and the measure-then-assemble TTS duration pattern before any video assembly code grows.

**Delivers:** `render()` function producing MP4; FrameGenerator using node-canvas + sharp with batched generation to prevent memory leaks; TTSProvider abstract interface with OpenAI TTS implementation; `ffprobe`-based audio duration measurement driving frame count; FFmpegAssembler using direct `child_process.spawn` with stdout/stderr consumed; subtitle/SRT generation; transition fades; temp directory cleanup in try/finally; `buildstory render` CLI command

**Addresses:** TTS voice narration, subtitle/SRT output, MP4 video output, configurable output path

**Avoids:** fluent-ffmpeg (use spawn directly), audio/video desync (ffprobe measurement), node-canvas memory leaks (batching), FFmpeg process hang (stdout/stderr consumed), silent large file written to cwd (default to `buildstory-out/`)

**Research flag:** Needs phase research — FFmpeg filter_complex for multi-scene concat with consistent pixel formats, ffprobe API for duration extraction, and OpenAI TTS response structure for timing metadata are non-trivial integration details

### Phase 5: Integration Validation and Post-v1 Wrappers

**Rationale:** Validates the full pipeline end-to-end with real planning artifacts, then adds the n8n node wrapper. The n8n CJS/ESM compatibility constraint (n8n-nodes package must output CJS) is an architectural constraint that must be addressed here, not retrofitted.

**Delivers:** End-to-end integration test using the build-story repo's own `.planning/` files as test input; `buildstory run` (all three phases in sequence with `--save-timeline` / `--save-script` flags); n8n-nodes-buildstory package with CJS tsconfig and BuildStoryScan/Narrate/Render nodes; progress events emitted from core (`scan:complete`, `narrate:scene:N`, `render:frame:N`) consumed by CLI for user-facing output; `@changesets/cli` versioning workflow validated

**Addresses:** Composable pipeline with disk checkpoints, n8n wrapper, progress output UX

**Avoids:** n8n ESM/CJS mismatch (n8n package must use `"module": "CommonJS"`), overwriting previous output (timestamp-append default)

**Research flag:** May need phase research for n8n custom node packaging and community node installation process

### Phase Ordering Rationale

- Scanner before narrator because `narrate()` is a pure transform of Timeline; without a stable Timeline schema there is no structured input to pass the LLM
- Narrator before renderer because `render()` consumes Script JSON; scene visual type assignments (produced by narration) drive frame generation choices
- Infrastructure scaffold before all business logic because the ESLint boundary enforcement and `workspace:*` phantom dependency checks are orders of magnitude cheaper to establish at scaffold time than to retrofit
- n8n wrapper deferred to Phase 5 because the core API must be stable before wrappers are written; any breaking change to `scan()` / `narrate()` / `render()` breaks all downstream consumers simultaneously

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Scanner):** GSD/GStack planning artifact pattern recognition — specific file conventions, status markers, and cross-reference formats may need documentation review before the extraction layer is designed
- **Phase 4 (Renderer):** FFmpeg filter_complex concat behavior with mixed pixel formats; ffprobe programmatic API for duration extraction; OpenAI TTS response metadata structure for timing — all non-trivial integration details worth researching before implementation begins
- **Phase 5 (Wrappers):** n8n custom node packaging, installation via community nodes, and credential declaration patterns — n8n's node API is narrowly documented

Phases with standard patterns (skip research-phase):
- **Phase 1 (Scaffold):** pnpm workspaces, tsup, Vitest, ESLint flat config are all well-documented with clear official docs
- **Phase 3 (Narrator):** OpenAI Structured Outputs and Anthropic tool_use for constrained JSON generation are stable, well-documented APIs

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions confirmed via npm registry on 2026-04-05; rationale cross-verified via official docs |
| Features | MEDIUM-HIGH | Competitor feature analysis verified; GSD/GStack artifact patterns inferred from project context rather than external sources |
| Architecture | HIGH | Monorepo patterns, pipeline JSON contracts, and provider abstraction are standard; n8n CJS constraint confirmed via community sources |
| Pitfalls | HIGH | fluent-ffmpeg archival confirmed via GitHub issue; node-canvas memory issues confirmed via bug tracker; LLM cost runaway patterns confirmed via multiple sources |

**Overall confidence:** HIGH

### Gaps to Address

- **GSD/GStack artifact recognition patterns:** The specific file naming conventions, status markers, and structured block formats used by GSD/GStack are not documented in external sources — they are project conventions. The scanner's artifact-aware extraction layer will need to be designed against actual examples of `.planning/` files from this repo. Address during Phase 2 planning.
- **OpenAI TTS response timing metadata:** Whether the OpenAI TTS API returns per-word timestamps (like Whisper does) or only a duration, and in what format, affects the subtitle generation approach. If per-word timestamps are unavailable, SRT generation requires ffprobe-based word alignment. Verify during Phase 4 planning.
- **n8n custom node publish and install flow:** The process for distributing `n8n-nodes-buildstory` to end users (npm package + community node install) has gotchas around package naming conventions and n8n version compatibility. Address during Phase 5 planning.

## Sources

### Primary (HIGH confidence)

- npmjs.com registry — all version numbers confirmed 2026-04-05
- https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/issues/1324 — archived status confirmed
- https://github.com/Automattic/node-canvas/issues/763 — memory leak behavior confirmed
- https://pnpm.io/workspaces — phantom dependency enforcement and workspace: protocol
- https://unifiedjs.com/ + https://github.com/remarkjs/remark — ESM-only status, remark vs alternatives
- https://sharp.pixelplumbing.com/install/ — libvips bundled binary, TypeScript types
- https://platform.openai.com/docs/guides/text-to-speech — 4096 char TTS limit, model names
- https://www.typescriptlang.org/docs/handbook/project-references.html — build ordering
- https://tsup.egoist.dev/ — CJS+ESM+dts output

### Secondary (MEDIUM confidence)

- https://community.n8n.io/t/building-custom-nodes-in-a-monorepo-possible/45297 — n8n CJS/ESM constraint
- https://dev.to/pockit_tools/llm-structured-output-in-2026-stop-parsing-json-with-regex-and-do-it-right-34pk — LLM structured output patterns
- https://leanylabs.com/blog/node-videos-konva/ — FFmpeg frame rendering in Node.js
- https://cloudinary.com/guides/video-effects/ffmpeg-concat — FFmpeg concat pitfalls
- https://toolshelf.tech/blog/why-your-llm-api-costs-are-through-the-roof/ — LLM cost runaway patterns

### Tertiary (MEDIUM confidence — competitor analysis)

- https://gource.io/ — commit visualization feature set
- https://initialcommit.com/blog/git-story — git-to-video features
- https://www.narakeet.com/docs/script/ — markdown-driven narrated video features
- https://www.funblocks.net/aitools/reviews/gitstory-2 — GitStory narrative features

---
*Research completed: 2026-04-05*
*Ready for roadmap: yes*
