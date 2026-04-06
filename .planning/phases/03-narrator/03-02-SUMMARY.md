---
phase: 03-narrator
plan: "02"
subsystem: core/narrate
tags: [llm, anthropic, openai, structured-output, narrate, format, provider]
dependency_graph:
  requires: ["03-01"]
  provides: ["narrate-real", "format-real", "AnthropicProvider", "OpenAIProvider", "createProvider"]
  affects: ["packages/core", "packages/cli"]
tech_stack:
  added: []
  patterns:
    - "AnthropicProvider: messages.parse() + zodOutputFormat + temperature:0"
    - "OpenAIProvider: chat.completions.parse() + zodResponseFormat + temperature:0 + Zod v4 fallback"
    - "narrate() optional provider injection to avoid double instantiation"
    - "Token guard on individual chunks, not pre-chunked timeline"
    - "Post-narration sourceEventIds validation with hallucination filtering"
    - "format() accepts LLMProvider directly for INFRA-02 boundary"
key_files:
  created:
    - packages/core/src/narrate/providers/anthropic.ts
    - packages/core/src/narrate/providers/openai.ts
    - packages/core/src/narrate/providers/anthropic.test.ts
    - packages/core/src/narrate/providers/openai.test.ts
    - packages/core/src/format/format.test.ts
  modified:
    - packages/core/src/narrate/index.ts
    - packages/core/src/format/index.ts
    - packages/core/src/index.ts
    - packages/core/src/narrate/prompts/format-prompts.ts
    - packages/core/src/__tests__/stubs.test.ts
decisions:
  - "AnthropicProvider defaults to claude-sonnet-4-5 (cost-efficient; override deferred to NarrateOptions.model)"
  - "OpenAIProvider defaults to gpt-4o (best structured output quality)"
  - "Zod v4 fallback in OpenAIProvider uses z.toJSONSchema() if zodResponseFormat throws ZodFirstPartyTypeKind error"
  - "synthesizeArcs system prompt appends synthesis instructions to preserve all sourceEventIds"
  - "narrate() filters hallucinated sourceEventIds (console.warn) rather than throwing, keeping beats with zero valid IDs"
metrics:
  duration_minutes: 25
  completed_date: "2026-04-05"
  tasks_completed: 2
  files_changed: 10
  tests_added: 35
---

# Phase 03 Plan 02: LLM Providers and narrate()/format() Implementation Summary

**One-liner:** AnthropicProvider and OpenAIProvider with native structured output (zodOutputFormat/zodResponseFormat, temperature:0), full narrate() orchestration (token estimation + chunking + per-chunk guard + synthesizeArcs + sourceEventIds validation), and format() with metadata footer — all LLM stubs replaced.

## What Was Built

### Task 1: AnthropicProvider and OpenAIProvider

Both providers implement the `LLMProvider` interface from 03-01.

**AnthropicProvider** (`packages/core/src/narrate/providers/anthropic.ts`):
- `extractStoryArc`: uses `client.messages.parse()` + `zodOutputFormat(StoryArcSchema)` + `temperature: 0` + `max_tokens: 16384`
- `generateFormat`: uses `client.messages.create()` (plain text, per D-04) + `temperature: 0`
- `synthesizeArcs`: uses `client.messages.parse()` with merged beats + synthesis instructions in system prompt
- All structured calls null-check `parsed_output` and post-validate with `StoryArcSchema.parse()`

**OpenAIProvider** (`packages/core/src/narrate/providers/openai.ts`):
- `extractStoryArc` and `synthesizeArcs`: primary path uses `client.chat.completions.parse()` + `zodResponseFormat(StoryArcSchema, 'story_arc')` + `temperature: 0`
- Zod v4 fallback: if `zodResponseFormat` throws a `ZodFirstPartyTypeKind` error (Pitfall 1), falls back to `z.toJSONSchema(StoryArcSchema)` with manual `response_format: { type: 'json_schema', strict: true }`
- `generateFormat`: uses `client.chat.completions.create()` (plain text, no structured output)
- Both providers: `maxRetries: 2` on SDK client

### Task 2: narrate() and format() orchestration

**narrate()** (`packages/core/src/narrate/index.ts`):
- Signature: `narrate(timeline, options, provider?: LLMProvider)` — optional provider injection
- Validates `options.apiKey` non-empty before any work
- `createProvider(options)` exported for CLI reuse (creates one provider, passes to both `narrate` and `format`)
- Token guard flow: estimate → if fits call directly → if over limit chunk by phase → guardTokens each chunk → narrate each chunk → synthesizeArcs if multiple chunks
- Post-narration: validates all `sourceEventIds` in beats against actual `timeline.events.map(e => e.id)`, filters hallucinations with console.warn, logs additional warning if a beat ends up with zero valid IDs
- Final `StoryArcSchema.parse()` on the validated arc with updated `generatedAt`

**format()** (`packages/core/src/format/index.ts`):
- Signature: `format(arc, formatType, provider: LLMProvider)` — accepts provider directly (INFRA-02 boundary)
- Calls `buildFormatPrompt(formatType)` then `provider.generateFormat(arc, formatType, formatPrompt)`
- Appends metadata footer: `Word count: N | Reading time: ~N min | Style: X | Format: Y`

**Barrel exports** (`packages/core/src/index.ts`): added `createProvider` and `LLMProvider` type

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed triple-backtick parse error in format-prompts.ts**
- **Found during:** Task 2 build (`pnpm build`)
- **Issue:** Line 70 of `format-prompts.ts` contained unescaped `` ``` `` inside a template literal. The main repo build was unaffected (its `format/index.ts` didn't import `format-prompts.ts`). The worktree build failed when the new `format/index.ts` triggered esbuild to parse the file: `Expected "}" but found ")"` at `format-prompts.ts:70:18`.
- **Fix:** Escaped the triple backtick: `` \`\`\` ``
- **Files modified:** `packages/core/src/narrate/prompts/format-prompts.ts`
- **Commit:** `3f74612`

**2. [Rule 1 - Bug] Updated stubs.test.ts for real function signatures**
- **Found during:** Task 2 test run
- **Issue:** `stubs.test.ts` was written for the stub implementations. `narrate()` tests assumed a no-op (no real provider needed); `format()` test called `format(arc, formatType)` without the required 3rd `provider` parameter.
- **Fix:** Updated test to inject a `vi.fn()`-based mock LLMProvider into both `narrate()` (via optional 3rd param) and `format()` (as required 3rd param). Mock `extractStoryArc` returns a valid empty arc, `generateFormat` returns empty string.
- **Files modified:** `packages/core/src/__tests__/stubs.test.ts`
- **Commit:** `3f74612`

## Test Coverage

| File | Tests Added |
|------|-------------|
| `narrate/providers/anthropic.test.ts` | 13 tests covering extractStoryArc, generateFormat, synthesizeArcs |
| `narrate/providers/openai.test.ts` | 13 tests covering extractStoryArc, generateFormat, synthesizeArcs |
| `format/format.test.ts` | 9 tests covering word count, reading time, metadata footer, provider call |
| `__tests__/stubs.test.ts` | Updated (not added) — existing tests adapted for real signatures |

**Total test count:** 146 (was 111 in 03-01, added 35 net)

## Known Stubs

None — all narrate() and format() stubs replaced with real implementations.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes beyond what the threat model in the plan covers. The `format-prompts.ts` fix changes only string escaping — no security surface change.

## Self-Check: PASSED

All 9 key files confirmed present on disk. Both task commits (`f1e9e0f`, `3f74612`) confirmed in git log. Build succeeds (`pnpm build`). All 146 tests pass (`pnpm test`).
