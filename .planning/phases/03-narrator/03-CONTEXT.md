# Phase 3: Narrator - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform a Timeline JSON into a StoryArc (narrative beats with LLM-generated summaries) and render it into multiple text formats (outline, thread, blog, video-script). The narrator handles all beat extraction and classification. The formatter generates publishable text from the StoryArc. This phase adds real LLM calls (Anthropic + OpenAI) and the `buildstory narrate` CLI command.

</domain>

<decisions>
## Implementation Decisions

### LLM Prompting Strategy
- **D-01:** Single LLM call for beat extraction + narrative generation — one call receives the full Timeline, extracts beats, classifies them (9 beat types), and generates narrative summaries for each beat. Style preset changes the system prompt. Output is a Zod-validated StoryArc.
- **D-02:** Provider-native structured output — Anthropic tool_use for Claude, OpenAI function calling for GPT. Each provider's native schema enforcement mechanism. Post-validate through Zod StoryArcSchema.parse().
- **D-03:** Provider-agnostic LLM client — a common interface that wraps both SDKs. narrate() doesn't know which provider it's using. The client handles prompt construction, schema enforcement, and response parsing per provider.

### Format Output Approach
- **D-04:** LLM-generated text per format — a second LLM call takes StoryArc beats + a format-specific system prompt and generates the final text. Each format has a tailored prompt (thread: <280 chars per post, blog: H2 sections + blockquotes, outline: full narrative essay, video-script: scene markers + narration).
- **D-05:** All formats by default — `buildstory narrate timeline.json` generates all 4 formats. `--format thread` generates only thread. Matches the design doc CLI usage.

### Cost Control & Chunking
- **D-06:** Chunk by GSD phase boundaries — if timeline exceeds maxInputTokens, group events by source phase (.planning/phases/01-*, 02-*, etc). Narrate each chunk separately, then a synthesis call merges the arcs. Natural boundaries.
- **D-07:** Simple character-based token estimation — ~4 chars per token heuristic. Fast, no extra dependencies. Safe overestimate for the cost guard.
- **D-08:** maxInputTokens guard — estimate tokens before any API call. If over limit, either chunk (D-06) or fail with clear error showing estimated vs limit. Default: 100000 tokens.

### Requirements Realignment
- **D-09:** Update NARR-04 — replace "scene segmentation with visual types" with "beat classification using 9 beat types (idea, goal, attempt, obstacle, pivot, side_quest, decision, result, open_loop)" per the StoryBeat schema.
- **D-10:** Keep NARR-05 as-is — StoryBeat.sourceEventIds already satisfies "each scene includes source event links."
- **D-11:** Update NARR-06 — replace "duration estimation and pacing control" with "word count and estimated reading time per format output."
- **D-12:** Update NARR-07 — replace "Script JSON with scenes" with "StoryArc JSON with beats + text format outputs (outline.md, thread.md, blog.md, video-script.md)."
- **D-13:** Update ROADMAP Phase 3 success criteria to match Narrative-First MVP scope.

### Claude's Discretion
- Exact system prompt wording for each style preset (technical, overview, retrospective, pitch)
- Format-specific prompt engineering (what makes a good thread vs blog vs outline)
- How to structure the synthesis call when chunking
- Error handling for LLM API failures (retries, fallback provider)
- How to make output deterministic (NARR-09): seed parameters, temperature=0, system prompt pinning

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase contracts
- `packages/core/src/types/story.ts` — StoryArc, StoryBeat, BeatType, FormatType Zod schemas (the output contract)
- `packages/core/src/types/options.ts` — NarrateOptions interface (provider, style, apiKey, maxInputTokens)
- `packages/core/src/narrate/index.ts` — Current narrate() stub to be replaced
- `packages/core/src/format/index.ts` — Current format() stub to be replaced
- `packages/core/src/index.ts` — Core barrel exports

### Requirements
- `.planning/REQUIREMENTS.md` — NARR-01 through NARR-09, CLI-02 (needs realignment per D-09 through D-13)
- `.planning/ROADMAP.md` — Phase 3 success criteria (needs realignment per D-13)

### Design
- `~/.gstack/projects/johnzilla-build-story/john-main-design-20260405-144013.md` — Design doc: output formats spec, token budget, cost estimates, edge cases
- `~/.gstack/projects/johnzilla-build-story/ceo-plans/2026-04-05-narrative-first-mvp.md` — CEO plan: story.config.json for editorial control (accepted scope addition)

### Stack
- `.planning/research/STACK.md` — @anthropic-ai/sdk 0.82.0, openai 6.33.0 recommendations
- `CLAUDE.md` — Technology stack section with SDK versions and usage patterns

### Prior phases
- `.planning/phases/01-scaffold/01-CONTEXT.md` — API keys via env only (D-09), Zod schemas from start (D-12)
- `.planning/phases/02-scanner/02-CONTEXT.md` — No beat hints in scan (D-07), Timeline is clean input

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `narrate()` stub (`packages/core/src/narrate/index.ts`) — Replace stub body, keep signature: `narrate(timeline: Timeline, options: NarrateOptions): Promise<StoryArc>`
- `format()` stub (`packages/core/src/format/index.ts`) — Replace stub body, keep signature: `format(arc: StoryArc, formatType: FormatType): Promise<string>`
- `StoryArcSchema` + `StoryBeatSchema` (`packages/core/src/types/story.ts`) — Zod schemas for validating LLM output
- `NarrateOptions` interface (`packages/core/src/types/options.ts`) — provider, style, apiKey, maxInputTokens already defined
- CLI `run` command (`packages/cli/src/commands/run.ts`) — Already wires narrate() after scan(). Needs format() calls added.
- CLI config loader (`packages/cli/src/config.ts`) — Loads provider/style from buildstory.toml

### Established Patterns
- ArtifactSource injection pattern — narrate doesn't need this (no filesystem access), but the provider-agnostic wrapper follows the same dependency injection philosophy
- ESLint boundary: core cannot import fs/process/config. LLM SDK imports are allowed in core (they're network calls, not filesystem)
- Zod schemas at pipeline boundaries — LLM output must pass StoryArcSchema.parse()

### Integration Points
- `packages/cli/src/commands/run.ts` — after scan(), calls narrate(), then format() for each format type, then writes output files
- `buildstory narrate <timeline.json>` — new CLI command reading timeline.json from disk, calling narrate() + format(), writing outputs
- `@anthropic-ai/sdk` and `openai` SDK — need to be installed in core (not CLI) since narrate() lives in core

</code_context>

<specifics>
## Specific Ideas

- The design doc describes specific output format specs: outline (800-1500 words), thread (8-15 posts, <280 chars each), blog (500-1000 words with code blocks and blockquotes), video-script (60-120 seconds narration with scene markers)
- Story beat taxonomy from design doc: idea, goal, attempt, obstacle, pivot, side_quest, decision, result, open_loop — significance 1-3
- CEO plan accepted story.config.json for editorial control (title, audience, tone, key moments) — should be wired as an optional input to narrate()
- Cost estimate from design doc: ~$0.05-0.20 per run with Claude Sonnet, ~$0.02-0.10 with GPT-4o

</specifics>

<deferred>
## Deferred Ideas

- story.config.json editorial control file — accepted by CEO plan but implementation deferred (could be Phase 3 or a follow-up)
- `buildstory init` command — accepted by CEO plan, not in Phase 3 scope
- Video rendering from video-script output — separate milestone
- Incremental narration (only narrate new/changed events) — v2
- Custom beat types beyond the 9 fixed types — v2

</deferred>

---

*Phase: 03-narrator*
*Context gathered: 2026-04-05*
