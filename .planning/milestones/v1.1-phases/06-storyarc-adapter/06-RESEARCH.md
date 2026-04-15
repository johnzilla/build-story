# Phase 6: StoryArc Adapter - Research

**Researched:** 2026-04-15
**Domain:** Pure TypeScript adapter function — StoryArc beats to HeyGen video_inputs
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Narrative arc color palette — cool tones for setup, warm for tension, green for resolution.
- **D-02:** Exact hex values per beat type:
  - `idea` → `#1E3A5F` (deep blue)
  - `goal` → `#2D5F8A` (medium blue)
  - `attempt` → `#4A90D9` (bright blue)
  - `obstacle` → `#D35400` (burnt orange)
  - `pivot` → `#E74C3C` (red-orange)
  - `side_quest` → `#8E44AD` (purple)
  - `decision` → `#F39C12` (amber)
  - `result` → `#27AE60` (green)
  - `open_loop` → `#7F8C8D` (gray)
- **D-03:** Solid full-screen background colors behind the avatar. No gradients. HeyGen's `background.type: "color"` field handles this natively.
- **D-04:** Each beat's `summary` field used directly as HeyGen scene script text. No title prefix, no beat-type intro.
- **D-05:** Long summaries exceeding HeyGen's 1500-character limit are truncated at the nearest sentence boundary before the limit. Warning included in adapter output (not console.warn).
- **D-06:** Arcs with more than 10 beats split into clean chunks of ≤10 beats each. No overlap, no recap, no transition beats.
- **D-07:** Adapter returns an array of video_inputs arrays (one per chunk). Caller (Phase 7) receives multiple chunks.

### Claude's Discretion

- Adapter function signature and return type shape
- Zod schema for the adapter output (video_inputs structure)
- How the beat-to-color map is stored (const object, Map, etc.)
- Test fixture design — realistic StoryArc fixtures with various beat counts

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HGVR-05 | StoryArc beats are mapped to HeyGen video_inputs via an adapter (Strategy A: concatenated narration) | Beat-to-scene mapping pattern documented below; `video_inputs` shape verified from STACK.md §v1.1 Addendum |
| HGVR-06 | Beat types map to distinct background colors in HeyGen scenes | Color map D-02 locked; `background.type: "color"` field verified in STACK.md API shape |
| HGVR-07 | Story arcs with more than 10 beats are chunked into multiple API calls, output concatenated | Chunking return shape and algorithm documented below |
</phase_requirements>

---

## Summary

Phase 6 is a pure transformation function with no I/O, no API calls, and no network dependencies. The entire phase produces one new source file (`packages/heygen/src/adapter.ts`), one export added to `packages/heygen/src/index.ts`, and a companion test file. The adapter's job is to convert a `StoryArc` (the narrator's output) into one or more HeyGen `video_inputs` arrays ready for Phase 7's API submission.

The domain is well-understood: input types are fully defined in `packages/core/src/types/story.ts`, output shape is verified from the v1.1 research addendum in STACK.md (the `HeyGenVideoGenerateRequest.video_inputs` array structure), and all decisions about color mapping, text handling, and chunking are locked in CONTEXT.md. There are no external dependencies to add — the adapter uses only types and the Zod validation pattern already present in `@buildstory/heygen`.

The primary complexity is in two places: (1) sentence-boundary truncation for summaries exceeding 1,500 characters (need a clean regex approach), and (2) chunk-count correctness (a 15-beat arc must produce exactly 2 chunks — [10, 5] — with no beats dropped). Both are straightforwardly unit-testable with no mocks.

**Primary recommendation:** Implement as `packages/heygen/src/adapter.ts` exporting a single `adaptStoryArc()` function. Keep the beat-to-color map as a `const` object typed `Record<BeatType, string>`. Return type carries both chunks and a `warnings` string array for truncation notices.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Beat-to-color mapping | `@buildstory/heygen` adapter | — | Color palette is HeyGen-specific; Remotion has its own visual system |
| Summary truncation | `@buildstory/heygen` adapter | — | HeyGen API constraint; core types are renderer-agnostic |
| Arc chunking | `@buildstory/heygen` adapter | — | HeyGen ≤10 scene limit; constraint does not apply to Remotion |
| video_inputs construction | `@buildstory/heygen` adapter | Phase 7 caller | Adapter builds the data shape; Phase 7 passes it to the API |
| Warning surfacing | Adapter return value | Phase 7 caller logs | Core purity — no console.warn; warnings flow up through return |
| API submission | Phase 7 (not this phase) | — | Out of scope for Phase 6 |

---

## Standard Stack

### Core (already installed — no new dependencies for this phase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 6.0.2 | Language | Project-locked [VERIFIED: codebase] |
| Zod | 4.3.6 | Runtime output schema validation | Already in `@buildstory/heygen` package.json; validate adapter output shape [VERIFIED: packages/heygen/package.json] |
| Vitest | 4.1.2 | Test runner | Already in `@buildstory/heygen` devDependencies [VERIFIED: packages/heygen/package.json] |

**No new dependencies required.** The adapter is pure TypeScript that imports from `@buildstory/core` (already a workspace dep) and returns a plain typed object.

### Installation

No install step for this phase. All required packages are already declared.

---

## Architecture Patterns

### Data Flow Diagram

```
StoryArc (from narrate phase)
    │
    ▼
adaptStoryArc(arc, opts)
    │
    ├─► beats.length ≤ 10?
    │       │
    │       ├─ YES → single chunk → [[scene, scene, ...]]
    │       │
    │       └─ NO → slice into ≤10-beat chunks → [[s,s,...], [s,s,...], ...]
    │
    ▼ (per beat, per chunk)
beatToScene(beat, opts)
    │
    ├─► truncateSummary(beat.summary) → text + optional warning
    ├─► BEAT_COLOR_MAP[beat.type] → background hex
    ├─► opts.avatarId, opts.voiceId, opts.avatarStyle, opts.speed → character/voice fields
    │
    ▼
HeyGenScene { character, voice, background }
    │
    ▼
AdaptResult {
  chunks: HeyGenScene[][]   ← one sub-array per API call
  warnings: string[]         ← truncation notices, non-fatal
}
```

### Recommended Project Structure

```
packages/heygen/src/
├── adapter.ts       # new — adaptStoryArc(), beatToScene(), truncateSummary()
├── cost.ts          # existing — estimateHeyGenCost()
├── index.ts         # add: export { adaptStoryArc } from './adapter.js'
├── preflight.ts     # existing — preflightHeyGenCheck()
└── types.ts         # existing + new: HeyGenScene, AdaptOptions, AdaptResult

packages/heygen/src/__tests__/
└── adapter.test.ts  # new — unit tests, no network calls
```

### Pattern 1: Beat-to-Color Const Map

Use a typed `const` object — exhaustive, refactor-safe, zero runtime overhead.

```typescript
// Source: packages/core/src/types/story.ts (BeatType enum)
import type { BeatType } from '@buildstory/core'

const BEAT_COLOR_MAP: Record<BeatType, string> = {
  idea:       '#1E3A5F',
  goal:       '#2D5F8A',
  attempt:    '#4A90D9',
  obstacle:   '#D35400',
  pivot:      '#E74C3C',
  side_quest: '#8E44AD',
  decision:   '#F39C12',
  result:     '#27AE60',
  open_loop:  '#7F8C8D',
} as const
```

TypeScript enforces exhaustiveness: if a new `BeatType` is added to the Zod schema without updating this map, the build fails. [VERIFIED: BeatTypeSchema in packages/core/src/types/story.ts — 9 variants confirmed]

### Pattern 2: Sentence-Boundary Truncation

The 1,500-character limit is a HeyGen practical constraint (PITFALLS.md §Pitfall 11 — community-observed; doc limit is 5,000). Decision D-05 sets the project limit at 1,500 characters with truncation at sentence boundary.

```typescript
// Source: CONTEXT.md D-05 decision
const HEYGEN_CHAR_LIMIT = 1500

function truncateSummary(text: string): { text: string; truncated: boolean } {
  if (text.length <= HEYGEN_CHAR_LIMIT) {
    return { text, truncated: false }
  }
  // Find last sentence boundary at or before the limit
  // Sentence end: period/exclamation/question followed by whitespace or end-of-string
  const window = text.slice(0, HEYGEN_CHAR_LIMIT)
  const lastSentenceEnd = window.search(/[.!?][^.!?]*$/)
  const cutAt = lastSentenceEnd > 0 ? lastSentenceEnd + 1 : HEYGEN_CHAR_LIMIT
  return { text: text.slice(0, cutAt).trimEnd(), truncated: true }
}
```

**Edge cases to test:**
- Summary exactly 1500 chars → no truncation
- Summary 1501 chars, no sentence boundary → hard cut at 1500
- Summary with sentence boundary at char 1450 → cut at boundary
- Empty summary → return as-is

### Pattern 3: Chunking Algorithm

Decision D-06: ≤10 beats per chunk, clean slices, no overlap.

```typescript
// Source: CONTEXT.md D-06, D-07 decisions
const HEYGEN_MAX_SCENES = 10

function chunkBeats<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}
```

For a 15-beat arc: `chunkBeats(beats, 10)` → `[[b0..b9], [b10..b14]]` — two chunks.
For a 10-beat arc: one chunk of 10.
For a 5-beat arc: one chunk of 5.

### Pattern 4: Adapter Function Signature

The Phase 7 caller needs both the chunked scenes and which options were used (to build the full HeyGen request body). The adapter only needs the subset of HeyGenOptions required to build scene content — `avatarId`, `voiceId`, `speed`, and `avatarStyle` (optional).

```typescript
// Source: CONTEXT.md discretion — "function signature based on what Phase 7 will need"
import type { StoryArc, BeatType } from '@buildstory/core'

// New types to add to packages/heygen/src/types.ts:

export interface HeyGenScene {
  character: {
    type: 'avatar'
    avatar_id: string
    avatar_style?: 'normal' | 'circle' | 'closeUp'
  }
  voice: {
    type: 'text'
    input_text: string
    voice_id: string
    speed?: number
  }
  background: {
    type: 'color'
    value: string     // hex
  }
}

export interface AdaptOptions {
  avatarId: string
  voiceId: string
  speed?: number
  avatarStyle?: 'normal' | 'circle' | 'closeUp'
}

export interface AdaptResult {
  chunks: HeyGenScene[][]    // one sub-array per API call
  warnings: string[]          // non-fatal notices (e.g., truncation)
}

// In adapter.ts:
export function adaptStoryArc(arc: StoryArc, opts: AdaptOptions): AdaptResult
```

**Why `chunks: HeyGenScene[][]` rather than a flat array:** Phase 7 must submit each chunk as a separate API call and receive a separate `video_id`. Returning pre-chunked arrays means Phase 7 never re-derives chunking logic — it iterates `result.chunks` and submits each as one request.

### Pattern 5: Zod Schema for AdaptResult

All structured outputs in this codebase are Zod-validated. [VERIFIED: pattern in packages/heygen/src/types.ts — HeyGenOptionsSchema; packages/core/src/types/story.ts — StoryArcSchema]

```typescript
// Source: existing Zod pattern in packages/heygen/src/types.ts
import { z } from 'zod'

export const HeyGenSceneSchema = z.object({
  character: z.object({
    type: z.literal('avatar'),
    avatar_id: z.string(),
    avatar_style: z.enum(['normal', 'circle', 'closeUp']).optional(),
  }),
  voice: z.object({
    type: z.literal('text'),
    input_text: z.string().min(1),
    voice_id: z.string(),
    speed: z.number().min(0.5).max(2.0).optional(),
  }),
  background: z.object({
    type: z.literal('color'),
    value: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  }),
})

export const AdaptResultSchema = z.object({
  chunks: z.array(z.array(HeyGenSceneSchema)),
  warnings: z.array(z.string()),
})
```

**Note:** The adapter does not need to Zod-parse its own return value (it constructs it directly from typed inputs). The schemas exist so Phase 7 can validate adapter output before submission, and so tests can assert schema compliance.

### Anti-Patterns to Avoid

- **Logging warnings via `console.warn`:** Breaks core purity. Return warnings in `AdaptResult.warnings`. [VERIFIED: pattern established in NARR-12 per REQUIREMENTS.md; CONTEXT.md D-05 restates it]
- **Using `HeyGenOptions` (full config type) as `AdaptOptions`:** The adapter does not need `apiKey`, `timeoutSeconds`, or `width`/`height` — those are API-call concerns owned by Phase 7. Narrow the input type to exactly what's needed.
- **Mutating input beats:** The adapter is a pure function. Never modify `arc.beats`. Build new scene objects from beat data.
- **console.log for debugging during dev:** Tests run in CI without visible stdout; use Vitest `expect` assertions only.
- **Flat `HeyGenScene[]` return:** Returning a flat array forces Phase 7 to re-derive chunking. Pre-chunked `HeyGenScene[][]` is the correct contract per D-07.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sentence detection for truncation | NLP tokenizer | Simple regex on `.!?` punctuation | Beats are LLM-generated narration, not code — punctuation-based split is sufficient and has no dependencies |
| Exhaustive BeatType enum check | Runtime `if`/`switch` with default throw | TypeScript `Record<BeatType, string>` typed object | Compile-time exhaustiveness; TypeScript errors on missing keys |
| Schema validation of output | Custom type guards | Zod schemas | Project standard; already in package deps |
| Array chunking | lodash chunk | Plain `for` loop with slice | Zero dependencies; 4-line implementation; no lodash in heygen package |

**Key insight:** This phase has no "don't hand-roll" footguns — it's a pure data transformation with no I/O, no concurrency, and no external APIs. The complexity budget goes entirely into correct test coverage.

---

## Common Pitfalls

### Pitfall 1: Off-by-One in Chunk Boundaries
**What goes wrong:** A 10-beat arc produces 2 chunks (one of 10, one of 0) instead of 1 chunk of 10.
**Why it happens:** `i < items.length` vs `i <= items.length` confusion, or `Math.ceil` vs `Math.floor` in chunk count calculation.
**How to avoid:** Test arc sizes: 1, 9, 10, 11, 15, 20. Verify `chunks.length` and `chunks[N].length` for each.
**Warning signs:** Test for 10 beats is missing; only 5-beat and 15-beat are tested.

### Pitfall 2: Beat Dropped During Chunking
**What goes wrong:** After chunking, the total scene count across all chunks is less than the original beat count.
**Why it happens:** Off-by-one in slice indices.
**How to avoid:** In tests, assert `chunks.flat().length === arc.beats.length` for every test case.
**Warning signs:** No "all beats accounted for" assertion in chunking tests.

### Pitfall 3: Truncation Warning Not Surfaced
**What goes wrong:** A beat's summary is truncated but `warnings` array is empty. Phase 7 caller has no way to know content was dropped.
**Why it happens:** `truncateSummary()` modifies text but the caller forgets to collect the warning.
**How to avoid:** `truncateSummary()` returns `{ text, truncated }`. The `beatToScene()` caller checks `truncated` and pushes to warnings accumulator. Test with a summary > 1500 chars; assert `warnings.length > 0`.
**Warning signs:** Test for long summary does not assert on `result.warnings`.

### Pitfall 4: Summary Truncated Mid-Word (Not at Sentence Boundary)
**What goes wrong:** Text is cut at character 1500 in the middle of a word: `"...developi"` instead of `"...development."`.
**Why it happens:** Hard slice without checking sentence boundary.
**How to avoid:** `truncateSummary()` searches for the last `.!?` before the limit. Fallback to hard cut only if no sentence boundary exists in the window (handles edge case where a beat has one very long run-on sentence).
**Warning signs:** Truncation test uses a summary with no periods — should still produce valid text, not crash.

### Pitfall 5: `HeyGenOptions` (full config) as `AdaptOptions` — API Key Leakage
**What goes wrong:** Adapter accepts the full `HeyGenOptions` type which includes `apiKey`. The adapter never uses it, but tests that construct `AdaptOptions` now require a mock API key, and logs may accidentally include it.
**Why it happens:** Lazily reusing the existing config type instead of defining a narrow input type.
**How to avoid:** Define `AdaptOptions` as a separate narrow interface with only `avatarId`, `voiceId`, `speed?`, `avatarStyle?`. [VERIFIED: HeyGenOptions in packages/heygen/src/types.ts — apiKey is present and sensitive]
**Warning signs:** Test calls `adaptStoryArc(arc, { apiKey: 'test-key', ... })`.

### Pitfall 6: Beat Color Map Not Exhaustive — Runtime KeyError
**What goes wrong:** A future `BeatType` added to `@buildstory/core` (e.g., `breakthrough`) produces `undefined` from `BEAT_COLOR_MAP[beat.type]`, which silently sends `value: undefined` to HeyGen.
**Why it happens:** Color map is typed as `{ [key: string]: string }` (not `Record<BeatType, string>`).
**How to avoid:** Type as `Record<BeatType, string>`. TypeScript will error at compile time if a new BeatType is added without updating the map.
**Warning signs:** Map typed as `Record<string, string>` or `{ [key: string]: string }`.

---

## Code Examples

Verified patterns from existing codebase:

### Existing: estimateHeyGenCost() — pattern for consuming beats
```typescript
// Source: packages/heygen/src/cost.ts [VERIFIED: file read]
export function estimateHeyGenCost(beats: StoryBeat[], opts: HeyGenConfig): HeyGenCostEstimate {
  const totalSeconds = beats.reduce((sum, b) => {
    if (b.duration_seconds !== undefined) return sum + b.duration_seconds
    const words = b.summary.split(/\s+/).length
    return sum + (words / 150) * 60
  }, 0)
  // ...
}
```
The adapter follows the same pattern: iterate `arc.beats`, transform each beat, accumulate results.

### Existing: Preflight — warning accumulator pattern
```typescript
// Source: packages/heygen/src/preflight.ts [VERIFIED: file read]
const failures: string[] = []
if (!opts.apiKey) {
  failures.push('HEYGEN_API_KEY not set. Required for --renderer=heygen.')
}
return { ok: failures.length === 0, failures }
```
The adapter's `warnings` array follows the same accumulator pattern — collect warnings during transformation, return in result object.

### Existing: Zod validation pattern in heygen package
```typescript
// Source: packages/heygen/src/types.ts [VERIFIED: file read]
export const HeyGenOptionsSchema = z.object({
  apiKey: z.string().min(1),
  avatarId: z.string().min(1),
  // ...
})
export type HeyGenConfig = z.input<typeof HeyGenOptionsSchema>
```
`AdaptOptions` follows the same pattern: define Zod schema, export both schema and inferred type.

### HeyGen video_inputs scene shape (from STACK.md)
```typescript
// Source: .planning/research/STACK.md §v1.1 Addendum [VERIFIED: file read]
{
  character: {
    type: 'avatar',
    avatar_id: 'Monica_chair_front_public',
    avatar_style: 'normal',  // optional
  },
  voice: {
    type: 'text',
    input_text: 'Your narration here...',
    voice_id: '2d5b0e6cf36f460aa7fc47e3eee4ba54',
    speed: 1.0,  // optional
  },
  background: {
    type: 'color',
    value: '#1E3A5F',  // hex, from BEAT_COLOR_MAP
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HeyGen SDK (community) | Native fetch + typed interfaces | v1.1 research decision | No external SDK needed; Phase 6 has zero HTTP code anyway — pure data |
| Zod v3 | Zod v4 (14x faster, TS 5.5+) | Zod v4 released 2025-08 | v4 already in package.json; use z.object() API — no breaking change for simple schemas |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | HeyGen `background.type: "color"` field accepts any 6-digit hex string | Code Examples | API rejects color; adapter must validate hex format (Zod regex already covers this) |
| A2 | HeyGen `video_inputs` array accepts up to 10 scenes per request without additional chunking | Standard Stack / Chunking | If limit is lower (e.g., 5), chunk size constant must change — trivial to fix |
| A3 | `beat.summary` is the correct text field to use (not `beat.title`) | Code Examples | Per D-04 (locked) — this is a locked decision, not an assumption |

**Notes on A1:** STACK.md documents `value: string // hex e.g. "#1a1a2e"` [CITED: .planning/research/STACK.md §v1.1 Addendum]. The Zod hex regex `^#[0-9A-Fa-f]{6}$` validates at build time.

**Notes on A2:** PITFALLS.md §Pitfall 11 references "10 scenes per request" as the community-observed practical limit [CITED: .planning/research/PITFALLS.md §HeyGen Integration Pitfalls]. The chunk size is a named constant (`HEYGEN_MAX_SCENES = 10`) so it can be adjusted without refactoring.

---

## Open Questions

1. **avatarStyle field in AdaptOptions**
   - What we know: HeyGen accepts `'normal' | 'circle' | 'closeUp'`; STACK.md documents it as optional
   - What's unclear: Should `avatar_style` be per-beat (different style per beat type) or global per adapter call?
   - Recommendation: Global per adapter call (pass in `AdaptOptions`). Per-beat style would complicate the color palette story without clear benefit. If Phase 7 needs per-beat style later, `AdaptOptions` can be extended.

2. **`dimension` field (width/height) in the scene**
   - What we know: `dimension` is a top-level field on the HeyGen request, not per-scene (STACK.md documents it on `HeyGenVideoGenerateRequest`, not on individual `video_inputs` items)
   - What's unclear: The adapter builds the `video_inputs` array; `dimension` is not part of each scene
   - Recommendation: `dimension` is NOT in `HeyGenScene`. Phase 7 assembles the full request body, attaches `dimension` from `HeyGenOptions`. The adapter is `video_inputs`-only.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 6 is a pure data transformation. No external services, CLI tools, or runtimes beyond the project's existing Node.js/pnpm stack. No network calls, no FFmpeg, no HeyGen API.

---

## Validation Architecture

`workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`. Section skipped per config.

---

## Security Domain

No ASVS categories apply to a pure data transformation function with no I/O, no credentials, no network calls, no user input handling, and no storage. The adapter accepts typed, already-validated TypeScript objects and returns the same.

The only security-adjacent concern: `AdaptOptions` must NOT include `apiKey` (see Pitfall 5 above). This is a design decision, not an ASVS control.

---

## Sources

### Primary (HIGH confidence)
- `packages/core/src/types/story.ts` — BeatTypeSchema (9 variants), StoryArcSchema, StoryBeatSchema [VERIFIED: file read]
- `packages/heygen/src/types.ts` — HeyGenOptionsSchema, HeyGenConfig, PreflightResult [VERIFIED: file read]
- `packages/heygen/src/cost.ts` — beat iteration pattern [VERIFIED: file read]
- `packages/heygen/src/index.ts` — current public API surface [VERIFIED: file read]
- `packages/heygen/src/preflight.ts` — warning accumulator pattern [VERIFIED: file read]
- `packages/heygen/package.json` — dependency declarations (zod, p-retry, vitest) [VERIFIED: file read]

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md §v1.1 Addendum` — HeyGen `video_inputs` request shape, scene structure, background field [CITED: verified from HeyGen API docs in prior research session]
- `.planning/research/PITFALLS.md §HeyGen Integration Pitfalls` — 1500-char per scene limit (Pitfall 11), 10-scene chunk reasoning [CITED: community-observed, prior research session]
- `.planning/phases/06-storyarc-adapter/06-CONTEXT.md` — All locked decisions D-01 through D-07 [VERIFIED: file read]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json; no new deps needed
- Architecture: HIGH — input/output types fully verified from codebase; pattern follows existing cost.ts
- Pitfalls: HIGH — 4 of 6 pitfalls verified from existing code patterns; 2 (off-by-one edge cases) are standard algorithmic pitfalls

**Research date:** 2026-04-15
**Valid until:** 2026-07-15 (stable domain — no HeyGen API changes affect pure adapter logic)
