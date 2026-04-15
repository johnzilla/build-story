---
phase: 05-heygen-package
verified: 2026-04-14T00:00:00Z
status: passed
score: 7/7
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/7
  gaps_closed:
    - "REND-12: VideoRenderer interface added to packages/cli/src/commands/render.ts (lines 11-15) via plan 05-03"
    - "05-02-SUMMARY.md exists documenting Plan 02 CLI integration work"
  gaps_remaining: []
  regressions: []
---

# Phase 5: HeyGen Package — Verification Report

**Phase Goal:** The `@buildstory/heygen` package exists with a VideoRenderer interface, API key configuration, preflight validation, cost estimation, and dry-run support — so no HeyGen credits are spent before the user has verified intent
**Verified:** 2026-04-14T00:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plan 05-03 added VideoRenderer interface; 05-02-SUMMARY.md restored)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `@buildstory/heygen` builds independently with zero imports from `@buildstory/video` | VERIFIED | `grep -r "@buildstory/video" packages/heygen/src/` returns no matches; `dist/index.js` and `dist/index.d.ts` present |
| 2 | `preflightHeyGenCheck` returns failures when apiKey, avatarId, or voiceId is missing | VERIFIED | `preflight.ts` has three explicit empty-string checks returning actionable messages with HeyGen docs URLs |
| 3 | `estimateHeyGenCost` returns credits and USD from beat data without calling any API | VERIFIED | Pure function — `CREDITS_PER_MINUTE=1`, `USD_PER_CREDIT=0.99`, `Math.ceil`, NaN guard via `!== undefined` check; no fetch/HTTP calls |
| 4 | Package exports `preflightHeyGenCheck`, `estimateHeyGenCost`, and all type definitions | VERIFIED | `index.ts` exports both functions plus `HeyGenOptionsSchema` and type-exports `HeyGenOptions`, `HeyGenConfig`, `HeyGenCostEstimate`, `PreflightResult` |
| 5 | CLI `--renderer=heygen` flag dispatches to HeyGen path with preflight, cost display, and dry-run exit | VERIFIED | `render.ts` line 45 and `run.ts` line 132 branch on `renderer === 'heygen'`; `index.ts` registers `.option('--renderer <renderer>', ..., 'remotion')` on both commands |
| 6 | REND-12: Pluggable VideoRenderer interface exists so CLI can dispatch to Remotion or HeyGen by name | VERIFIED | `interface VideoRenderer` declared at `packages/cli/src/commands/render.ts` lines 11-15 with `readonly name: string`, `preflight(opts: unknown)`, and `estimateCost(beats: StoryBeat[])` members; `StoryBeat` imported from `@buildstory/core` |
| 7 | 05-02-SUMMARY.md exists documenting Plan 02 execution | VERIFIED | File present at `.planning/phases/05-heygen-package/05-02-SUMMARY.md` |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/heygen/package.json` | @buildstory/heygen workspace package definition | VERIFIED | name `@buildstory/heygen`; deps: `@buildstory/core workspace:*`, `zod ^4.3.6`, `p-retry ^6.2.1`; no video/remotion/openai deps |
| `packages/heygen/src/types.ts` | HeyGenOptions, HeyGenConfig, HeyGenCostEstimate, PreflightResult | VERIFIED | All 5 exports present; HeyGenOptions=z.infer, HeyGenConfig=z.input (correct distinction) |
| `packages/heygen/src/preflight.ts` | preflightHeyGenCheck | VERIFIED | Exports async function accepting HeyGenConfig; three failure checks with HeyGen docs URLs |
| `packages/heygen/src/cost.ts` | estimateHeyGenCost | VERIFIED | Imports StoryBeat from @buildstory/core; `!== undefined` guard; Math.ceil; CREDITS_PER_MINUTE=1, USD_PER_CREDIT=0.99 |
| `packages/heygen/src/index.ts` | Barrel exports | VERIFIED | Separate value and type export lines; .js extensions for NodeNext resolution |
| `packages/heygen/tsconfig.json` | Extends tsconfig.base.json, no composite | VERIFIED | No composite or references fields |
| `packages/heygen/tsup.config.ts` | ESM + dts build | VERIFIED | format: esm, dts: true, clean: true |
| `packages/cli/src/config.ts` | Extended BuildStoryConfig with video and heygen sections | VERIFIED | `video?` at line 24, `heygen?` at line 27; deep merge includes both sections in loadConfig return |
| `packages/cli/src/lazy.ts` | ensureHeyGenPackage, detectHeyGenPackage | VERIFIED | Both functions exported; reuse private `askYesNo`; correct install prompt text |
| `packages/cli/src/commands/render.ts` | VideoRenderer interface + HeyGen dispatch | VERIFIED | Interface at lines 11-15; `renderer === 'heygen'` branch at line 45; preflight, cost display, dry-run exit, Phase 7 stub |
| `packages/cli/src/commands/run.ts` | Renderer dispatch in run pipeline | VERIFIED | `renderer === 'heygen'` branch at line 132 inside `if (!skipVideo)` block |
| `packages/cli/src/index.ts` | --renderer flag on render and run commands | VERIFIED | Lines 30 and 65: `.option('--renderer <renderer>', 'Video renderer (remotion|heygen)', 'remotion')` on both commands |
| `.planning/phases/05-heygen-package/05-02-SUMMARY.md` | Plan 02 execution summary | VERIFIED | File exists with full accomplishments, decisions, and deviation documentation |
| `.planning/phases/05-heygen-package/05-03-SUMMARY.md` | Plan 03 gap closure summary | VERIFIED | File exists; documents VideoRenderer interface addition and CLI build success |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/heygen/src/cost.ts` | `@buildstory/core` | `import type { StoryBeat }` | VERIFIED | `import type { StoryBeat } from '@buildstory/core'` at line 1 |
| `packages/heygen/src/preflight.ts` | `packages/heygen/src/types.ts` | `import HeyGenConfig, PreflightResult` | VERIFIED | `import type { HeyGenConfig, PreflightResult } from './types.js'` at line 1 |
| `packages/cli/src/commands/render.ts` | `@buildstory/heygen` | `dynamic import after ensureHeyGenPackage` | VERIFIED | `await import('@buildstory/heygen')` at line 48 |
| `packages/cli/src/commands/render.ts` | `packages/cli/src/config.ts` | `config.video?.renderer` | VERIFIED | `const renderer = opts.renderer ?? config.video?.renderer ?? 'remotion'` at line 43 |
| `packages/cli/src/lazy.ts` | `@buildstory/heygen` | `dynamic import for detection` | VERIFIED | `await import('@buildstory/heygen')` in `detectHeyGenPackage` |
| `packages/cli/src/commands/render.ts` | `packages/cli/src/commands/render.ts` (self) | VideoRenderer interface used as type contract | VERIFIED | Interface at lines 11-15; `StoryBeat` imported at line 5 from `@buildstory/core` |

---

### Data-Flow Trace (Level 4)

Not applicable — `@buildstory/heygen` is a pure utility package with no UI rendering or state. CLI integration functions are control-flow dispatchers. Data flows are traceable statically: `storyArc.beats` -> `estimateHeyGenCost` -> cost display; no dynamic rendering pipeline requiring Level 4 trace.

---

### Behavioral Spot-Checks

| Behavior | Evidence | Status |
|----------|----------|--------|
| VideoRenderer interface declared with correct shape | `interface VideoRenderer` at render.ts:11; `readonly name`, `preflight`, `estimateCost` all present | PASS |
| No @buildstory/video imports in heygen package | `grep -r "@buildstory/video" packages/heygen/src/` returns no matches | PASS |
| HeyGen dist output present | `packages/heygen/dist/index.js` and `dist/index.d.ts` confirmed present | PASS |
| --renderer flag registered on both commands | `index.ts` lines 30 and 65 confirm both render and run commands carry the flag | PASS |
| Dry-run exit path present | `render.ts` line 77: `--dry-run: Skipping HeyGen submission.` with `return` | PASS |
| HEYGEN_API_KEY read from env only | `render.ts` line 53: `process.env['HEYGEN_API_KEY'] ?? ''`; never from config | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| REND-12 | 05-02-PLAN.md + 05-03-PLAN.md | Pluggable VideoRenderer interface exists so CLI can dispatch by name | VERIFIED | `interface VideoRenderer` at render.ts:11-15 with name, preflight, estimateCost members; added by gap closure plan 05-03 |
| REND-13 | 05-01-PLAN.md | `@buildstory/heygen` standalone, no imports from `@buildstory/video` | VERIFIED | Zero @buildstory/video references in packages/heygen/src/ |
| HGVR-01 | 05-01-PLAN.md | HEYGEN_API_KEY configurable via environment variable | VERIFIED | render.ts reads `process.env['HEYGEN_API_KEY']`; preflight validates non-empty |
| SAFE-01 | 05-01-PLAN.md | Preflight validates HEYGEN_API_KEY before any API call | VERIFIED | `preflightHeyGenCheck` checks apiKey presence; CLI exits on failure before any HeyGen call |
| SAFE-02 | 05-01-PLAN.md | Cost estimation displays credits and USD before submitting | VERIFIED | render.ts and run.ts print `~{creditsRequired} credits (~${estimatedCostUSD})` before any submission |
| SAFE-03 | 05-02-PLAN.md | `--dry-run` shows full plan without calling HeyGen | VERIFIED | Both commands exit with `--dry-run: Skipping HeyGen submission.` after cost display |
| SAFE-04 | 05-01-PLAN.md | Missing API key or config fails with actionable error | VERIFIED | Three specific failure messages with HeyGen docs URLs (avatars and voices API reference links) |

**Orphaned requirements note (informational):** REQUIREMENTS.md traceability maps CLI-08 and CLI-09 to Phase 7, but the `--renderer=heygen` flag (CLI-08) and `buildstory.toml [video]`/`[heygen]` config (CLI-09) were delivered early in Phase 5. This is early delivery, not a gap — no action required here.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/cli/src/lazy.ts` | 17 | `answer.toLowerCase() !== 'n'` — blank Enter proceeds with install | Warning | Non-fatal; any non-"n" input triggers install. Already flagged in 05-REVIEW.md WR-01. |
| `packages/heygen/src/cost.ts` | ~13 | Word-count fallback uses `b.summary` (short), not full narration script | Warning | Low-confidence estimates for arcs without `duration_seconds`. Already flagged in 05-REVIEW.md WR-02. |
| `packages/cli/src/commands/render.ts` + `run.ts` | 45-83 / 132-164 | HeyGen pipeline logic duplicated verbatim across both commands | Warning | Will diverge when Phase 7 lands. Already flagged in 05-REVIEW.md WR-03. |

No blockers. All anti-patterns pre-existing and documented in 05-REVIEW.md.

---

### Human Verification Required

None. All must-haves are verifiable programmatically and all pass.

---

## Re-Verification Summary

**Both gaps from the initial verification are closed:**

**Gap 1 (REND-12) — CLOSED:** The `VideoRenderer` interface was added to `packages/cli/src/commands/render.ts` (lines 11-15) by gap closure plan 05-03. The interface has `readonly name: string`, `preflight(opts: unknown): Promise<{ ok: boolean; failures: string[] }>`, and `estimateCost(beats: StoryBeat[]): { label: string; creditsRequired?: number; estimatedCostUSD?: number }` — matching RESEARCH.md Pattern 3 and REND-12 requirements exactly.

**Gap 2 (05-02-SUMMARY.md missing) — CLOSED:** The file now exists at `.planning/phases/05-heygen-package/05-02-SUMMARY.md` with full execution documentation.

**No regressions detected.** All 7 truths that passed in the initial verification continue to pass. The VideoRenderer interface addition is a type-only declaration with no runtime behavior change.

---

*Verified: 2026-04-14T00:00:00Z*
*Verifier: Claude (gsd-verifier)*
