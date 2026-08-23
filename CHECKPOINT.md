# Checkpoint — 2026-08-22

Working branch: `main` (source of truth; solo builder commits straight to main).
State: **green** — `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`
(319 tests) all pass.

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
when Remotion ships a fix. Listed in `package.json > pnpm.auditConfig.ignoreGhsas`
so the CI `audit (high)` job passes on it but fails on any *new* high.

**Toolchain / release plumbing:** pnpm pinned via `packageManager: pnpm@10.33.0`
(Corepack); root `engines: node >=22`; removed the root `buildstory: workspace:*`
self-dependency. Changesets set to `access: public` and `.changeset/*.md`
un-ignored so release notes can be committed. `pnpm audit --audit-level=high`
runs in CI (+weekly schedule).

## External review remediation (Phase 0 + Phase 1) — shipped

An outside reviewer's findings, worked by severity and committed to main:

- **Phase 0 — restored green gates** (`0cd2ba8`): fixed the failures that a
  prior batch had left red; made `tsc --noEmit` a real CI gate; added
  `.github/workflows/ci.yml`.
- **Phase 0-remainder — finished the gate story** (`4ee5334`): R1/R3/R4.
- **R2 (partial) — branch protection.** Chose *keep pushing to main, block
  force-push only, do not require a PR.* A `main` ruleset blocks force-push and
  deletion; normal pushes are unrestricted (matches solo-builder flow).
- **Phase 1 — security & data safety** (`51f8e2d`, `c793362`):
  - 1.1–1.4: secret-redaction parity across every ingress (git subject/body,
    tags, all transcript harnesses), hostile-fixture tests (secrets assembled
    from fragments so no scannable literal ships), transcript pre-filtering,
    `SECURITY.md` (private-advisory reporting, data-egress table, prompt-injection
    threat model), `.gitignore` for scan/timeline dumps.
  - 1.5: **HeyGen HTTP hardening** — per-request timeouts (manual
    AbortController, no dangling timer), 5xx-HTML surfaced as a clear status
    error instead of an opaque JSON `SyntaxError`, transient-vs-terminal retry
    split, `completed`-without-`video_url` fails loudly, per-run `mkdtemp` temp
    dir. Fault-injection tests (5xx-HTML, hung connection, missing URL); suite
    de-flaked by mocking all fs/stream I/O so fake timers can't race real
    libuv I/O.

## Paid-path correctness (Phase 2) — shipped

External review, Phase 2. All committed to main:

- **2.1 TTS pricing — one source of truth.** New `@buildstory/video/pricing`
  (also a standalone subpath export so the CLI dry-run imports it without loading
  Remotion): `tts-1-hd = $0.03/1k`, `tts-1 = $0.015/1k`, default `tts-1-hd`.
  `estimateTTSCost(beats, model)` and `run --dry-run` both price at the model
  render actually calls; `[tts] model` is configurable. (Old bug: estimate used
  $0.015 while `generateSceneAudio` called `tts-1-hd` at $0.03 — 2× under.)
- **2.2 Render deps.** `preflight.chromePath` is now threaded into
  `renderVideo → renderMedia({ browserExecutable })`, so a machine that passes
  preflight renders with the same browser (no divergent second discovery).
  Preflight now checks **ffmpeg and ffprobe** (was ffprobe only).
  **Dropped `ffmpeg-static`** — it was a phantom dep (never imported); the code
  uses system FFmpeg via `FFMPEG_PATH`/`FFPROBE_PATH` (README already required
  it). Binary resolution centralized in `video/src/tts/ffmpeg.ts`. *(Diverges
  from CLAUDE.md's "use ffmpeg-static" recommendation — a deliberate, reviewer-
  sanctioned call: bundling ~90MB of ffmpeg+ffprobe for a dev CLI whose users
  have FFmpeg is poor value, and ffmpeg-static ships no ffprobe anyway.)*
- **2.3 Card flags now work.** `--no-title-card`/`--no-stats-card` and
  `[render] titleCard/statsCard` flow as `showTitleCard`/`showStatsCard`
  composition props; when off, those beats render with their natural scene type.
  (Previously the flags were read under the wrong opt names and never reached the
  composition — pure dead flags.)
- **2.4 Lazy-install incoherence resolved.** `video`/`heygen` are hard workspace
  deps (always installed); deleted `lazy.ts` and the install prompts. Commands
  still `import()` them at render time (lazy *loading*, not installing), so
  `scan`/`narrate`/`--skip-video` never load Remotion. Removed the redundant
  `external` asymmetry in the CLI tsup config (tsup auto-externalizes deps).
  README install story rewritten.
- **2.5 remotion-script** — already removed in Phase 0; `FORMAT_PROMPTS` is
  `Record<FormatType, string>`, so exhaustiveness is compiler-enforced. No action.
- **2.6 Failure-mode work.** `generateSRT` now asserts beat/scene alignment
  (clear error instead of a crash on an undefined scene). **TTS resume:**
  existing `scene-NNN.wav` files are reused, so a re-run only regenerates missing
  audio. **HeyGen chunk resume:** completed chunks live in a content-keyed
  `<output>.mp4.parts/` that persists across failure and is removed only on
  success — a mid-render failure re-submits only unfinished chunks (replaces the
  1.5 mkdtemp temp dir; still output-scoped, so no shared-tmp collision).
- **2.7 Token guard for commit-heavy repos.** Commits carry no GSD phase path, so
  they all landed in one "ungrouped" chunk that stayed over budget →
  `guardTokens` threw. `chunkTimeline` now size-splits oversized groups into
  budget-fitting sub-chunks (exact char accounting), preserving order. Tested on
  a synthetic 320-commit timeline: many chunks, each within budget, none lost.

## UX & pipeline robustness (Phase 3) — shipped

External review, Phase 3. All committed to main:

- **3.1 CLI stops lying about multi-root.** `run`/`scan` took `[paths...]` but only
  ever used the first; downstream (`narrate`, correlate, system prompt) assumes a
  single `rootDir`. Changed to a single `[path]` argument (docs match behavior).
- **3.2 Input validation + precedence.** New `cli/src/validate.ts` checks
  `--provider`/`--style`/`--renderer`/`tts.voice`/`tts.speed`/`--max-cost` and
  fails fast, free, and clearly (one aggregated report) before any paid call.
  Fixed inverted precedence — was `config ?? flag` (config won); now
  `flag ?? config ?? default` (removed commander flag defaults so an unset flag
  is truly undefined). Unified the default style to **story** for both `run` and
  `narrate` (they disagreed; narrate also mis-cast the type, omitting "story").
- **3.3 Token-guard hardening.** The narrate budget now subtracts the system
  prompt (~1.5–2k tokens) from `maxInputTokens` for both the fits-check and each
  chunk's guard (a full chunk + a 2k prompt used to slip over). Combined with the
  Phase-2 size-splitter, a phase-less (non-GSD) repo chunks and narrates instead
  of dead-ending on one over-budget "ungrouped" chunk.
- **3.4 OpenAI zod-compat fallback narrowed.** The fallback is now scoped to
  schema *construction* (`zodResponseFormat`, which fails synchronously before any
  network call). Previously any error whose message contained "Cannot read
  properties of undefined" — including a genuine parse/response failure — retried
  via a second `create()`, masking the real error and double-spending. Now a
  schema failure raises once, no duplicate spend.
- **3.5 Correlation is O(n+m).** `correlateCommitsWithTranscripts` replaced the
  per-commit `asks.filter(...)` (O(commits×asks)) with a sliding two-pointer walk
  over the two sorted lists. No behavior change (all existing tests pass); a
  2000×2000 correctness+speed test guards it.
- **3.6 IDs + git dating.** Event IDs are now a 64-bit SHA-1 slice (16 hex) instead
  of 32-bit djb2 — collision bound moves from ~77k events to ~5B (50k-input
  collision test). File dating batches into **one** `git log --name-only
  --relative` pass building a path→date map, replacing one `git log` spawn per
  file (the large-repo win). Commit IDs still key on the git hash.
- **3.7 `--max-cost` + spend report.** `run --max-cost <usd>` tracks spend live
  (LLM cost from actual token usage via a per-provider price table, TTS chars,
  HeyGen credits) and aborts before any stage that would exceed the cap, keeping
  partial results (`story-arc.json`, completed formats). Every `run` prints an
  end-of-run spend breakdown. New `cli/src/pricing-llm.ts`.

**Next (roadmap, not requested):** goose adapter; validate pi on a real session;
sharper correlation (touched files + message, walk pi's active branch);
multi-root scan (deferred with 3.1 — downstream assumes a single rootDir).

## Working agreement

Solo builder, no customers. No PRs. No GSD/planning-doc ceremony — commit
straight to `main` (force-push blocked by ruleset), keep build/typecheck/lint/
test green before every push.
