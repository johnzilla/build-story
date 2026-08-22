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

## Designed, not yet built — #3 transcripts

`TranscriptSource` / `TranscriptSession` / `TranscriptTurn` interface committed in
`packages/core/src/types/transcript.ts`, ACP-shaped. Rationale (in the file's
doc comment): ACP is a *live* protocol, not a log format, so post-hoc reading
needs a thin adapter per harness — but modeling the schema on ACP's session
vocabulary means adapters normalize into one shape, and a future live "capture
mode" needs no translation.

**Next step:** write the first adapter (Claude Code, `~/.claude/projects/**/*.jsonl`)
→ normalize to `TranscriptSession` → correlate to commits by timestamp so
reasoning enriches commit events. Then goose/pi adapters. MVP = Claude Code only.

## Renderer decision (no code needed)

Keep both. Remotion primary (cheap ~$0.30/video, full visual control, shows the
actual build), HeyGen behind `--renderer=heygen` in maintenance (already isolated
in `@buildstory/heygen`, ~$5–15/video). Do NOT go 100% HeyGen; do NOT drop
Remotion.

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
