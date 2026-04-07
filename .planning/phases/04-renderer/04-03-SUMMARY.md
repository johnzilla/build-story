---
phase: 04-renderer
plan: "03"
subsystem: video
tags: [remotion, composition, scenes, render, srt, typescript, react]
dependency_graph:
  requires:
    - 04-01  # StoryBeat/StoryArc types
    - 04-02  # AudioManifest, SceneAudio, TTS types
  provides:
    - Remotion composition entry point with registerRoot
    - 4 scene components (TitleCard, TimelineBar, DecisionCallout, StatsCard)
    - renderVideo() orchestrator: bundle → selectComposition → renderMedia
    - generateSRT() subtitle generation
  affects:
    - packages/video/src/index.ts (expanded exports)
tech_stack:
  added:
    - remotion@4.0.446 (composition, Sequence, Audio, AbsoluteFill, interpolate)
    - "@remotion/bundler@4.0.446 (bundle())"
    - "@remotion/renderer@4.0.446 (selectComposition, renderMedia)"
    - subtitle@4.2.2 (stringifySync for SRT generation)
  patterns:
    - Remotion registerRoot + Composition + calculateMetadata pattern
    - SceneForBeat beat-type dispatch function
    - FADE_FRAMES=9 (9 frames @ 30fps = 300ms) for all scene transitions
    - Sequence-per-beat with Audio inside Sequence for automatic timing
key_files:
  created:
    - packages/video/src/render/composition/types.ts
    - packages/video/src/render/composition/index.ts
    - packages/video/src/render/composition/Root.tsx
    - packages/video/src/render/composition/BuildStory.tsx
    - packages/video/src/render/composition/scenes/TitleCard.tsx
    - packages/video/src/render/composition/scenes/TimelineBar.tsx
    - packages/video/src/render/composition/scenes/DecisionCallout.tsx
    - packages/video/src/render/composition/scenes/StatsCard.tsx
    - packages/video/src/render/index.ts
    - packages/video/src/render/srt.ts
  modified:
    - packages/video/src/index.ts
decisions:
  - "Audio inside Sequence: each Audio component is inside its beat's Sequence, so Remotion cascades timing automatically — no manual startFrom math needed"
  - "calculateMetadata derives durationInFrames from AudioManifest.totalDurationSeconds * fps at render time"
  - "resolveCompositionEntry uses fileURLToPath + path.resolve to locate src/ from dist/ at runtime"
  - "DECISION_TYPES set for obstacle/pivot/decision → DecisionCallout; all others → TimelineBar"
  - "StatsCard dispatched to second-to-last beat by index, not by beat type"
metrics:
  duration_minutes: 15
  completed_date: "2026-04-06"
  tasks_completed: 3
  tasks_total: 3
  files_created: 10
  files_modified: 1
---

# Phase 4 Plan 3: Remotion Composition, Scene Components, and Render Orchestrator Summary

**One-liner:** Remotion composition with 4 beat-type scene components, calculateMetadata dynamic duration, renderVideo() bundle-to-MP4 orchestration, and SRT subtitle generation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remotion composition types, entry point, Root, BuildStory | 5b70b79 | types.ts, index.ts, Root.tsx, BuildStory.tsx |
| 2 | 4 scene components with design tokens | e4474aa | TitleCard.tsx, TimelineBar.tsx, DecisionCallout.tsx, StatsCard.tsx |
| 3 | renderVideo() orchestrator and SRT generation | fa7fd51 | render/index.ts, srt.ts, index.ts |

## What Was Built

### Remotion Composition Foundation (Task 1)

- `composition/types.ts`: `BeatWithFrames` (extends StoryBeat with durationInFrames) and `BuildStoryInputProps` (storyArc + audioManifest + fps)
- `composition/index.ts`: calls `registerRoot(RemotionRoot)` — required for `selectComposition()` to discover the composition
- `composition/Root.tsx`: registers `BuildStory` composition at 1920x1080 30fps with `calculateMetadata` that derives actual `durationInFrames` from `AudioManifest.totalDurationSeconds * fps`
- `composition/BuildStory.tsx`: maps beats to `BeatWithFrames` using audio manifest durations + silence gaps, renders one `<Sequence>` per beat with `<Audio>` inside, dispatches to `SceneForBeat`

### Scene Components (Task 2)

All 4 components follow the same pattern:
- D-06 palette: `#1a1a2e` background, `#e94560` accent, `#eaeaea` text
- D-07 fade: `FADE_FRAMES = 9` (300ms at 30fps), `interpolate()` with clamp
- Font: Inter, system-ui, -apple-system, sans-serif

| Component | Trigger | Visual |
|-----------|---------|--------|
| TitleCard | first + last beat | Centered title, large text, accent subtitle |
| TimelineBar | idea/goal/attempt/result/side_quest/open_loop | Left-aligned content with left-to-right progress bar animation |
| DecisionCallout | obstacle/pivot/decision | Icon badge (warning/refresh/checkmark) + left accent bar |
| StatsCard | second-to-last beat | Centered, large title, centered body |

### Render Orchestrator + SRT (Task 3)

- `render/index.ts`: `renderVideo(storyArc, audioManifest, options)` — bundles composition via `@remotion/bundler`, resolves composition metadata via `selectComposition`, renders H.264+AAC MP4 via `renderMedia` with progress callback, then writes SRT file
- `render/srt.ts`: `generateSRT(beats, scenes)` converts `StoryBeat.summary` + `SceneAudio` start/duration offsets to SRT format using `subtitle@4.2.2` `stringifySync`
- `packages/video/src/index.ts`: expanded to export `renderVideo`, `generateSRT`, `RenderProgress`, `RenderOptions`, `BuildStoryInputProps`, `BeatWithFrames`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Explicit 'decision' type reference in DecisionCallout icon dispatch**
- **Found during:** Task 3 verification
- **Issue:** The original plan's DecisionCallout had `beat.type === 'obstacle' ? ... : beat.type === 'pivot' ? ... : '\u2714'` — the `decision` type was an implicit fallback, which didn't satisfy the acceptance criterion requiring explicit references to all three types
- **Fix:** Changed to explicit three-way check: `... : beat.type === 'decision' ? '\u2714' : '\u2022'`
- **Files modified:** `packages/video/src/render/composition/scenes/DecisionCallout.tsx`
- **Commit:** fa7fd51

**2. [Rule 2 - Missing functionality] fileURLToPath import in render/index.ts**
- **Found during:** Task 3 implementation
- **Issue:** Plan used `new URL(import.meta.url).pathname` directly which can produce wrong paths on Windows (URL-encoded paths). Added `fileURLToPath` from `node:url` for correct cross-platform path resolution
- **Fix:** Import `fileURLToPath` and use `fileURLToPath(import.meta.url)` in `resolveCompositionEntry()`
- **Files modified:** `packages/video/src/render/index.ts`
- **Commit:** fa7fd51

## Known Stubs

None. All components render from live `beat` and `audioManifest` props — no hardcoded placeholder data flows to UI rendering.

## Threat Flags

No new threat surface introduced beyond what was in the plan's threat model. All inputs (StoryArc, AudioManifest) flow from the TTS pipeline — no new network endpoints, auth paths, or file access patterns beyond what was planned.

## Self-Check

Verified files exist:
- [x] `packages/video/src/render/composition/types.ts`
- [x] `packages/video/src/render/composition/index.ts`
- [x] `packages/video/src/render/composition/Root.tsx`
- [x] `packages/video/src/render/composition/BuildStory.tsx`
- [x] `packages/video/src/render/composition/scenes/TitleCard.tsx`
- [x] `packages/video/src/render/composition/scenes/TimelineBar.tsx`
- [x] `packages/video/src/render/composition/scenes/DecisionCallout.tsx`
- [x] `packages/video/src/render/composition/scenes/StatsCard.tsx`
- [x] `packages/video/src/render/index.ts`
- [x] `packages/video/src/render/srt.ts`

Verified commits exist:
- [x] 5b70b79: feat(04-03): create Remotion composition types, entry point, Root, and BuildStory
- [x] e4474aa: feat(04-03): create 4 scene components with D-06 palette and D-07 fade transitions
- [x] fa7fd51: feat(04-03): implement renderVideo() orchestrator and SRT subtitle generation

Build: `pnpm --filter @buildstory/video build` exits 0

## Self-Check: PASSED
