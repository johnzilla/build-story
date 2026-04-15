# Phase 6: StoryArc Adapter - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure adapter function that converts StoryArc beats into HeyGen `video_inputs` arrays — with beat-type background colors and automatic chunking for arcs exceeding 10 beats. This function never calls the HeyGen API and requires no credentials. It is fully unit-testable.

</domain>

<decisions>
## Implementation Decisions

### Beat-to-Color Palette
- **D-01:** Use a narrative arc color palette — cool tones for setup beats, warm tones for tension, green for resolution. Colors tell a visual story even without audio.
- **D-02:** Exact hex values as starting point:
  - `idea` → `#1E3A5F` (deep blue)
  - `goal` → `#2D5F8A` (medium blue)
  - `attempt` → `#4A90D9` (bright blue)
  - `obstacle` → `#D35400` (burnt orange)
  - `pivot` → `#E74C3C` (red-orange)
  - `side_quest` → `#8E44AD` (purple)
  - `decision` → `#F39C12` (amber)
  - `result` → `#27AE60` (green)
  - `open_loop` → `#7F8C8D` (gray)
- **D-03:** Colors are solid full-screen backgrounds behind the avatar. No gradients or overlays — HeyGen's `background_color` field handles this natively.

### Scene Script Content
- **D-04:** Each beat's `summary` field is used directly as the HeyGen scene script text. No title prefix, no beat-type intro, no generated framing text. The LLM narrator already wrote the narration.
- **D-05:** Long summaries exceeding HeyGen's 1500-character limit are truncated at the nearest sentence boundary before the limit. A warning is included in the adapter output (not console.warn — core stays pure).

### Chunking
- **D-06:** Arcs with more than 10 beats are split into clean chunks of ≤10 beats each. No overlap, no recap text, no transition beats between chunks.
- **D-07:** The adapter returns an array of video_inputs arrays (one per chunk). The caller (Phase 7) receives multiple chunks and handles concatenation post-download.

### Claude's Discretion
- Adapter function signature and return type shape — design based on what Phase 7 will need to consume
- Zod schema for the adapter output (video_inputs structure)
- How the beat-to-color map is stored (const object, Map, etc.)
- Test fixture design — realistic StoryArc fixtures with various beat counts

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Types
- `packages/core/src/types/story.ts` — StoryArc, StoryBeat, BeatType schemas — the adapter's input contract

### HeyGen Package (Phase 5 output)
- `packages/heygen/src/types.ts` — HeyGenOptions, HeyGenConfig, HeyGenCostEstimate, PreflightResult
- `packages/heygen/src/cost.ts` — `estimateHeyGenCost()` — already takes `StoryBeat[]`, shows the pattern for consuming beats
- `packages/heygen/src/index.ts` — Package public API surface — adapter export goes here

### Research
- `.planning/research/STACK.md` §v1.1 Addendum — HeyGen API `video_inputs` request shape, scene structure
- `.planning/research/PITFALLS.md` §HeyGen Integration Pitfalls — Character limits, rate limits, scene count limits
- `.planning/research/FEATURES.md` §SECTION 2 — API workflow, avatar types, cost model

### Phase 5 Context
- `.planning/phases/05-heygen-package/05-CONTEXT.md` — Prior decisions on renderer dispatch, config patterns, lazy install

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `estimateHeyGenCost()` in `packages/heygen/src/cost.ts` — already iterates over `StoryBeat[]` with duration/word-count logic. The adapter follows the same pattern of consuming beats.
- `StoryBeatSchema` and `BeatTypeSchema` in `packages/core/src/types/story.ts` — Zod schemas for input validation
- `HeyGenOptionsSchema` in `packages/heygen/src/types.ts` — config validation pattern to follow

### Established Patterns
- `@buildstory/heygen` has zero imports from `@buildstory/video` — adapter stays within the heygen package
- Core types imported from `@buildstory/core` — adapter imports `StoryArc`, `StoryBeat`, `BeatType`
- Zod validation on all structured data
- Warnings returned in metadata objects, not via console.warn (core purity)

### Integration Points
- `packages/heygen/src/index.ts` — Add adapter export to public API
- `packages/heygen/src/` — New adapter module lives here alongside cost.ts and preflight.ts

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following existing codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-storyarc-adapter*
*Context gathered: 2026-04-15*
