---
phase: 02-scanner
verified: 2026-04-06T01:17:48Z
status: gaps_found
score: 3/5 roadmap success criteria verified
gaps:
  - truth: "Git commits, tags, and branch/merge events appear in the timeline merged with document events by date"
    status: partial
    reason: "Git tags create separate events (verified working with test repo). Git commit dates enrich file events (dateConfidence='exact'). However: commit messages do not appear as separate timeline events (D-05 decision made commits date-only enrichment), and branch/merge events are not implemented (D-04 explicitly deferred this). SCAN-06 full scope requires commit messages with timestamps, git blame, branch/merge events, and tags — only tags and commit-date enrichment are implemented."
    artifacts:
      - path: "packages/core/src/scan/timeline-builder.ts"
        issue: "buildTimeline() fetches getTags() but no getTags-equivalent for commit messages as separate events"
      - path: "packages/cli/src/adapters/git-source.ts"
        issue: "GitSource interface only exposes getFileDate and getTags — no getCommits() for commit message events, no getBranchMergeEvents()"
    missing:
      - "Separate git-commit events with commit messages and timestamps in timeline (or documented deferral to a later phase)"
      - "Branch/merge event detection (or confirmed deferral to a later milestone)"
      - "SCAN-06 scope either implemented or explicitly deferred to a named later phase in ROADMAP.md"
  - truth: "GStack artifacts (PLANNING.md, ROADMAP.md, DECISIONS.md, etc.) and GSD artifacts (TASKS.md, SESSION_LOG.md, etc.) appear as distinct typed events in the timeline"
    status: partial
    reason: "GStack canonical filenames (ROADMAP.md, REQUIREMENTS.md, DECISIONS.md) are classified as 'gsd' when they live under .planning/ because path-context classification runs before filename classification. In the project's own .planning/ scan, 0 events were classified 'gstack' — all 26 non-README events are 'gsd'. Only files at the repo root (e.g. README.md as generic) escape the .planning/ path override. Files named ROADMAP.md at root are correctly classified gstack (verified), but the common case for GStack planning files stored in .planning/ produces incorrect type labels."
    artifacts:
      - path: "packages/core/src/scan/artifact-parser.ts"
        issue: "Lines 33-37: GSD_PATH_SEGMENTS check (.planning/) fires before GSTACK_FILENAMES check, so .planning/ROADMAP.md → 'gsd' instead of 'gstack'. The plan's deviation note documents this as intentional but it contradicts SC-2."
    missing:
      - "Either document that GStack files in .planning/ are intentionally typed 'gsd' and update roadmap SC-2 to reflect this, OR adjust classification so canonical GStack filenames override the path segment rule when both match"
---

# Phase 2: Scanner Verification Report

**Phase Goal:** Users can scan a directory of planning artifacts and produce a structured Timeline JSON capturing the full decision arc
**Verified:** 2026-04-06T01:17:48Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | `buildstory scan <path>` produces a valid `timeline.json` with chronologically ordered events and stable event IDs | ✓ VERIFIED | CLI ran against project root: 27 events, chronologically sorted (confirmed), stable IDs across two rescans (confirmed), Zod validation passes in scan-command.test.ts |
| 2 | GStack artifacts (PLANNING.md, ROADMAP.md, etc.) and GSD artifacts (TASKS.md, SESSION_LOG.md, etc.) appear as distinct typed events | ✗ PARTIAL | 0 events classified 'gstack' in project scan — all .planning/*.md files (including ROADMAP.md, REQUIREMENTS.md) show as 'gsd' due to path-context-first classification. GStack files at repo root classify correctly. |
| 3 | Git commits, tags, and branch/merge events appear in the timeline merged with document events by date | ✗ PARTIAL | Git tags: VERIFIED (test with tagged repo shows git-tag events). Git commit dates: VERIFIED (enrich file events, dateConfidence='exact'). Commit message events: NOT IMPLEMENTED (D-05 decided commits don't create events). Branch/merge events: NOT IMPLEMENTED (D-04 explicitly deferred). |
| 4 | Cross-references between artifacts are detected and represented in the timeline event graph | ✓ VERIFIED | extractCrossRefs via unist-util-visit works correctly — test with ROADMAP.md linking DECISIONS.md shows crossRefs populated. Zero cross-refs in project scan because planning files use @context syntax not markdown links. |
| 5 | Custom artifact include/exclude patterns in `buildstory.toml` or ScanOptions are respected by the walker | ✓ VERIFIED | scan command passes config.scan?.patterns/excludes/maxDepth to scan(). file-walker uses options.patterns ?? DEFAULT_PATTERNS and merges excludes. Code path verified. |

**Score:** 3/5 roadmap success criteria fully verified

### Deferred Items

No items were found to be deferred to later phases. The branch/merge and commit message omissions are not scheduled in Phase 3 or Phase 4 roadmap entries.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/core/src/types/git-source.ts` | GitSource interface for git metadata injection | ✓ VERIFIED | Exists, exports `GitSource` with `getFileDate` and `getTags`. No simple-git import. |
| `packages/core/src/types/timeline.ts` | Extended TimelineEventSchema with rawContent, artifactType, crossRefs | ✓ VERIFIED | Contains `rawContent: z.string()`, `artifactType: z.enum(...)`, `crossRefs: z.array(z.string())` |
| `packages/core/src/types/source.ts` | Extended ArtifactSource with resolveRef and getMtime | ✓ VERIFIED | Has `resolveRef?`, `getMtime?`, `maxDepth?` on glob options |
| `packages/core/src/scan/file-walker.ts` | File discovery with default GStack/GSD/generic patterns | ✓ VERIFIED | Exports `discoverFiles`, `DEFAULT_PATTERNS`, `DEFAULT_EXCLUDES`. Contains PLANNING.md, TASKS.md, README.md patterns. |
| `packages/core/src/scan/artifact-parser.ts` | Markdown extraction: heading outline, frontmatter, cross-refs, artifact classification | ✓ VERIFIED | Exports `parseArtifact`, `classifyArtifact`, `extractCrossRefs`. Uses remark+gray-matter. |
| `packages/core/src/scan/timeline-builder.ts` | Event merging, sorting, ID generation, dateRange computation, Zod validation | ✓ VERIFIED | Exports `buildTimeline`, `generateEventId`. Uses djb2 hash. Calls `TimelineSchema.parse()`. |
| `packages/core/src/scan/index.ts` | scan() orchestrator replacing the stub | ✓ VERIFIED | No `void source` stub. Imports and calls `discoverFiles`, `parseArtifact`, `buildTimeline`. Optional `gitSource` parameter. |
| `packages/cli/src/adapters/fs-source.ts` | Real ArtifactSource using fs and fast-glob | ✓ VERIFIED | Exports `createFsSource`. Uses fast-glob with `dot: true`. Applies `redactSecrets`. |
| `packages/cli/src/adapters/git-source.ts` | Real GitSource using simple-git | ✓ VERIFIED | Exports `createGitSource`. Uses `revparse(['--is-inside-work-tree'])` for graceful fallback. `maxCount: 1` bounds git log. |
| `packages/cli/src/adapters/redact.ts` | Secret redaction regex patterns | ✓ VERIFIED | Exports `redactSecrets`, `SECRET_PATTERNS`. Covers sk-, sk-ant-, AKIA, ghp_, Bearer, Basic, env vars. |
| `packages/cli/src/commands/scan.ts` | buildstory scan CLI command | ✓ VERIFIED | Exports `scanCommand`. Registered in index.ts as Commander subcommand. Writes to stdout or --output file. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `packages/core/src/index.ts` | `packages/core/src/types/git-source.ts` | barrel re-export | ✓ WIRED | `export type { GitSource }` confirmed |
| `packages/core/src/scan/index.ts` | `file-walker.ts` | `import discoverFiles` | ✓ WIRED | `import { discoverFiles }` on line 5 |
| `packages/core/src/scan/index.ts` | `artifact-parser.ts` | `import parseArtifact` | ✓ WIRED | `import { parseArtifact, classifyArtifact }` on line 6 |
| `packages/core/src/scan/index.ts` | `timeline-builder.ts` | `import buildTimeline` | ✓ WIRED | `import { buildTimeline }` on line 7 |
| `packages/core/src/scan/index.ts` | GitSource interface | optional parameter | ✓ WIRED | `gitSource?: GitSource | null` on line 12 |
| `packages/cli/src/commands/scan.ts` | `@buildstory/core` scan() | `import { scan }` | ✓ WIRED | scan() called with `(source, options, gitSource)` |
| `packages/cli/src/adapters/fs-source.ts` | `redact.ts` | `import redactSecrets` | ✓ WIRED | Applied in readFile at line 12 |
| `packages/cli/src/commands/run.ts` | `fs-source.ts` | `import createFsSource` | ✓ WIRED | Inline stub removed, imports from adapters |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `scan/index.ts` | `filePaths` | `discoverFiles(source, options)` → `source.glob()` | Yes — fast-glob returns real files | ✓ FLOWING |
| `scan/index.ts` | `content` | `source.readFile(filePath)` | Yes — fs.readFile after redaction | ✓ FLOWING |
| `scan/index.ts` | `gitDate` | `gitSource.getFileDate(filePath)` | Yes — simple-git `git.log({ file, maxCount: 1 })` | ✓ FLOWING |
| `timeline-builder.ts` | `tagEvents` | `gitSource.getTags()` | Yes — `git tag -l --format` returns real tags | ✓ FLOWING |
| `artifact-parser.ts` | `crossRefs` | remark AST link nodes | Yes — extracts real relative links | ✓ FLOWING (zero refs in project because planning files use @context, not markdown links) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Build succeeds | `pnpm build` | Exit 0, core 9.11KB, CLI 8.12KB | ✓ PASS |
| All tests pass | `pnpm test` | 89 core + 24 CLI = 113 passing | ✓ PASS |
| Lint clean | `pnpm lint` | Exit 0, zero errors | ✓ PASS |
| `buildstory scan` produces timeline | `node packages/cli/dist/index.js scan . --output /tmp/verify-timeline.json` | 27 events, valid JSON | ✓ PASS |
| Timeline fields complete | Check rawContent, summary, artifactType on all events | 27/27 events have non-empty rawContent, summary, and artifactType | ✓ PASS |
| Events chronologically sorted | Check date order | All 27 events in ascending date order | ✓ PASS |
| Stable IDs across rescans | Two scans, compare IDs | Identical 27 IDs both runs | ✓ PASS |
| Git dates enrich events | dateConfidence distribution | All 27 events have dateConfidence='exact' (from git) | ✓ PASS |
| Git tags create separate events | Scan test repo with tag | git-tag event appears with correct fields | ✓ PASS |
| Cross-refs detected | Scan dir with linked files | ROADMAP.md → DECISIONS.md crossRefs populated | ✓ PASS |
| Secret redaction | PLANNING.md with API_KEY=sk-... | rawContent shows API_KEY=[REDACTED] | ✓ PASS |
| Graceful no-git fallback | Scan non-git dir | dateConfidence='estimated' from mtime, no crash | ✓ PASS |
| No boundary violations in core | `pnpm lint` | No fs/path/process imports in packages/core/src/ | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SCAN-01 | 02-02 | Filesystem walker with configurable patterns | ✓ SATISFIED | discoverFiles() with DEFAULT_PATTERNS and ScanOptions.patterns override |
| SCAN-02 | 02-02 | Detect GStack artifacts | ✓ SATISFIED | GSTACK_FILENAMES set + .gstack path segment detection |
| SCAN-03 | 02-02 | Detect GSD artifacts | ✓ SATISFIED | GSD_FILENAMES set + .gsd/.planning/.claude path detection |
| SCAN-04 | 02-02 | Detect generic planning artifacts | ✓ SATISFIED | ADR/, docs/, README.md in DEFAULT_PATTERNS |
| SCAN-05 | 02-02 | Extract markdown structure: headings, dates, content summaries, cross-references | ✓ SATISFIED | remark AST heading outline as summary, gray-matter for frontmatter, extractCrossRefs |
| SCAN-06 | 02-03 | Git history integration: commit messages with timestamps, git blame, branch/merge events, tags | ✗ PARTIAL | Tags: implemented. Commit-date enrichment: implemented. Commit message events: not created (D-05 decision). Git blame: not implemented (D-04). Branch/merge: not implemented (D-04). |
| SCAN-07 | 02-02 | Produces structured Timeline JSON with events, metadata, date ranges | ✓ SATISFIED | TimelineSchema.parse() validates output. dateRange, events, metadata all present. |
| SCAN-08 | 02-02 | Planning-artifact timeline merges document events with git events | ✓ SATISFIED | File events enriched with git commit dates (exact), tag events merged by date |
| SCAN-09 | 02-02 | Cross-reference detection between artifacts | ✓ SATISFIED | extractCrossRefs() traverses link AST nodes, filters to scanned paths |
| SCAN-10 | 02-01 | Custom artifact patterns via buildstory.toml or ScanOptions | ✓ SATISFIED | ScanOptions.patterns/excludes/maxDepth passed through; config.scan loaded from TOML |
| SCAN-11 | 02-01/02-02 | Configurable max directory depth (default 5) | ✓ SATISFIED | file-walker passes maxDepth ?? 5 to glob; fs-source passes as fast-glob `deep` option |
| CLI-01 | 02-03 | `buildstory scan <paths>` command outputs timeline.json | ✓ SATISFIED | scanCommand registered in Commander, writes to stdout or --output file |

**Coverage summary:** 11/12 requirements satisfied; SCAN-06 is partially satisfied (tags + commit-date enrichment only).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `packages/cli/src/adapters/git-source.ts` | 11-12 | `return null` | ℹ️ Info | Intentional graceful fallback when not in a git repo — correct behavior |
| `packages/cli/src/adapters/fs-source.ts` | 43 | `return null` | ℹ️ Info | Intentional getMtime fallback when stat() fails — correct behavior |

No blocker or warning anti-patterns found. All `return null` instances are intentional error handling paths with documented purpose.

### Human Verification Required

### 1. SCAN-06 Scope Acceptance

**Test:** Review whether the branch/merge event omission and commit-message-only-as-date-enrichment is an acceptable narrowing of SCAN-06 for v1.
**Expected:** Either (a) the roadmap SC-3 is updated to say "Git tags appear as milestone events; file events are enriched with git commit dates" to match the D-04/D-05 decisions, OR (b) a plan is created to add separate commit events and branch/merge detection.
**Why human:** This is a product decision: the CONTEXT.md shows the user agreed to defer branch/merge (D-04) and commits-don't-create-events (D-05), but the roadmap success criteria still says these should be present. The verifier cannot resolve this contradiction — it requires the user to either accept the gap or reopen the work.

### 2. GStack Artifact Classification Under .planning/

**Test:** Check whether `.planning/ROADMAP.md` being classified as `gsd` (not `gstack`) is acceptable.
**Expected:** User confirms that path-context wins over filename, meaning canonical GStack files like ROADMAP.md stored in .planning/ are intentionally labeled `gsd`, OR requests a fix to make GStack canonical filenames override the .planning/ path segment.
**Why human:** This was a deliberate implementation decision (documented in 02-02-SUMMARY.md deviations). The 02-02-SUMMARY says "path-context classification before filename" was chosen to handle `.planning/PLAN.md` correctly as `gsd`. But it also reclassifies ROADMAP.md and REQUIREMENTS.md. User must decide if this is correct for the product.

## Gaps Summary

Two gaps block full roadmap success criteria achievement:

**Gap 1 — SCAN-06 partial implementation:** The roadmap success criterion SC-3 states "Git commits, tags, and branch/merge events appear in the timeline." The implementation delivers: (a) git tags as separate milestone events (fully working), and (b) git commit dates enriching file event dateConfidence to 'exact'. It does not deliver: separate commit-message timeline events or branch/merge events. The CONTEXT.md documents these omissions as user-approved decisions (D-04, D-05), creating a contradiction between the context decisions and the roadmap success criteria. The gaps list is required because the roadmap is the contract — the context decisions would need to update the roadmap to close this cleanly.

**Gap 2 — GStack classification under .planning/:** Roadmap SC-2 says "GStack artifacts appear as distinct typed events." In practice, 0 events in this project's own scan are typed 'gstack' — all planning files live in .planning/ and are classified 'gsd' due to path-context priority. While this was an intentional implementation choice, it means the distinction SC-2 promises (GStack vs GSD typed separately) is not visible in the actual output for projects that store artifacts in .planning/.

Both gaps require user judgment to resolve — either update the roadmap/requirements to match the implementation decisions or add implementation work.

---

_Verified: 2026-04-06T01:17:48Z_
_Verifier: Claude (gsd-verifier)_
