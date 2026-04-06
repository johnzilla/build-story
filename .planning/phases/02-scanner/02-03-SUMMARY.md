---
phase: 02-scanner
plan: "03"
subsystem: cli
tags: [cli, adapters, scan-command, redaction, git-integration]
dependency_graph:
  requires: [02-02]
  provides: [buildstory-scan-command, cli-adapters]
  affects: [packages/cli]
tech_stack:
  added: [fast-glob, simple-git]
  patterns: [adapter-pattern, tdd, secret-redaction]
key_files:
  created:
    - packages/cli/src/adapters/redact.ts
    - packages/cli/src/adapters/fs-source.ts
    - packages/cli/src/adapters/git-source.ts
    - packages/cli/src/commands/scan.ts
    - packages/cli/src/__tests__/redact.test.ts
    - packages/cli/src/__tests__/scan-command.test.ts
  modified:
    - packages/cli/src/commands/run.ts
    - packages/cli/src/index.ts
decisions:
  - "Secret redaction applied at ArtifactSource.readFile boundary (D-09) — single enforcement point prevents secrets from ever entering the pipeline"
  - "Anthropic sk-ant- pattern ordered before generic sk- in SECRET_PATTERNS for clarity (both produce [REDACTED] regardless of order)"
  - "createGitSource returns null when not in a git repo — scan proceeds with mtime fallback for dateConfidence"
  - "scan-command integration test uses real filesystem with temp directory (no mocks) to verify end-to-end pipeline"
metrics:
  completed: "2026-04-06"
  tasks_completed: 2
  tasks_total: 3
  files_created: 6
  files_modified: 2
---

# Phase 02 Plan 03: CLI Adapters and Scan Command Summary

## One-liner

CLI adapters wiring real ArtifactSource (fast-glob + fs redaction) and GitSource (simple-git with bounded queries) to `buildstory scan` command with secret redaction at the file-read boundary.

## What Was Built

### Task 1: Secret redaction module and CLI adapters (f8f261a)

**`packages/cli/src/adapters/redact.ts`**
- `SECRET_PATTERNS`: array of 9 regex patterns covering OpenAI (sk-), Anthropic (sk-ant-), AWS (AKIA), GitHub PAT (ghp_), Bearer tokens, Basic auth, generic env var assignments (api_key=, secret=, token=, password=)
- `redactSecrets(content)`: applies all patterns sequentially, replaces matches with `[REDACTED]`
- Anthropic `sk-ant-` pattern ordered before generic `sk-` for specificity

**`packages/cli/src/adapters/fs-source.ts`**
- `createFsSource(rootDir)`: returns `ArtifactSource` implementation
- `readFile`: resolves path relative to rootDir, reads with fs/promises, applies `redactSecrets` — single redaction enforcement point (D-09)
- `glob`: uses fast-glob with `dot: true` (critical for `.planning/`, `.gstack/`, `.claude/` discovery), configurable `deep` depth, `onlyFiles: true`, `followSymbolicLinks: false`
- `resolveRef`: resolves relative file references using path module
- `getMtime`: stat-based file modification time with null fallback

**`packages/cli/src/adapters/git-source.ts`**
- `createGitSource(rootDir)`: async factory returning `GitSource | null`
- Uses `git.revparse(['--is-inside-work-tree'])` to check git availability before constructing source — returns null gracefully when not in a git repo
- `getFileDate`: `git.log({ file, maxCount: 1 })` — bounded query prevents unbounded git log (T-02-10 mitigation)
- `getTags`: uses `git raw` with `--format` for structured tag output
- `maxConcurrentProcesses: 4` limits parallel git spawns

### Task 2: Scan command and updated run command (4b7a1fd)

**`packages/cli/src/commands/scan.ts`**
- `scanCommand(paths, opts)`: resolves rootDir, loads config, creates real adapters, calls `core.scan()`, writes JSON to stdout or `--output` file
- Spinner feedback for git detection and artifact scanning progress
- Reports event count on completion

**`packages/cli/src/commands/run.ts`** (updated)
- Removed inline `createFsSource()` stub
- Imports `createFsSource` and `createGitSource` from adapters
- Passes gitSource as third argument to `scan()`

**`packages/cli/src/index.ts`** (updated)
- Registered `buildstory scan [paths...]` Commander subcommand with `-o/--output` and `-c/--config` options

**`packages/cli/src/__tests__/scan-command.test.ts`**
- Integration tests using real temp directory filesystem
- Verifies valid Timeline JSON with Zod schema validation
- Confirms output file is written correctly
- Checks events have artifactType, summary, rawContent fields
- Tests without git (dateConfidence is estimated/unknown via mtime)

## Test Results

- 89 core tests passing
- 24 CLI tests passing (10 redact + 5 scan-command integration + 9 existing)
- All lint checks pass
- Build succeeds across workspace

## Threat Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-02-07: Information Disclosure via readFile | `redactSecrets()` applied to every file read in `fs-source.ts` before content reaches core |
| T-02-08: Secrets in timeline.json | Pre-redacted at source — no secrets reach Timeline JSON |
| T-02-09: DoS via fast-glob | `DEFAULT_EXCLUDES` in core file-walker + `maxDepth: 5` default in fs-source |
| T-02-10: DoS via simple-git log | `maxCount: 1` per file query + `maxConcurrentProcesses: 4` + try/catch on all git calls |
| T-02-12: Command injection via simple-git | Structured arguments passed to git.log({ file }) — no shell interpolation |

## Checkpoint Reached

**Task 3 (human-verify)** requires human verification of:
1. `buildstory scan .planning/` producing real timeline.json from BuildStory planning artifacts
2. Inspecting events for rawContent, summary, artifactType fields
3. Confirming no API keys appear in rawContent
4. Testing scan without git on a non-git directory

### Verification Commands

```bash
# Build the project
cd /home/john/vault/projects/github.com/build-story && pnpm build

# Scan BuildStory's own planning artifacts (dogfood test)
node packages/cli/dist/index.js scan .planning/ --output /tmp/timeline.json

# Inspect output
cat /tmp/timeline.json | head -100

# Test without git
mkdir /tmp/test-scan && echo "# Test" > /tmp/test-scan/README.md
node packages/cli/dist/index.js scan /tmp/test-scan/

# Run full test suite
pnpm test
```

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- packages/cli/src/adapters/redact.ts: EXISTS
- packages/cli/src/adapters/fs-source.ts: EXISTS
- packages/cli/src/adapters/git-source.ts: EXISTS
- packages/cli/src/commands/scan.ts: EXISTS
- packages/cli/src/__tests__/redact.test.ts: EXISTS
- packages/cli/src/__tests__/scan-command.test.ts: EXISTS
- Commit f8f261a: EXISTS (feat(02-03): CLI adapters)
- Commit 4b7a1fd: EXISTS (feat(02-03): scan command)

## Self-Check: PASSED
