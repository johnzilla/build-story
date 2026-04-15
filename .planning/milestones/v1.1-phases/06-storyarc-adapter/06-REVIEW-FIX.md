---
phase: 06-storyarc-adapter
fixed_at: 2026-04-15T15:34:15Z
review_path: .planning/phases/06-storyarc-adapter/06-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-04-15T15:34:15Z
**Source review:** .planning/phases/06-storyarc-adapter/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03; IN-01 excluded by fix_scope: critical_warning)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: `chunkBeats` returns a phantom empty chunk for a 0-beat arc

**Files modified:** `packages/heygen/src/adapter.ts`
**Commit:** 2d8e36c
**Applied fix:** Removed the early-return guard `if (items.length === 0) { return [[]] }` from `chunkBeats`. The loop naturally produces zero iterations for an empty input, returning `[]` instead of `[[]]`. No empty API calls will be submitted for a 0-beat arc.

---

### WR-03: Off-by-one in `truncateSummary` drops a valid sentence boundary at position 0

**Files modified:** `packages/heygen/src/adapter.ts`
**Commit:** e8587d0
**Applied fix:** Changed the boundary condition from `if (lastBoundaryPos > 0)` to `if (lastBoundaryPos >= 0)`. Index 0 is now correctly treated as a valid sentence boundary position, preventing a spurious hard-cut when the regex match falls at the start of the 1500-char slice.

---

### WR-02: Public API entry point `adaptStoryArc` does not validate inputs with Zod

**Files modified:** `packages/heygen/src/adapter.ts`
**Commit:** 061fbc5
**Applied fix:** Added value imports for `StoryArcSchema` from `@buildstory/core` and `AdaptOptionsSchema` from `./types.js`. Added `StoryArcSchema.parse(arc)` and `AdaptOptionsSchema.parse(opts)` at the top of `adaptStoryArc`, using the validated results (`validatedArc`, `validatedOpts`) throughout the function body. Invalid inputs now throw a `ZodError` at the public boundary rather than silently producing malformed HeyGen API payloads.

---

_Fixed: 2026-04-15T15:34:15Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
