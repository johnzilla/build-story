---
phase: 02-scanner
plan: "02"
subsystem: core/scan
tags: [scanner, artifact-parser, timeline-builder, tdd, remark, gray-matter]
dependency_graph:
  requires: ["02-01"]
  provides: ["scan-pipeline", "artifact-classification", "timeline-construction"]
  affects: ["packages/core/src/scan/", "packages/core/src/__tests__/"]
tech_stack:
  added: []
  patterns:
    - "remark + unist-util-visit for markdown AST traversal"
    - "gray-matter for frontmatter extraction (faster header scanning)"
    - "djb2 hash for deterministic event ID generation without crypto"
    - "ArtifactSource injection pattern — zero direct fs/path imports in core"
key_files:
  created:
    - packages/core/src/scan/file-walker.ts
    - packages/core/src/scan/artifact-parser.ts
    - packages/core/src/scan/timeline-builder.ts
    - packages/core/src/__tests__/file-walker.test.ts
    - packages/core/src/__tests__/artifact-parser.test.ts
    - packages/core/src/__tests__/timeline-builder.test.ts
    - packages/core/src/__tests__/scan.test.ts
  modified:
    - packages/core/src/scan/index.ts
    - packages/core/src/types/source.ts
decisions:
  - "Path-context classification before filename: .planning/PLAN.md is gsd not gstack"
  - "allPaths filtering for cross-refs: only include refs to known scanned files"
  - "exactOptionalPropertyTypes fix: gitSource ?? null before passing to buildTimeline"
  - "djb2 hash chosen for deterministic IDs with no crypto/node dependency"
metrics:
  duration: "~6 minutes"
  completed: "2026-04-05"
  tasks_completed: 3
  tasks_total: 3
  files_created: 7
  files_modified: 2
  tests_added: 89
---

# Phase 02 Plan 02: Core Scan Sub-modules Summary

**One-liner:** Real scan() pipeline via file-walker, remark AST artifact-parser, djb2 timeline-builder replacing the stub — 89 tests, zero fs/path boundary violations.

## What Was Built

Four interconnected modules that replace the `scan()` stub with a production-ready artifact scanner:

**`file-walker.ts`** — File discovery with configurable patterns. Exports `discoverFiles()`, `DEFAULT_PATTERNS` (GStack/GSD/generic), and `DEFAULT_EXCLUDES`. maxDepth defaults to 5. All I/O via injected `ArtifactSource.glob()`.

**`artifact-parser.ts`** — Three exported functions:
- `classifyArtifact()` — path-context-aware classification (GSD path segments checked before GStack filenames, so `.planning/PLAN.md` → `gsd`)
- `parseArtifact()` — remark AST heading outline + gray-matter frontmatter + cross-ref extraction
- `extractCrossRefs()` — unist-util-visit link traversal, filters to known scanned paths, ignores external/anchor/mailto

**`timeline-builder.ts`** — Event assembly and validation:
- `generateEventId()` via djb2 hash — deterministic, stable across rescans, no crypto import
- `buildTimeline()` — merges file + git-tag events, sorts chronologically, computes dateRange from `exact`/`estimated` events only, validates via `TimelineSchema.parse()`

**`scan/index.ts`** (stub replaced) — Orchestrator:
- Discovers files → builds allPaths set → parses each file → resolves dates (git exact, mtime estimated, unknown fallback) → delegates to buildTimeline
- Optional `gitSource?: GitSource | null` parameter — git enrichment is transparent to callers
- Zero narrative concepts in metadata (D-07 compliance)

## Verification

```
pnpm --filter @buildstory/core build   # exits 0
pnpm --filter @buildstory/core test    # 89 tests pass (5 test files)
pnpm lint                              # exits 0
```

Test breakdown:
- file-walker.test.ts: 20 tests
- artifact-parser.test.ts: 36 tests
- timeline-builder.test.ts: 18 tests
- scan.test.ts: 15 tests
- stubs.test.ts: 8 tests (pre-existing, still pass)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `de53eb7` | feat(02-02): file walker and artifact parser modules |
| 2 | `223c17c` | feat(02-02): timeline builder module with deterministic IDs and Zod validation |
| 3 | `1743597` | feat(02-02): scan orchestrator replacing the stub |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Path-context classification order for GSD paths**
- **Found during:** Task 1, GREEN phase
- **Issue:** `classifyArtifact('.planning/phases/01/PLAN.md')` returned `'gstack'` because `PLAN.md` matched the GStack filename set before `.planning/` path segment was checked
- **Fix:** Moved GSD path segment check before GStack filename check — path context is more specific than filename
- **Files modified:** `packages/core/src/scan/artifact-parser.ts`
- **Commit:** `de53eb7`

**2. [Rule 2 - Missing] allPaths filtering in extractCrossRefs**
- **Found during:** Task 1, lint pass
- **Issue:** `allPaths` parameter was unused (ESLint `no-unused-vars` error) — plan spec says to check resolved refs against allPaths
- **Fix:** Added allPaths filter — only include cross-refs that resolve to known scanned files; skip filter when allPaths is empty (avoids silently dropping refs when set is empty)
- **Files modified:** `packages/core/src/scan/artifact-parser.ts`
- **Commit:** `de53eb7`

**3. [Rule 1 - Bug] exactOptionalPropertyTypes strict mode**
- **Found during:** Task 3, build
- **Issue:** `gitSource?: GitSource | null` (undefined | null | GitSource) not assignable to `GitSource | null` with `exactOptionalPropertyTypes: true`
- **Fix:** Pass `gitSource ?? null` to `buildTimeline()` to normalize undefined to null
- **Files modified:** `packages/core/src/scan/index.ts`
- **Commit:** `1743597`

**4. [Rule 2 - Missing] maxDepth extension to ArtifactSource.glob()**
- **Found during:** Task 1, implementation
- **Issue:** `ArtifactSource.glob()` options type only had `cwd` and `ignore` — no `maxDepth` field, but plan required passing it through
- **Fix:** Added `maxDepth?: number` to the glob options interface in `source.ts`
- **Files modified:** `packages/core/src/types/source.ts`
- **Commit:** `de53eb7`

## Known Stubs

None. All scan functionality is fully wired. The `narrate()` and `format()` functions remain stubs but are out of scope for this plan.

## Threat Flags

None. No new network endpoints, auth paths, or trust boundary surfaces introduced. All file I/O remains behind the injected `ArtifactSource` interface. Cross-reference spoofing (T-02-06) is accepted per plan threat register — links are informational metadata only.

## Self-Check: PASSED

All 7 created files exist on disk. All 3 task commits verified in git history (de53eb7, 223c17c, 1743597).
