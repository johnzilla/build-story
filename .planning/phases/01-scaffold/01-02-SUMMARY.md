---
phase: 01-scaffold
plan: 02
subsystem: cli
tags: [commander, smol-toml, ora, chalk, vitest, buildstory-cli]

# Dependency graph
requires:
  - phase: 01-01
    provides: "@buildstory/core scan/narrate/format stubs, Timeline/StoryArc types, ArtifactSource interface"
provides:
  - "buildstory CLI package (packages/cli) with Commander entry point and bin field"
  - "TOML config loader with deep merge for global and project configs"
  - "buildstory run command wiring scan->narrate->format pipeline"
  - "Integration tests for config loader and pipeline end-to-end"
affects: [02-scan, 03-narrate, 04-format, any phase adding CLI commands]

# Tech tracking
tech-stack:
  added: [commander@14.0.3, smol-toml@1.6.1, ora@9.3.0, chalk@5.6.2]
  patterns:
    - "ArtifactSource injected from CLI layer — core has zero fs knowledge"
    - "API key selection by provider (anthropic vs openai), never from config file"
    - "TOML config deep merge: { ...globalConfig.scan, ...projectConfig.scan }"
    - "tsup banner injects shebang — no separate chmod step in source"

key-files:
  created:
    - packages/cli/package.json
    - packages/cli/tsconfig.json
    - packages/cli/tsup.config.ts
    - packages/cli/src/index.ts
    - packages/cli/src/config.ts
    - packages/cli/src/commands/run.ts
    - packages/cli/src/__tests__/config.test.ts
    - packages/cli/src/__tests__/run.test.ts
  modified:
    - package.json (root build script extended to include CLI package)

key-decisions:
  - "Eng review: remove render() from pipeline — use format() returning strings instead"
  - "Eng review: scan() takes (ArtifactSource, ScanOptions) — CLI provides minimal fs adapter"
  - "Eng review: API key selected by provider field, not first-found env var"
  - "Eng review: pin ora/chalk to specific caret ranges (^9.3.0, ^5.6.2) not 'latest'"
  - "vi.mock('os') at module level with vi.fn() to enable per-test homedir override"

patterns-established:
  - "CLI creates ArtifactSource adapter; core receives interface — boundary enforced"
  - "loadConfig() reads global (~/.config/buildstory) then project (./buildstory.toml), deep-merges scan sub-object"
  - "run command: const provider = config.provider ?? opts.provider — config takes precedence over CLI flags"

requirements-completed: [INFRA-03, INFRA-04, INFRA-06]

# Metrics
duration: 18min
completed: 2026-04-05
---

# Phase 01 Plan 02: CLI Package Summary

**Commander CLI with TOML config deep-merge, chalk/ora pipeline output, and scan->narrate->format wiring through @buildstory/core stubs**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-05T16:20:00Z
- **Completed:** 2026-04-05T16:39:30Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- `buildstory run` command executes full scan->narrate->format pipeline with ora spinners and chalk-colored success messages
- TOML config loader deep-merges global (~/.config/buildstory/config.toml) and project (buildstory.toml) configs, preserving nested scan fields
- Minimal fs-based ArtifactSource created in CLI — core has zero filesystem knowledge
- 9 CLI tests: 5 config loader tests (including global+project deep merge with mocked homedir) + 4 pipeline integration tests

## Task Commits

Each task was committed atomically:

1. **Task 1: CLI package with Commander, config loader, and run command** - `f3d5e6e` (feat)
2. **Task 2: Integration tests for config loader and pipeline** - `ee730f4` (test)

## Files Created/Modified
- `packages/cli/package.json` - ESM package with bin field, pinned ora/chalk versions
- `packages/cli/tsconfig.json` - Extends base, composite:true, references core
- `packages/cli/tsup.config.ts` - ESM build with shebang banner
- `packages/cli/src/index.ts` - Commander entry point with `run` subcommand
- `packages/cli/src/config.ts` - TOML loader with homedir() global path, deep merge for scan sub-object
- `packages/cli/src/commands/run.ts` - Pipeline wiring: scan->narrate->format, provider-based API key selection
- `packages/cli/src/__tests__/config.test.ts` - 5 loadConfig tests with vi.mock('os') for homedir
- `packages/cli/src/__tests__/run.test.ts` - 4 pipeline integration tests using @buildstory/core directly
- `package.json` - Root build script extended to build CLI after core

## Decisions Made
- Applied all eng review amendments: removed `render()`, wired `format()` for all 4 format types, added minimal fs ArtifactSource
- Used `vi.mock('os')` at module level with `vi.fn()` to allow per-test `homedir()` override — inline vi.mock inside describe causes hoisting failures
- Pinned `ora@^9.3.0` and `chalk@^5.6.2` (current npm versions as of 2026-04-05)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced render() with format() throughout**
- **Found during:** Task 1 (run command implementation)
- **Issue:** Plan referenced `render()` from `@buildstory/core` but core exports `format()` — no `render()` exists. Eng review amendment explicitly required this fix.
- **Fix:** Pipeline changed to scan->narrate->format; all four FormatType values formatted; result is `Record<string, string>` of outputs
- **Files modified:** packages/cli/src/commands/run.ts
- **Committed in:** f3d5e6e (Task 1 commit)

**2. [Rule 1 - Bug] Fixed vi.mock hoisting causing ReferenceError in config tests**
- **Found during:** Task 2 (config tests)
- **Issue:** `vi.mock('os')` inside `describe()` block is hoisted before `beforeEach`, making `tmpDir` undefined at mock factory execution time
- **Fix:** Moved `vi.mock('os')` to module level with `vi.fn()` factory; used `vi.mocked(os.homedir).mockReturnValue()` per test
- **Files modified:** packages/cli/src/__tests__/config.test.ts
- **Committed in:** ee730f4 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug/eng-amendment, 1 bug/test-hoisting)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- None beyond the two auto-fixed deviations above.

## Known Stubs
- `packages/cli/src/commands/run.ts` `createFsSource().glob()` always returns `[]` — Phase 1 acceptable since `scan()` ignores source. Will be wired in scan phase.
- `format(arc, ft)` returns `''` for all types (core stub) — wired in format phase.
- `narrate(timeline, options)` returns empty StoryArc (core stub) — wired in narrate phase.

## User Setup Required
None - no external service configuration required for Phase 1.

## Next Phase Readiness
- Phase 1 complete: monorepo scaffold + CLI wrapper both build and test cleanly
- `pnpm build`, `pnpm test`, `pnpm lint` all pass across workspace
- Phase 2 (scan) can implement real ArtifactSource fs adapter and wire into CLI
- Phase 3 (narrate) can implement LLM provider calls — CLI already reads ANTHROPIC_API_KEY/OPENAI_API_KEY
- The `run` command is the integration point; future phases implement the core functions it calls

---
*Phase: 01-scaffold*
*Completed: 2026-04-05*

## Self-Check: PASSED

- packages/cli/package.json: FOUND
- packages/cli/src/index.ts: FOUND
- packages/cli/src/config.ts: FOUND
- packages/cli/src/commands/run.ts: FOUND
- packages/cli/src/__tests__/config.test.ts: FOUND
- packages/cli/src/__tests__/run.test.ts: FOUND
- packages/cli/dist/index.js: FOUND
- .planning/phases/01-scaffold/01-02-SUMMARY.md: FOUND
- Commit f3d5e6e (Task 1): FOUND
- Commit ee730f4 (Task 2): FOUND
