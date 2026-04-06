---
phase: 03-narrator
plan: 03
subsystem: cli
tags: [commander, typescript, narrate, format, llm, provider]

requires:
  - phase: 03-02
    provides: narrate() with optional LLMProvider param, format() accepting LLMProvider, createProvider() factory

provides:
  - buildstory narrate CLI command reading timeline.json and writing story-arc.json + format .md files
  - Single LLMProvider instantiation pattern in CLI (no double instantiation)
  - Updated buildstory run command writing output files to disk
  - FormatTypeSchema exported from @buildstory/core barrel

affects: [03-04, render, cli-integration, end-to-end]

tech-stack:
  added: []
  patterns:
    - "CLI creates one LLMProvider via createProvider(opts) and passes it to both narrate() and format()"
    - "narrateCommand follows scan.ts pattern: loadConfig -> read/validate input -> process -> write output"
    - "Format type validation via FormatTypeSchema.safeParse() at CLI boundary"

key-files:
  created:
    - packages/cli/src/commands/narrate.ts
  modified:
    - packages/cli/src/commands/run.ts
    - packages/cli/src/index.ts
    - packages/core/src/index.ts
    - packages/cli/src/__tests__/run.test.ts

key-decisions:
  - "CLI calls createProvider() once and passes the same LLMProvider instance to both narrate() and format() — avoids constructing two API clients"
  - "FormatTypeSchema exported from core barrel so CLI can validate --format flag at the boundary without duplicating the enum"
  - "Mock LLMProvider pattern established in CLI tests — pass provider to narrate()/format() instead of triggering real API calls"

patterns-established:
  - "Shared provider pattern: const llmProvider = createProvider(opts); narrate(timeline, opts, llmProvider); format(arc, ft, llmProvider)"
  - "CLI input validation at boundary: TimelineSchema.parse(JSON.parse(raw)) before any processing"
  - "mkdir recursive before any writeFile calls to ensure output dir exists"

requirements-completed: [CLI-02, NARR-07]

duration: 15min
completed: 2026-04-05
---

# Phase 03 Plan 03: Narrator CLI Command Summary

**`buildstory narrate <timeline.json>` CLI command that reads a timeline, calls LLM narration via a single shared provider, and writes story-arc.json + all four format .md files to an output directory**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-05T07:50:00Z
- **Completed:** 2026-04-05T07:52:18Z
- **Tasks:** 1 of 2 (Task 2 is human-verify checkpoint — awaiting)
- **Files modified:** 5

## Accomplishments

- Created `packages/cli/src/commands/narrate.ts` — reads timeline.json, validates with TimelineSchema, calls createProvider() once, passes LLMProvider to both narrate() and format(), writes story-arc.json + format .md files
- Registered `narrate` subcommand in CLI with `--format`, `--provider`, `--style`, `--output`, `--config` flags; `buildstory narrate --help` shows full usage
- Updated `packages/cli/src/commands/run.ts` to use createProvider + pass LLMProvider to format(), and write all output files to disk
- Exported `FormatTypeSchema` from `@buildstory/core` barrel for CLI-side --format flag validation
- Fixed CLI integration tests to use mock LLMProvider (old tests called narrate() without an API key against the now-real implementation)

## Task Commits

1. **Task 1: Create narrate CLI command and update run command** - `5a2369c` (feat)

## Files Created/Modified

- `packages/cli/src/commands/narrate.ts` — New narrate command: reads timeline, creates provider once, calls narrate()+format(), writes outputs
- `packages/cli/src/commands/run.ts` — Updated to use createProvider, pass LLMProvider to format(), write output files to disk
- `packages/cli/src/index.ts` — Registered narrate subcommand with commander
- `packages/core/src/index.ts` — Added FormatTypeSchema to barrel exports
- `packages/cli/src/__tests__/run.test.ts` — Updated to use mock LLMProvider; mock arc conforms to full StoryArcSchema

## Decisions Made

- Single LLMProvider instance passed to both narrate() and format() — no double instantiation of API clients
- FormatTypeSchema exported from core barrel so CLI can validate --format flag without duplicating the enum
- API key sourced from env vars only (ANTHROPIC_API_KEY / OPENAI_API_KEY), never logged or written to output (T-03-09 mitigated)
- Timeline JSON validated with TimelineSchema.parse() before processing (T-03-10 mitigated)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed CLI integration tests calling narrate() without mock provider**
- **Found during:** Task 1 verification (pnpm run test)
- **Issue:** run.test.ts called narrate() with empty apiKey and without a mock provider. The old stub narrate() accepted empty keys; the real implementation (from Plan 02) throws "API key is required." Tests were testing removed stub behavior.
- **Fix:** Updated tests to create a mock LLMProvider (vi.fn()) and pass it as the third argument to narrate(). Also updated mock arc shape to conform to actual StoryArcSchema (added evidence, significance, metadata.sourceTimeline fields).
- **Files modified:** packages/cli/src/__tests__/run.test.ts
- **Verification:** All 170 tests pass (146 core + 24 CLI)
- **Committed in:** 5a2369c (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in tests from stub era)
**Impact on plan:** Necessary correctness fix. Tests now accurately reflect the real implementation contract. No scope creep.

## Issues Encountered

None beyond the test fix above.

## User Setup Required

This plan requires API keys for end-to-end use:
- `ANTHROPIC_API_KEY` — Anthropic Console -> API Keys (https://console.anthropic.com/settings/keys)
- `OPENAI_API_KEY` — OpenAI Platform -> API Keys (https://platform.openai.com/api-keys)

Running `buildstory narrate` without an API key produces a clear error: "API key is required for narration."

## Next Phase Readiness

- `buildstory narrate <timeline.json>` is fully wired end-to-end; awaiting human checkpoint (Task 2) to verify prompt quality and LLM output
- `buildstory run` now writes output files to disk — same shared provider pattern
- Phase 04 (render) can consume story-arc.json produced by the narrate command

## Known Stubs

None — all data flows are wired. The narrate and format functions call real LLM providers.

---
*Phase: 03-narrator*
*Completed: 2026-04-05*
