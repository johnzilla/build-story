# Checkpoint — 2026-08-22

Working branch: `claude/build-story-workflow-update-9by64e`
State: **green** — `pnpm build`, `pnpm test` (241 tests), `pnpm lint` all pass.

## The pivot (why this work exists)

Original premise: agent frameworks (GStack/GSD) generate planning `.md` files →
build-story turns them into narrated video. That premise is dead for how the
project is built now — no framework, no planning docs. But the value ("why
decisions were made, what changed, what was considered") didn't disappear; it
moved from curated docs into the **exhaust of the work**: git commits, and agent
session transcripts across multiple harnesses (Claude Code, goose, pi, grok,
local models).

Reframe: build-story is a **build historian**, not a planning-doc parser. Product
intent = **shareable content engine** (polished video is the deliverable).

## Done (shipped on this branch)

- **Git commits are first-class timeline events.** `GitSource.getCommits()` +
  `buildCommitEvents()`. Commit substance (message, body, changed files, +/-
  stats) goes in `summary`/`metadata` because the narrate LLM never sees
  `rawContent` (it's stripped to avoid leaking file contents).
- **`scan()` refactored around pluggable event sources** (file / git-commit /
  git-tag). Commits on by default when git supports them; `scan.includeFiles =
  false` for a commit-only timeline. Nothing downstream changed — narrate/
  format/render were already source-agnostic.
- **Config:** `[commits]` section (`max`, `since`, `includeMerges`, `paths`) +
  `scan.includeFiles`. README updated.
- **Verified end-to-end:** scanning this repo → 46 file + 50 git-commit events,
  exact dates, real stats.
- **Build/test/lint repaired** (all pre-existing, not from this work): TS6
  DTS/composite build, video preflight type error, Anthropic test mocks missing
  `usage`, dead `VideoRenderer` interface, video `--passWithNoTests`.

## #3 transcripts — Claude Code adapter shipped

`TranscriptSource` / `TranscriptSession` / `TranscriptTurn` interface in
`packages/core/src/types/transcript.ts`, ACP-shaped (ACP is a *live* protocol,
not a log format, so post-hoc reading needs a thin adapter per harness; modeling
on ACP's vocabulary means adapters normalize into one shape and a future live
"capture mode" needs no translation).

Shipped:
- **Adapters** (CLI): `transcript-claude-code.ts` (`~/.claude/projects/**/*.jsonl`)
  and `transcript-pi.ts` (`~/.pi/agent/sessions/**/*.jsonl`, per pi's
  session-format.md — cwd lives only in the `session` header line). Both keep
  human prompts + agent thinking/text/tool calls, redact secrets, match sessions
  to the repo by `cwd`. Shared discovery/matching/redaction in
  `transcript-shared.ts`; per-harness `parse*Session` functions are pure/tested.
- **Registry + composite** `transcript-registry.ts` — `createTranscriptSource`
  fans out over selected harnesses (`transcripts.harnesses`, default all known)
  and merges their sessions into one timeline; unknown harness names are reported.
- **Core mapper** `buildTranscriptEvents()` — one `source: 'transcript'` event
  per session, dated at session start; summary = the human decision trail (the
  LLM-visible field). Wired into `scan()` as a 4th injected source. No core
  changes were needed to add pi — the interface is harness-neutral.
- **Config** `[transcripts] enabled=false` (opt-in; privacy). `harnesses`,
  `claudeCodePath`, `piPath`, `since`, `until`.
- Verified end-to-end: Claude Code against the live session (real), and pi
  against a spec-shaped fixture (discovery + parse + mapper). **pi still needs a
  check against a real pi session file** — none was available in this env.

pi format sourced from `github.com/earendil-works/pi`
(`packages/coding-agent/docs/session-format.md`); pi.dev is egress-blocked here.

## transcript ↔ commit correlation — shipped

`correlateCommitsWithTranscripts()` (`packages/core/src/scan/correlate.ts`):
for each commit, the human asks in the time window before it (since the prior
commit, bounded by a 24h look-back) are appended to the commit's `summary` as a
"Why (from agent session)" block, with `sourceSessionIds`/`correlatedAsks` in
metadata. Supplement, not replace — standalone session events still emit.
On by default when transcripts are on; `transcripts.correlate = false` to disable.
`scan()` now fetches sessions once, correlates them into commit events, then
also builds the session events. Verified on this repo: 5 of 58 commits (the
ones made during a recorded session) carry their "why".

**Next:** goose adapter (same pattern); validate pi on a real session; sharper
correlation (use touched files + commit message, not only time; walk pi's active
branch instead of all turns).

## Renderer decision (no code needed)

Keep both. Remotion primary (cheap ~$0.30/video, full visual control, shows the
actual build), HeyGen behind `--renderer=heygen` in maintenance (already isolated
in `@buildstory/heygen`, ~$5–15/video). Do NOT go 100% HeyGen; do NOT drop
Remotion.

## Gates (CI)

`pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test` all green; enforced by
`.github/workflows/ci.yml` (Node 22) on push to main and every PR.

- **typecheck is a real gate now.** tsup only type-checks each package's entry
  graph; `tsc --noEmit` (per-package `typecheck` script) covers all src + tests.
  Adding it surfaced ~65 latent errors — fixed. Notably: `format-prompts` was
  missing the `remotion-script` key (removed the dead enum member instead);
  `@types/mdast` was undeclared; the CLI passed explicit `undefined` for optional
  ScanOptions (now via `toScanOptions`); `simple-git` needed a named import under
  nodenext; video composition `.tsx` needed `.js` extensions + a `type` (not
  `interface`) for Remotion's props constraint.
- Removed `composite`/project-references from tsconfigs (unused — build is tsup),
  which is what lets `tsc --noEmit` run.
- heygen is now part of `pnpm build` (its d.ts is needed for the CLI typecheck).

## Dependencies / security

Swept 2026-08: 36 audit findings → 1. Bumped `@anthropic-ai/sdk` (0.82→0.91)
and `simple-git` (→3.36) directly; `pnpm update -r` refreshed the rest within
range; `pnpm.overrides` pin patched `postcss`/`ws`/`esbuild`, and `vite` is a
root devDep at ^8.0.16 (satisfies vitest's peer).

**Remaining (1, accepted):** `extract-zip` (high, GHSA-jmr9-qjv8-65gv) — **no
patched version exists**. Reaches us only via `@remotion/renderer`'s Chrome
download, which is lazy-installed and runs only during video rendering. Revisit
when Remotion ships a fix.

## Working agreement

Solo builder, no customers. No PRs. No GSD/planning-doc ceremony — commit
straight to the working branch, keep build/test/lint green.
