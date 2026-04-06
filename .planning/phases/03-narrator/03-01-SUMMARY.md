---
phase: 03-narrator
plan: "01"
subsystem: narrate
tags: [llm, anthropic, openai, typescript, vitest, token-guard, chunker, prompts]

# Dependency graph
requires:
  - phase: 02-scanner
    provides: Timeline JSON schema and TimelineEvent types consumed by chunker and token guard
  - phase: 01-scaffold
    provides: Package structure, tsup build, vitest test runner, Zod schemas
provides:
  - LLMProvider interface (extractStoryArc, generateFormat, synthesizeArcs)
  - 4 style system prompts (technical, overview, retrospective, pitch)
  - 4 format prompts (outline, thread, blog, video-script)
  - Token estimation and cost guard (estimateTokens, guardTokens, buildTimelinePayload)
  - Phase-boundary chunker (groupByPhase, chunkTimeline)
  - @anthropic-ai/sdk and openai installed in @buildstory/core
affects:
  - 03-02: provider implementations (Anthropic + OpenAI) depend on LLMProvider interface and prompts
  - 03-03: CLI narrate command depends on narrate() orchestration using these utilities

# Tech tracking
tech-stack:
  added:
    - "@anthropic-ai/sdk@^0.82.0"
    - "openai@^6.33.0"
  patterns:
    - "Provider-agnostic interface pattern: narrate() depends on LLMProvider interface, not specific SDKs"
    - "rawContent stripping: buildTimelinePayload always omits rawContent before LLM serialization (T-03-01 mitigation)"
    - "Token guard before API calls: guardTokens enforces maxInputTokens ceiling (T-03-02 mitigation)"
    - "Phase-boundary chunking: split Timeline by phases/NN-name/ path prefix for oversized inputs"

key-files:
  created:
    - packages/core/src/narrate/providers/interface.ts
    - packages/core/src/narrate/prompts/system.ts
    - packages/core/src/narrate/prompts/format-prompts.ts
    - packages/core/src/narrate/tokens.ts
    - packages/core/src/narrate/chunker.ts
    - packages/core/src/narrate/tokens.test.ts
    - packages/core/src/narrate/chunker.test.ts
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - packages/core/package.json
    - pnpm-lock.yaml

key-decisions:
  - "LLMProvider interface has 3 methods: extractStoryArc (timeline->arc), generateFormat (arc->text), synthesizeArcs (arcs[]->arc) — covers single, format, and chunk-merge use cases"
  - "buildTimelinePayload strips rawContent via destructuring to prevent leaking full file content to LLM — mitigates T-03-01"
  - "guardTokens throws with estimated count and limit in the error message for debuggability"
  - "groupByPhase uses regex /phases\\/(\\d+-[^/]+)/ — events with no path or non-matching path go to 'ungrouped'"
  - "NARR-04/06/07 and CLI-02 requirements realigned to StoryArc/beat model per D-09/D-11/D-12 context decisions"

patterns-established:
  - "Token guard pattern: call guardTokens(buildTimelinePayload(timeline), maxInputTokens) before any LLM call"
  - "Chunking pattern: chunkTimeline returns [timeline] when it fits, or phase-split chunks when over limit"
  - "Prompt composition: STYLE_PROMPTS[style] contains tone instructions + BEAT_TYPES_INSTRUCTION with schema rules"
  - "ESM .js extension on all internal imports in narrate/ subdirectory"

requirements-completed:
  - NARR-03
  - NARR-08
  - CLI-02

# Metrics
duration: 5min
completed: 2026-04-06
---

# Phase 3 Plan 01: Narrator Foundation Summary

**LLMProvider interface, 4 style + 4 format prompts, token guard with rawContent stripping, and phase-boundary chunker installed with @anthropic-ai/sdk and openai in @buildstory/core**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-06T11:33:21Z
- **Completed:** 2026-04-06T11:37:46Z
- **Tasks:** 2 (Task 1: requirements/deps, Task 2: TDD implementation)
- **Files modified:** 11

## Accomplishments

- Requirements NARR-04, NARR-06, NARR-07, and CLI-02 realigned to StoryArc/beat model per D-09/D-11/D-12/D-13
- LLMProvider interface defined with 3 methods covering all narration use cases (single call, format generation, chunk synthesis)
- 4 style presets with meaningfully distinct prompts: technical (engineering rigor), overview (product story), retrospective (honest reflection), pitch (investor framing)
- 4 format prompts specifying concrete output constraints: outline (800-1500 words), thread (8-15 posts, <280 chars each), blog (500-1000 words with code blocks), video-script (60-120s with [SCENE:] markers)
- Token guard correctly strips rawContent and throws with estimated/limit counts in error message
- Phase-boundary chunker groups by regex match on phases/NN-name/ path prefix with ungrouped fallback
- All 111 tests pass including 22 new tests for tokens and chunker

## Task Commits

Each task was committed atomically:

1. **Task 1: Update requirements/roadmap + install LLM SDKs** - `65c218d` (chore)
2. **Task 2 RED: Failing tests for tokens and chunker** - `0ef6a3d` (test)
3. **Task 2 GREEN: LLMProvider interface, prompts, token guard, chunker** - `e79dc2e` (feat)

## Files Created/Modified

- `packages/core/src/narrate/providers/interface.ts` — LLMProvider interface with extractStoryArc, generateFormat, synthesizeArcs
- `packages/core/src/narrate/prompts/system.ts` — STYLE_PROMPTS record + buildSystemPrompt(), includes all 9 beat types and output schema
- `packages/core/src/narrate/prompts/format-prompts.ts` — FORMAT_PROMPTS record + buildFormatPrompt() for all 4 output formats
- `packages/core/src/narrate/tokens.ts` — estimateTokens, buildTimelinePayload (strips rawContent), guardTokens
- `packages/core/src/narrate/chunker.ts` — groupByPhase (regex phase extraction), chunkTimeline (phase-boundary splitting)
- `packages/core/src/narrate/tokens.test.ts` — 15 tests covering estimateTokens, guardTokens, buildTimelinePayload
- `packages/core/src/narrate/chunker.test.ts` — 9 tests covering groupByPhase and chunkTimeline
- `.planning/REQUIREMENTS.md` — NARR-04, NARR-06, NARR-07, CLI-02 updated to StoryArc model
- `.planning/ROADMAP.md` — Progress table updated (Phase 1: 2/2, Phase 2: 3/3, Phase 3: Executing)
- `packages/core/package.json` — Added @anthropic-ai/sdk@^0.82.0 and openai@^6.33.0 as runtime dependencies
- `pnpm-lock.yaml` — Updated with new SDK lockfile entries

## Decisions Made

- LLMProvider interface includes `synthesizeArcs` (not just extractStoryArc + generateFormat) to explicitly support the D-06 chunk-merge use case without provider implementations needing to know about chunking
- `buildTimelinePayload` uses destructuring (`const { rawContent: _rawContent, ...rest } = event`) to strip rawContent — explicit exclusion rather than allowlist, safer against schema additions
- `guardTokens` error message includes both the estimated count and the limit value for immediate debuggability without needing to look at code
- `groupByPhase` returns a `Map` not a plain object — preserves insertion order, better for iteration in chunker
- Style prompts share `BEAT_TYPES_INSTRUCTION` constant to keep the 9 beat type definitions consistent across all 4 styles while keeping style-specific tone distinct

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — all tests passed on first implementation attempt. Build succeeded without TypeScript errors.

## User Setup Required

None — no external service configuration required for this plan. LLM API keys are consumed by provider implementations in Plan 02, not here.

## Next Phase Readiness

- LLMProvider interface is the contract Plan 02 (provider implementations) depends on
- STYLE_PROMPTS and FORMAT_PROMPTS are ready for provider implementations to pass to LLM calls
- Token guard and chunker are ready for narrate() orchestration in Plan 02
- @anthropic-ai/sdk and openai are installed; Plan 02 can import them directly
- No blockers for Plan 02 or Plan 03 execution

## Known Stubs

None — this plan creates foundation utilities (interface, prompts, token guard, chunker). No data-flow stubs. The narrate() function in packages/core/src/narrate/index.ts remains a stub — it will be replaced in Plan 02.

---

*Phase: 03-narrator*
*Completed: 2026-04-06*
