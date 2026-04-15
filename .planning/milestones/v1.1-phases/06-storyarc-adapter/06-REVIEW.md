---
phase: 06-storyarc-adapter
reviewed: 2026-04-15T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - packages/heygen/src/adapter.ts
  - packages/heygen/src/__tests__/adapter.test.ts
  - packages/heygen/src/index.ts
  - packages/heygen/src/types.ts
  - packages/core/src/index.ts
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-04-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the HeyGen StoryArc adapter package (`packages/heygen/src/`) and the `@buildstory/core` public index. The adapter is well-structured and the type alignment between `@buildstory/core` and `packages/heygen` is correct. Three warnings were found: a logic bug in `chunkBeats` that produces a phantom empty chunk for a 0-beat arc (which would submit an empty scene list to the HeyGen API), a missing public-API input validation step (violating the project convention of validating all public inputs with Zod), and a strict greater-than check in `truncateSummary` that drops a valid sentence boundary at position 0. One info item covers a type-level inconsistency for the `speed` field.

## Warnings

### WR-01: `chunkBeats` returns a phantom empty chunk for a 0-beat arc

**File:** `packages/heygen/src/adapter.ts:54`
**Issue:** When `items.length === 0`, `chunkBeats` returns `[[]]` — one chunk containing an empty array — instead of `[]`. Any consumer that iterates `result.chunks` and submits each chunk to the HeyGen API will make an API call with an empty `scenes` list, which is an invalid HeyGen payload and will produce an API error at runtime. The correct return for zero items is an empty chunk array.
**Fix:**
```typescript
function chunkBeats<T>(items: T[], size: number): T[][] {
  // Remove the early-return guard — the loop handles length=0 naturally by
  // producing zero iterations, returning an empty array.
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}
```
If callers need to distinguish "no beats" from "some beats", that check belongs at the `adaptStoryArc` level (e.g., return early with `{ chunks: [], warnings: [] }` when `arc.beats` is empty).

---

### WR-02: Public API entry point `adaptStoryArc` does not validate inputs with Zod

**File:** `packages/heygen/src/adapter.ts:99`
**Issue:** `adaptStoryArc` is the public export consumed by the CLI and n8n node. It accepts raw `StoryArc` and `AdaptOptions` objects without runtime validation. The project convention (CLAUDE.md) explicitly requires: *"Use zod to validate all public inputs."* Both schemas already exist: `StoryArcSchema` in `@buildstory/core` and `AdaptOptionsSchema` in `./types.ts`. Without validation, an invalid `beat.type` value not present in `BEAT_COLOR_MAP` would produce `undefined` as `background.value`, silently sending an invalid scene to the HeyGen API with no error surfaced to the caller.
**Fix:**
```typescript
import { StoryArcSchema } from '@buildstory/core'
import { AdaptOptionsSchema } from './types.js'

export function adaptStoryArc(arc: StoryArc, opts: AdaptOptions): AdaptResult {
  // Validate at the boundary — throws ZodError on invalid input
  const validatedArc = StoryArcSchema.parse(arc)
  const validatedOpts = AdaptOptionsSchema.parse(opts)

  const warnings: string[] = []
  const scenes: HeyGenScene[] = []

  for (const beat of validatedArc.beats) {
    const { scene, warning } = beatToScene(beat, validatedOpts)
    scenes.push(scene)
    if (warning !== null) {
      warnings.push(warning)
    }
  }

  const chunks = chunkBeats(scenes, HEYGEN_MAX_SCENES)
  return { chunks, warnings }
}
```

---

### WR-03: Off-by-one in `truncateSummary` drops a valid sentence boundary at position 0

**File:** `packages/heygen/src/adapter.ts:43`
**Issue:** The condition `if (lastBoundaryPos > 0)` is a strict greater-than check. If the regex finds a match at index 0 (i.e., the very first character of the 1500-char slice is a sentence terminator followed by whitespace), `lastBoundaryPos` is set to `0`, but the condition evaluates to `false` and the code falls through to a hard-cut at 1500 characters rather than slicing at the boundary. The correct threshold is `>= 0` since index 0 is a valid boundary position.
**Fix:**
```typescript
if (lastBoundaryPos >= 0) {
  const truncated = slice.slice(0, lastBoundaryPos + 1).trimEnd()
  return { text: truncated, truncated: true }
}
```

---

## Info

### IN-01: `HeyGenScene.voice.speed` is untyped `number` while `AdaptOptionsSchema.speed` is constrained to `[0.5, 2.0]`

**File:** `packages/heygen/src/types.ts:42`
**Issue:** The Zod schema `AdaptOptionsSchema` correctly constrains `speed` to the range `[0.5, 2.0]` matching HeyGen's documented API limits. However, the `HeyGenScene` interface declares `speed?: number` with no range constraint. A consumer constructing a `HeyGenScene` directly (bypassing `adaptStoryArc`) can supply an out-of-range value that will be sent to the API without any type-level warning.
**Fix:** Tighten the interface comment or consider a branded type. At minimum, add a JSDoc note so consumers are aware of the constraint:
```typescript
voice: {
  type: 'text'
  input_text: string
  voice_id: string
  /** HeyGen range: 0.5–2.0. Values outside this range are rejected by the API. */
  speed?: number
}
```

---

_Reviewed: 2026-04-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
