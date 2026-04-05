---
phase: 01-scaffold
plan: "01"
subsystem: core
tags: [scaffold, monorepo, types, zod, eslint, pnpm, tsup, vitest]
dependency_graph:
  requires: []
  provides:
    - "@buildstory/core ESM package"
    - "pnpm workspace topology"
    - "ESLint boundary rule for core isolation"
    - "TypeScript pipeline contracts: Timeline, StoryArc"
    - "ArtifactSource injection interface"
  affects:
    - "packages/core/src/**"
    - "all subsequent phases consume @buildstory/core"
tech_stack:
  added:
    - typescript@6.0.2
    - tsup@8.5.1
    - vitest@4.1.2
    - eslint@10.2.0
    - typescript-eslint@8.58.0
    - prettier@3.8.1
    - "@changesets/cli@2.30.0"
    - "zod@4.3.6"
    - "@types/node@25.5.2"
  patterns:
    - "ESM-only @buildstory/core with tsup + dts generation"
    - "ArtifactSource interface for fs injection (no direct fs in core)"
    - "Zod v4 schemas as phase boundary contracts"
    - "typescript-eslint flat config with no-restricted-imports boundary"
key_files:
  created:
    - pnpm-workspace.yaml
    - package.json
    - tsconfig.base.json
    - eslint.config.js
    - .prettierrc
    - .gitignore
    - .changeset/config.json
    - packages/core/package.json
    - packages/core/tsconfig.json
    - packages/core/tsup.config.ts
    - packages/core/src/index.ts
    - packages/core/src/types/timeline.ts
    - packages/core/src/types/story.ts
    - packages/core/src/types/source.ts
    - packages/core/src/types/options.ts
    - packages/core/src/scan/index.ts
    - packages/core/src/narrate/index.ts
    - packages/core/src/format/index.ts
    - "packages/core/src/__tests__/stubs.test.ts"
  modified: []
decisions:
  - "Used typescript-eslint unified package instead of separate @typescript-eslint/eslint-plugin + @typescript-eslint/parser (eng review amendment)"
  - "Replaced ScriptSchema with StoryArcSchema + FormatType (eng review amendment)"
  - "Removed render() — created format() stub instead (eng review amendment)"
  - "Added ArtifactSource interface for fs injection — scan() takes it as first param (eng review amendment)"
  - "Added dateConfidence field to TimelineEventSchema (eng review amendment)"
  - "Removed composite:true from packages/core/tsconfig.json — not needed until cross-package references exist (bug fix)"
  - "Added type:module to root package.json to silence ESLint MODULE_TYPELESS_PACKAGE_JSON warning"
metrics:
  duration: "5 minutes"
  completed_date: "2026-04-05"
  tasks_completed: 2
  files_created: 19
  files_modified: 0
---

# Phase 01 Plan 01: Monorepo Scaffold Summary

**One-liner:** pnpm monorepo with @buildstory/core ESM package — Zod-validated StoryArc/Timeline pipeline contracts, ArtifactSource injection, and ESLint boundary rule verified by smoke test.

## What Was Built

A greenfield TypeScript monorepo foundation for BuildStory with:

- **pnpm workspace** with `packages/*` topology recognizing `@buildstory/core`
- **Root configs**: tsconfig.base.json (NodeNext, ES2022, strict), .prettierrc, .gitignore, .changeset/config.json
- **ESLint flat config** with `typescript-eslint` and boundary rule banning fs/path/process/config imports from `packages/core/src/**`
- **@buildstory/core** ESM-only package building to `dist/index.js` + `dist/index.d.ts` via tsup
- **Pipeline type contracts**:
  - `TimelineSchema` / `TimelineEventSchema` (with `dateConfidence` field)
  - `StoryArcSchema` / `StoryBeatSchema` (replaces Script — per eng review)
  - `FormatType` enum (`outline | thread | blog | video-script`)
  - `ArtifactSource` interface (readFile + glob — injected into scan(), never imported from fs)
- **Stub implementations**: scan(), narrate(), format() all return Zod-validated empty typed objects
- **8 Vitest tests** all passing, ESLint boundary rule proven to catch `import from 'fs'`

## Commits

| Hash | Message |
|------|---------|
| 2b5995d | chore(01-01): monorepo scaffold with root configs, core package structure, and ESLint boundary |
| 22c839a | test(01-01): add failing tests for scan/narrate/format stubs and StoryArc schema |
| f62daef | feat(01-01): core types, stubs for scan/narrate/format, and ESLint boundary verified |

## Deviations from Plan

### Plan Amendments Applied (Eng Review)

**1. [Eng Review] Replaced ScriptSchema with StoryArcSchema**
- Created `packages/core/src/types/story.ts` with StoryArc, StoryBeat, BeatType, FormatType
- narrate() now returns StoryArc (beats, metadata) instead of Script (scenes)

**2. [Eng Review] Removed render(), added format()**
- `packages/core/src/format/index.ts` — takes StoryArc + FormatType, returns empty string stub
- No RenderOptions/RenderResult types created

**3. [Eng Review] Added ArtifactSource interface**
- `packages/core/src/types/source.ts` with readFile + glob methods
- scan() signature: `scan(source: ArtifactSource, options: ScanOptions)`

**4. [Eng Review] Added dateConfidence to TimelineEventSchema**
- Field: `z.enum(['exact', 'inferred', 'estimated', 'unknown'])`

**5. [Eng Review] Used typescript-eslint unified package**
- `pnpm add -D -w typescript-eslint` instead of separate `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser`

### Auto-fixed Issues

**6. [Rule 1 - Bug] Fixed z.record() for Zod v4**
- Found during: Task 2 build
- Issue: Zod v4 `z.record()` requires 2 arguments (key + value schema)
- Fix: Changed `z.record(z.unknown())` to `z.record(z.string(), z.unknown())`
- Files: `packages/core/src/types/timeline.ts`
- Commit: f62daef

**7. [Rule 1 - Bug] Removed composite:true from packages/core/tsconfig.json**
- Found during: Task 2 build
- Issue: tsup DTS builder with composite:true created an isolated project that couldn't find subdirectory files
- Fix: Removed composite (not needed until cross-package project references exist)
- Files: `packages/core/tsconfig.json`
- Commit: f62daef

**8. [Rule 2 - Missing] Added argsIgnorePattern to ESLint no-unused-vars**
- Found during: Task 2 lint
- Issue: `_path`, `_patterns`, `_options` (underscore-prefixed intentional params) flagged as errors
- Fix: Added `argsIgnorePattern: '^_'` to `@typescript-eslint/no-unused-vars` rule
- Files: `eslint.config.js`
- Commit: f62daef

**9. [Rule 2 - Missing] Added type:module to root package.json**
- Found during: Task 2 lint
- Issue: ESLint NODE_TYPELESS_PACKAGE_JSON warning — eslint.config.js uses ESM syntax but root has no type declaration
- Fix: Added `"type": "module"` to root `package.json`
- Files: `package.json`
- Commit: f62daef

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| `packages/core/src/scan/index.ts` | Returns empty `events: []` | Real filesystem walk implemented in Phase 02 |
| `packages/core/src/narrate/index.ts` | Returns empty `beats: []` | Real LLM call implemented in narrate phase |
| `packages/core/src/format/index.ts` | Returns `""` | Real format rendering implemented in format phase |

These stubs are intentional — this plan establishes the typed contracts. Future phases fill in the implementations.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| No new threats | — | No network endpoints, auth paths, or file access patterns introduced. ArtifactSource pattern ensures core never accesses fs directly. ESLint boundary rule enforced by smoke test. |

## Self-Check: PASSED

- [x] `packages/core/dist/index.js` exists
- [x] `packages/core/dist/index.d.ts` exists
- [x] Commit 2b5995d exists (scaffold)
- [x] Commit 22c839a exists (RED tests)
- [x] Commit f62daef exists (GREEN implementation)
- [x] `pnpm install --frozen-lockfile` succeeds
- [x] `pnpm --filter @buildstory/core build` succeeds
- [x] `pnpm --filter @buildstory/core test` — 8/8 tests pass
- [x] `pnpm lint` — 0 errors
- [x] ESLint catches `import from 'fs'` in core
