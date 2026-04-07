---
phase: 04-renderer
plan: "01"
subsystem: core
tags: [types, narration, schema, story-style, warnings]
dependency_graph:
  requires: []
  provides: [story-style-prompt, story-beat-schema-extensions, warning-accumulation]
  affects: [packages/core/src/narrate/index.ts, packages/core/src/types/story.ts]
tech_stack:
  added: []
  patterns: [zod-optional-fields, warning-accumulation-in-metadata]
key_files:
  created: []
  modified:
    - packages/core/src/types/story.ts
    - packages/core/src/types/options.ts
    - packages/core/src/narrate/prompts/system.ts
    - packages/core/src/narrate/index.ts
decisions:
  - "story prompt uses 'Third-person narration only' and 'Average sentence length under 15 words' to enforce D-01 through D-05 voice rules"
  - "warnings are accumulated in metadata.warnings array instead of console.warn to keep core pure (NARR-12)"
  - "BEAT_TYPES_INSTRUCTION updated with optional visual_cue/tone/duration_seconds to guide LLM for video rendering"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-07T13:40:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 4 Plan 1: Core Story Style and Schema Extensions Summary

**One-liner:** Story style adds warm third-person documentary narration with visual cues; StoryBeat/StoryArc schemas extended for video rendering; console.warn replaced by metadata.warnings accumulation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend StoryBeat/StoryArc schemas and NarrateOptions | bab586d | story.ts, options.ts |
| 2 | Add "story" system prompt and refactor warning accumulation | d533d53 | system.ts, index.ts |

## What Was Built

### Task 1: Schema Extensions

**`packages/core/src/types/story.ts`**
- Added `visual_cue: z.string().optional()` to `StoryBeatSchema` — carries screen direction from narrator to renderer
- Added `tone: z.string().optional()` to `StoryBeatSchema` — emotional register per beat
- Added `duration_seconds: z.number().optional()` to `StoryBeatSchema` — suggested narration length
- Added `warnings: z.array(z.string()).optional()` to `StoryArcSchema.metadata` — accumulates hallucination warnings
- Added `'remotion-script'` to `FormatTypeSchema` — new output format for Phase 4 video rendering

**`packages/core/src/types/options.ts`**
- Added `'story'` to `NarrateOptions.style` union

### Task 2: Story Prompt and Warning Accumulation

**`packages/core/src/narrate/prompts/system.ts`**
- Added `story:` key to `STYLE_PROMPTS` implementing D-01 through D-05:
  - D-01: Warm documentary voice (Kurzgesagt style), stakes carry interest
  - D-02: Third-person narration only — never second-person
  - D-03: Mix project-as-protagonist with git author name for specific decisions
  - D-04: No jokes, sarcasm, wry observations, or pop culture references
  - D-05: Average sentence under 15 words, one idea per beat
- Updated `BEAT_TYPES_INSTRUCTION` output schema to include `visual_cue`, `tone`, `duration_seconds` optional fields

**`packages/core/src/narrate/index.ts`**
- Replaced both `console.warn()` calls with `warnings.push()` accumulation
- Created `const warnings: string[] = []` before beat validation loop
- Set `metadata.warnings` on `validatedArc` when warnings exist (sparse — omitted when empty)

## Decisions Made

1. **Warning accumulation pattern**: Sparse — `warnings` key is only set when the array is non-empty, using `...(warnings.length > 0 ? { warnings } : {})`. This keeps clean arcs lean and signals presence of issues via key existence.

2. **Story prompt structure**: D-01 through D-05 encoded as explicit bullet rules under a "Voice rules:" section, making them directly auditable against the spec.

3. **BEAT_TYPES_INSTRUCTION shared**: The three new optional output fields (`visual_cue`, `tone`, `duration_seconds`) are added to `BEAT_TYPES_INSTRUCTION` which is embedded in all style prompts, not just `story`. This means all styles can optionally emit visual hints, which is correct for future renderer support.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All new fields are properly typed as optional in Zod schemas and wired through the narration pipeline. No placeholder values.

## Threat Flags

None. The `visual_cue`, `tone`, and `duration_seconds` fields pass through Zod `.optional()` validation before reaching any output. The `warnings` array contains only beat titles and event IDs — no user input reflected back (T-04-02 accepted).

## Self-Check: PASSED

Files exist:
- packages/core/src/types/story.ts — FOUND (contains visual_cue, warnings, remotion-script)
- packages/core/src/types/options.ts — FOUND (contains 'story')
- packages/core/src/narrate/prompts/system.ts — FOUND (contains story: key)
- packages/core/src/narrate/index.ts — FOUND (contains warnings.push, no console.warn)

Commits exist:
- bab586d — feat(04-01): extend StoryBeat/StoryArc schemas and NarrateOptions
- d533d53 — feat(04-01): add story system prompt and accumulate warnings in metadata

Build: `pnpm --filter @buildstory/core build` exits 0
