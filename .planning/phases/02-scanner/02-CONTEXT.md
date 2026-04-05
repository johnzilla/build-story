# Phase 2: Scanner - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Scan planning artifacts and git history from a target directory to produce a structured Timeline JSON. The scanner discovers files, extracts content and metadata, enriches with git dates, and outputs chronologically ordered events. No LLM calls, no beat classification, no narration. Pure extraction and structuring.

</domain>

<decisions>
## Implementation Decisions

### Event Granularity
- **D-01:** One event per file — each markdown artifact produces a single TimelineEvent. Keeps timeline manageable (10-50 events for typical projects).
- **D-02:** Full content extraction — rawContent contains the entire file contents. The narrator decides what's relevant. Typical projects are 50-150KB total, well within LLM context limits.
- **D-03:** Summary as heading hierarchy outline — extract all headings as a nested outline using remark AST. Gives narrator the document skeleton without LLM cost.

### Git Integration
- **D-04:** Commits + tags only — git log for commit messages/timestamps, git tag for version milestones. No blame, no branch/merge events for v1. Covers 80% of narrative value with minimal complexity.
- **D-05:** Git enriches file events, doesn't create separate events — use git log to date files (most recent commit touching each file). Tags become separate milestone-type events. Timeline stays artifact-focused.
- **D-06:** dateConfidence mapping — git commit dates → 'exact', file mtime → 'estimated', no date found → 'unknown'. Already in the TimelineEvent schema from Phase 1.

### Beat Classification
- **D-07:** No beat hints in scan — scan() produces a clean Timeline with zero narrative concepts. All beat classification (heuristic and LLM) happens in narrate(). Clean separation of concerns.

### Secret Redaction
- **D-08:** Regex pattern matching for secrets — strip API keys (sk-*, AKIA*), tokens, passwords in env var assignments, base64 credentials. Replace with [REDACTED].
- **D-09:** Redaction in the ArtifactSource adapter — readFile() returns pre-redacted content. Single enforcement point. Scanner and narrator never see raw secrets.

### Artifact Detection
- **D-10:** GStack/GSD artifact patterns as defaults — detect PLANNING.md, ROADMAP.md, DECISIONS.md, TASKS.md, SESSION_LOG.md, .planning/**/*.md, and generic planning files (ADR/, docs/, README.md). Configurable via buildstory.toml patterns.
- **D-11:** Configurable include/exclude patterns — ScanOptions.patterns and ScanOptions.excludes override defaults. Default excludes: node_modules, .git, vendor, dist, target.

### Claude's Discretion
- Exact remark plugin chain for heading extraction
- fast-glob configuration for file discovery
- simple-git log format and options
- Cross-reference detection approach (SCAN-09) — how to find links between artifacts
- Error handling for unreadable files or git failures
- Event ID generation strategy (stable across rescans)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase contracts
- `packages/core/src/types/timeline.ts` — TimelineEvent and Timeline Zod schemas (the output contract)
- `packages/core/src/types/source.ts` — ArtifactSource interface (how scan reads files)
- `packages/core/src/types/options.ts` — ScanOptions interface (scan input contract)
- `packages/core/src/scan/index.ts` — Current scan stub to be replaced

### Requirements
- `.planning/REQUIREMENTS.md` — SCAN-01 through SCAN-11, CLI-01 requirements
- `.planning/ROADMAP.md` — Phase 2 success criteria

### Design
- `~/.gstack/projects/johnzilla-build-story/john-main-design-20260405-144013.md` — Design doc with artifact detection patterns, data model, edge cases
- `~/.gstack/projects/johnzilla-build-story/ceo-plans/2026-04-05-narrative-first-mvp.md` — CEO plan with secret redaction requirement and core boundary refinement

### Prior phase
- `.planning/phases/01-scaffold/01-CONTEXT.md` — Phase 1 decisions (ESM-only, NodeNext, ArtifactSource pattern, Zod schemas)

### Stack research
- `.planning/research/STACK.md` — remark 15.0.1, simple-git 3.33.0, fast-glob 3.3.3 recommendations
- `.planning/research/PITFALLS.md` — ESM boundary traps, fluent-ffmpeg archived (not relevant to scanner but good to know)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ArtifactSource` interface (`packages/core/src/types/source.ts`) — readFile() and glob() methods. CLI provides fs implementation. Secret redaction lives here.
- `TimelineSchema` + `TimelineEventSchema` (`packages/core/src/types/timeline.ts`) — Zod-validated output contract with dateConfidence field
- `ScanOptions` interface (`packages/core/src/types/options.ts`) — rootDir, patterns, excludes, maxDepth
- `scan()` stub (`packages/core/src/scan/index.ts`) — Replace stub body, keep signature: `scan(source: ArtifactSource, options: ScanOptions): Promise<Timeline>`
- CLI `run` command (`packages/cli/src/commands/run.ts`) — Already wires scan() with ArtifactSource adapter and config

### Established Patterns
- ESLint boundary: core cannot import fs, process, config libs. All file access through ArtifactSource.
- Zod schemas define typed contracts at pipeline boundaries
- All imports use .js extensions (NodeNext resolution)
- tsup builds ESM-only with .d.ts

### Integration Points
- `packages/cli/src/commands/run.ts` — calls scan(), passes result to narrate(). Scanner output must be a valid Timeline.
- `packages/cli/src/config.ts` — loadConfig() provides scan patterns from buildstory.toml
- `buildstory scan <path>` CLI command — needs to be added (currently only `run` exists). Writes timeline.json.

</code_context>

<specifics>
## Specific Ideas

- Scanner should work well against BuildStory's own `.planning/` directory as a test fixture (CEO plan: dogfood with own artifacts)
- The design doc lists specific GStack/GSD artifact patterns to detect — use those as the default include patterns
- Timeline should be useful even without git (graceful degradation when not in a git repo)

</specifics>

<deferred>
## Deferred Ideas

- Git blame per-line dating — deferred from SCAN-06 to keep v1 simple. Add when chronology accuracy matters more.
- Branch/merge event detection — deferred from SCAN-06. Useful for multi-branch narratives but adds complexity.
- Beat pre-classification in scan — decided against (D-07). Narrator handles all beat extraction.
- Multi-repo scanning — v2 feature per design doc.

</deferred>

---

*Phase: 02-scanner*
*Context gathered: 2026-04-05*
