---
phase: 02-scanner
plan: 01
subsystem: api
tags: [typescript, zod, remark, gray-matter, simple-git, fast-glob, unified]

# Dependency graph
requires:
  - phase: 01-scaffold
    provides: "TypeScript monorepo with @buildstory/core and buildstory CLI packages, TimelineEventSchema, ArtifactSource interface"
provides:
  - Extended TimelineEventSchema with rawContent, artifactType, and crossRefs fields
  - New GitSource interface (getFileDate, getTags) for git metadata injection
  - Extended ArtifactSource interface with optional resolveRef and getMtime methods
  - GitSource type exported from @buildstory/core barrel
  - remark ecosystem installed in @buildstory/core (remark, remark-parse, remark-frontmatter, unified, gray-matter, unist-util-visit)
  - simple-git and fast-glob installed in buildstory CLI
affects: [02-02, 02-03, scanner-implementation, narrate-phase]

# Tech tracking
tech-stack:
  added:
    - remark@15.0.1 (markdown AST processing in core)
    - remark-parse@11.0.0 (unified pipeline entry point)
    - remark-frontmatter@5.0.0 (YAML/TOML frontmatter in markdown)
    - unified@11.0.5 (unified ecosystem processor)
    - gray-matter@4.0.3 (frontmatter extraction)
    - unist-util-visit@5.1.0 (AST traversal for cross-reference extraction)
    - simple-git@3.33.0 (git history in CLI)
    - fast-glob@3.3.3 (pattern-based file discovery in CLI)
  patterns:
    - "Core defines interfaces (GitSource, ArtifactSource), CLI provides implementations — boundary enforced by ESLint"
    - "Optional interface methods (resolveRef, getMtime) allow progressive enhancement without breaking existing consumers"
    - "rawContent as required string on TimelineEvent — full content captured at scan time, redaction is ArtifactSource responsibility"

key-files:
  created:
    - packages/core/src/types/git-source.ts
  modified:
    - packages/core/src/types/timeline.ts
    - packages/core/src/types/source.ts
    - packages/core/src/index.ts
    - packages/core/src/__tests__/stubs.test.ts
    - packages/core/package.json
    - packages/cli/package.json
    - pnpm-lock.yaml

key-decisions:
  - "rawContent is required (not optional) on TimelineEvent — scanner always has file contents at scan time; optional would create runtime gaps"
  - "GitSource placed in core types (not CLI) so implementations can be injected — core defines contract, CLI holds simple-git"
  - "resolveRef and getMtime are optional on ArtifactSource — avoids breaking existing FsSource in run.ts"
  - "unist-util-visit added proactively — needed for cross-reference link extraction in subsequent plan"

patterns-established:
  - "Interface-only files in core/types/ never import node_modules — pure TypeScript contracts"
  - "Scanner dependencies split by boundary: parsing in core, filesystem/git in CLI"

requirements-completed: [SCAN-10, SCAN-11]

# Metrics
duration: 12min
completed: 2026-04-05
---

# Phase 02 Plan 01: Type Contracts and Scanner Dependencies Summary

**Extended TimelineEventSchema with rawContent/artifactType/crossRefs, created GitSource interface, and installed remark+simple-git ecosystems across correct package boundaries**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-05T20:17:00Z
- **Completed:** 2026-04-05T20:29:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Extended `TimelineEventSchema` with three new fields: `rawContent` (required string), `artifactType` (optional enum), `crossRefs` (optional string array)
- Created `GitSource` interface at `packages/core/src/types/git-source.ts` with `getFileDate` and `getTags` — pure interface, no simple-git import
- Extended `ArtifactSource` with optional `resolveRef` and `getMtime` methods without breaking existing consumers
- Installed remark ecosystem (6 packages) in `@buildstory/core` and simple-git + fast-glob in `buildstory` CLI — all at correct package boundaries
- All 17 existing tests (8 core + 9 CLI) pass after schema evolution

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend type contracts for scanner phase** - `9e12add` (feat)
2. **Task 2: Install scanner dependencies in core and CLI packages** - `d6d1b1d` (chore)

## Files Created/Modified

- `packages/core/src/types/git-source.ts` - New GitSource interface (getFileDate, getTags)
- `packages/core/src/types/timeline.ts` - TimelineEventSchema extended with rawContent, artifactType, crossRefs
- `packages/core/src/types/source.ts` - ArtifactSource extended with optional resolveRef, getMtime
- `packages/core/src/index.ts` - GitSource type added to barrel exports
- `packages/core/src/__tests__/stubs.test.ts` - Test fixture updated with required rawContent field
- `packages/core/package.json` - remark, remark-parse, remark-frontmatter, unified, gray-matter, unist-util-visit added
- `packages/cli/package.json` - simple-git, fast-glob added
- `pnpm-lock.yaml` - Lockfile updated

## Decisions Made

- `rawContent` is required (not optional) on `TimelineEvent` — scanner always has file contents at scan time; making it optional would create runtime gaps downstream
- `GitSource` placed in core types so implementations can be injected — core defines contract, CLI holds the simple-git implementation
- `resolveRef` and `getMtime` are optional (`?`) on `ArtifactSource` — preserves backward compatibility with existing `FsSource` in run.ts
- `unist-util-visit` added proactively alongside the remark stack — needed for AST traversal in cross-reference extraction (Plan 02-02)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None — no UI or data rendering in this plan.

## Next Phase Readiness

- All type contracts ready for Plan 02-02 (markdown parser) and 02-03 (git integration)
- GitSource interface ready for simple-git implementation in CLI
- remark ecosystem installed and available for `parseMarkdown()` implementation
- No blockers

---
*Phase: 02-scanner*
*Completed: 2026-04-05*
