---
phase: 01-scaffold
verified: 2026-04-05T16:44:00Z
status: passed
score: 4/4 roadmap success criteria verified
gaps: []
deferred: []
human_verification: []
---

# Phase 1: Scaffold Verification Report

**Phase Goal:** The monorepo is set up with enforced boundaries so all subsequent phases build on a safe, consistent foundation
**Verified:** 2026-04-05T16:44:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `pnpm install` succeeds and `@buildstory/core` and `buildstory` CLI packages are independently buildable | VERIFIED | `pnpm install --frozen-lockfile` exits 0 in 436ms; `pnpm --filter @buildstory/core build` produces `dist/index.js` + `dist/index.d.ts`; `pnpm --filter buildstory build` produces `dist/index.js` with shebang |
| 2 | `buildstory run` executes without error and returns empty/stub results (pipeline wired end-to-end) | VERIFIED | `node packages/cli/dist/index.js run .` produces "Scan complete / Narration complete / Format complete" with chalk-colored output; exits 0 |
| 3 | ESLint reports an error if any file in `packages/core/src/` imports `fs`, `process.env`, or config libraries | VERIFIED | Three smoke tests confirmed: `import from 'fs'` fires `no-restricted-imports`; `process.env` access fires `no-restricted-globals`; `import from 'smol-toml'` fires `no-restricted-imports` |
| 4 | `buildstory.toml` is loaded by the CLI and surfaced as typed options passed to core functions | VERIFIED | `loadConfig()` parses project and global TOML, deep-merges scan sub-object, passes typed `BuildStoryConfig` to pipeline; 9 CLI tests pass including full global+project deep merge test with mocked homedir |

**Score: 4/4 roadmap success criteria verified**

---

### Plan must_haves coverage (01-01 + 01-02)

#### Plan 01-01 truths

| Truth | Status | Notes |
|-------|--------|-------|
| pnpm install succeeds with two workspace packages recognized | VERIFIED | 3 workspace projects (root, core, cli) recognized |
| @buildstory/core builds to ESM with .d.ts declarations | VERIFIED | `dist/index.js` (ESM, 2.08 KB) + `dist/index.d.ts` (4.10 KB) produced by tsup |
| ESLint errors when core imports fs, process, or config libraries | VERIFIED | All three boundary cases confirmed by smoke tests |
| scan(), narrate(), render() are exported from @buildstory/core with correct types | VERIFIED WITH AMENDMENT | Eng review replaced `render()` with `format()`. Exports are: `scan`, `narrate`, `format`, plus all schemas and types. The amendment is explicitly documented in 01-01-SUMMARY.md and approved. |
| Stub functions return Zod-validated typed empty objects | VERIFIED | 8 core tests pass including `TimelineSchema.parse()` and `StoryArcSchema.parse()` on stub returns |

#### Plan 01-02 truths

| Truth | Status | Notes |
|-------|--------|-------|
| buildstory run executes without error and returns stub results | VERIFIED | Pipeline completes in all tested configurations |
| buildstory.toml is loaded by the CLI and parsed into typed options | VERIFIED | `loadConfig()` wired into `run.ts`; config.test.ts has 5 passing tests |
| Global config at ~/.config/buildstory/config.toml merges with project config | VERIFIED | 5th config test uses mocked homedir to prove global+project merge with both fields preserved |
| Nested config objects (scan) are deep-merged so partial project overrides preserve global defaults | VERIFIED | `scan: { ...globalConfig.scan, ...projectConfig.scan }` in config.ts; test proves `patterns` from global + `maxDepth` from project both present |
| Pipeline runs sequentially: scan -> narrate -> render | VERIFIED WITH AMENDMENT | Eng review replaced `render` with `format`. Sequential `await` chain: scan -> narrate -> format. Functionally identical intent met. |
| CLI binary is executable via node packages/cli/dist/index.js | VERIFIED | `chmod +x dist/index.js` in build script; shebang injected by tsup banner |
| chalk is used for colored status messages in spinner output | VERIFIED | `chalk.green()` wraps all spinner `.succeed()` messages in `run.ts` |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pnpm-workspace.yaml` | Workspace package discovery | VERIFIED | Contains `packages/*` |
| `packages/core/package.json` | Core package definition | VERIFIED | `"type": "module"`, `"name": "@buildstory/core"`, bin-less |
| `packages/core/src/index.ts` | Public API barrel | VERIFIED | Exports `scan`, `narrate`, `format`, all schemas and types; .js extensions per NodeNext |
| `packages/core/src/types/timeline.ts` | Timeline type + Zod schema | VERIFIED | `TimelineSchema`, `TimelineEventSchema` with `dateConfidence` field (eng amendment) |
| `packages/core/src/types/story.ts` | StoryArc type + Zod schema | VERIFIED | Replaces ScriptSchema per eng review; `StoryArcSchema`, `StoryBeatSchema`, `FormatTypeSchema` |
| `packages/core/src/types/source.ts` | ArtifactSource injection interface | VERIFIED | `readFile` + `glob` methods; prevents direct fs in core |
| `packages/core/src/types/options.ts` | ScanOptions, NarrateOptions | VERIFIED | Both interfaces present; `RenderOptions`/`RenderResult` removed per eng amendment |
| `packages/core/src/scan/index.ts` | scan() stub | VERIFIED | Takes `(ArtifactSource, ScanOptions)`, returns empty Timeline with correct shape |
| `packages/core/src/narrate/index.ts` | narrate() stub | VERIFIED | Returns empty StoryArc with correct shape |
| `packages/core/src/format/index.ts` | format() stub | VERIFIED | Replaces render() per eng review; returns `''` |
| `eslint.config.js` | ESLint boundary enforcement | VERIFIED | `no-restricted-imports` bans fs/path/process/smol-toml in core; `no-restricted-globals` bans process |
| `packages/cli/package.json` | CLI package with bin field | VERIFIED | `"bin": { "buildstory": "./dist/index.js" }`, all deps present |
| `packages/cli/src/index.ts` | Commander entry point | VERIFIED | `program.command('run [paths...]')` wired to `.action(run)` |
| `packages/cli/src/config.ts` | TOML config loader with deep merge | VERIFIED | `parse` from `smol-toml`, `homedir()` for global path, `scan: { ...globalConfig.scan, ...projectConfig.scan }` |
| `packages/cli/src/commands/run.ts` | Pipeline wiring with chalk | VERIFIED | `scan -> narrate -> format`, `chalk.green()` on all success messages, `ora` spinners, `createFsSource()` ArtifactSource adapter |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/core/src/index.ts` | `packages/core/src/scan/index.ts` | ESM re-export with .js extension | VERIFIED | `export { scan } from './scan/index.js'` |
| `packages/core/src/index.ts` | `packages/core/src/narrate/index.ts` | ESM re-export with .js extension | VERIFIED | `export { narrate } from './narrate/index.js'` |
| `packages/core/src/index.ts` | `packages/core/src/format/index.ts` | ESM re-export with .js extension | VERIFIED | `export { format } from './format/index.js'` |
| `packages/core/src/scan/index.ts` | `packages/core/src/types/timeline.ts` | type import | VERIFIED | `import type { Timeline } from '../types/timeline.js'` |
| `packages/cli/src/commands/run.ts` | `@buildstory/core` | import { scan, narrate, format } | VERIFIED | `import { scan, narrate, format } from '@buildstory/core'` |
| `packages/cli/src/commands/run.ts` | `chalk` | import chalk from 'chalk' | VERIFIED | `import chalk from 'chalk'`; `chalk.green()` used on all success messages |
| `packages/cli/src/commands/run.ts` | `packages/cli/src/config.ts` | import { loadConfig } | VERIFIED | `import { loadConfig } from '../config.js'` |
| `packages/cli/src/index.ts` | `packages/cli/src/commands/run.ts` | commander .action(run) | VERIFIED | `.action(run)` on `program.command('run [paths...]')` |
| `packages/cli/src/config.ts` | `BuildStoryConfig.scan` deep merge | `{ ...globalConfig.scan, ...projectConfig.scan }` | VERIFIED | Pattern present in config.ts line 49; 5th config test exercises global+project merge |

---

### Data-Flow Trace (Level 4)

Not applicable. All pipeline functions are intentional stubs returning typed empty objects. Data flow is deferred to Phases 2, 3, and 4. The CLI-to-core wiring is the correct Level 4 check here — config values from `buildstory.toml` flow into `scan()`, `narrate()`, and `format()` call sites (verified by running with a real `buildstory.toml`).

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| pnpm install completes | `pnpm install --frozen-lockfile` | Exit 0, 436ms | PASS |
| @buildstory/core builds | `pnpm --filter @buildstory/core build` | dist/index.js + dist/index.d.ts produced | PASS |
| buildstory CLI builds | `pnpm --filter buildstory build` | dist/index.js with shebang produced | PASS |
| buildstory run executes | `node packages/cli/dist/index.js run .` | "Scan complete / Narration complete / Format complete" | PASS |
| All tests pass | `pnpm test` | 17/17 tests pass (8 core, 9 cli) | PASS |
| ESLint clean | `pnpm lint` | 0 errors, 0 warnings | PASS |
| ESLint boundary: fs ban | inject `import { readFileSync } from 'fs'` in core | `no-restricted-imports` error fired | PASS |
| ESLint boundary: process ban | inject `process.env.API_KEY` in core | `no-restricted-globals` error fired | PASS |
| ESLint boundary: config lib ban | inject `import { parse } from 'smol-toml'` in core | `no-restricted-imports` error fired | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INFRA-01 | 01-01 | Monorepo scaffold with pnpm workspaces | SATISFIED | pnpm-workspace.yaml, two packages, `pnpm ls -r` shows 3 projects |
| INFRA-02 | 01-01 | `@buildstory/core` typed public API with zero CLI/config imports | SATISFIED WITH AMENDMENT | `scan()`, `narrate()`, `format()` exported (render() replaced by format() per eng review). No fs/path/process/config imports in core — verified by ESLint boundary and smoke tests. |
| INFRA-03 | 01-02 | CLI wrapper parses args and loads `buildstory.toml`, delegates to core | SATISFIED | Commander entry, `loadConfig()` with smol-toml, delegates scan/narrate/format to @buildstory/core |
| INFRA-04 | 01-02 | `buildstory.toml` project-level + `~/.config/buildstory/config.toml` global defaults | SATISFIED | `loadConfig()` checks both paths, deep-merges scan sub-object, 5-test suite passes including global+project merge |
| INFRA-05 | 01-01 | ESLint boundary rule preventing core from importing CLI/config concerns | SATISFIED | `eslint.config.js` with `no-restricted-imports` (fs, path, process, smol-toml) and `no-restricted-globals` (process); boundary enforced and smoke-tested |
| INFRA-06 | 01-02 | `buildstory run` executes full pipeline | SATISFIED WITH AMENDMENT | `buildstory run` executes scan -> narrate -> format (render() removed per eng review; format() is the Phase 1 output stage) |

**Note on REQUIREMENTS.md staleness:** INFRA-02 and INFRA-06 reference `render()` in their requirement text. The eng review amendment (documented in 01-01-SUMMARY.md decisions section) removed `render()` and replaced it with `format()`. The intent of both requirements is fully satisfied by the amended implementation. REQUIREMENTS.md should be updated to reflect the `render()` → `format()` substitution, but this is a documentation cleanup, not a code gap.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `packages/core/src/scan/index.ts` | Returns `events: []` | Info | Intentional stub — Phase 2 fills in real filesystem walk |
| `packages/core/src/narrate/index.ts` | Returns `beats: []` | Info | Intentional stub — Phase 3 fills in real LLM call |
| `packages/core/src/format/index.ts` | Returns `''` | Info | Intentional stub — Phase 4 fills in real format rendering |
| `packages/cli/src/commands/run.ts` | `createFsSource().glob()` returns `[]` | Info | Intentional — scan() ignores source in Phase 1; Phase 2 wires real glob |

No blockers. All stubs are typed correctly, pass Zod schema validation, and are documented as known stubs in both SUMMARYs. These are the defined deliverable for a scaffold phase — typed contracts with empty implementations.

**Additional notes:**
- 01-01-SUMMARY references commit hashes 2b5995d / 22c839a / f62daef; actual git hashes are 5f3dbc4 / 829c66c / 84768fe. The commit messages and content match exactly. Hashes differ from a likely rebase or reset. Documentation discrepancy only — does not affect code.
- Root `package.json` has `"type": "module"` (added by executor to resolve ESLint MODULE_TYPELESS_PACKAGE_JSON warning). This deviates from Plan 01-01's task spec which said NOT to add `"type": "module"` to root, but the executor documented it as a bug fix. The root package has no source files so this is safe.

### Human Verification Required

None. All success criteria verified programmatically.

---

## Gaps Summary

No gaps found. All four ROADMAP success criteria are verified. All six INFRA requirements are satisfied (INFRA-02 and INFRA-06 with the eng-review-approved `render()` → `format()` amendment). The monorepo foundation is solid for Phase 2 to build on.

---

_Verified: 2026-04-05T16:44:00Z_
_Verifier: Claude (gsd-verifier)_
