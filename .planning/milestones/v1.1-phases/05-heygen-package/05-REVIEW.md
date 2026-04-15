---
phase: 05-heygen-package
reviewed: 2026-04-14T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - packages/heygen/package.json
  - packages/heygen/src/types.ts
  - packages/heygen/src/preflight.ts
  - packages/heygen/src/cost.ts
  - packages/heygen/src/index.ts
  - packages/heygen/tsconfig.json
  - packages/heygen/tsup.config.ts
  - packages/cli/src/config.ts
  - packages/cli/src/lazy.ts
  - packages/cli/src/commands/render.ts
  - packages/cli/src/commands/run.ts
  - packages/cli/src/index.ts
  - packages/cli/tsup.config.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-04-14T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

This phase adds the `@buildstory/heygen` package (types, preflight, cost estimation) and wires up HeyGen renderer selection in both `buildstory render` and `buildstory run` commands. The package boundary is well-maintained — `@buildstory/heygen` is pure typed logic with no CLI knowledge. Lazy installation via `lazy.ts` is correctly marked external in the CLI bundle.

The main concerns are: (1) a misleading prompt default in `askYesNo` that silently proceeds on non-"n" input including blank Enter — intentional but the prompt text says `[Y/n]` and "blank = proceed" is dangerous for an install that downloads ~200MB; (2) a word-count-based duration fallback in `cost.ts` that operates on `b.summary` (1–3 sentence narrative text) rather than the actual narration script, producing low-confidence estimates; (3) duplicated HeyGen pipeline logic across `render.ts` and `run.ts` that will diverge when Phase 7 lands; and (4) `preflight.ts` doing manual empty-string checks on `HeyGenConfig` rather than using the Zod schema it already defines in `types.ts`, creating a possible desync.

---

## Warnings

### WR-01: `askYesNo` treats blank/Enter as "yes" — any non-"n" input proceeds

**File:** `packages/cli/src/lazy.ts:17-21`

**Issue:** The comparison `answer.toLowerCase() !== 'n'` resolves `true` for an empty string (user presses Enter), any typo, or any unexpected input. The practical effect is that pressing Enter alone silently triggers a multi-hundred-megabyte install. The prompt string `[Y/n]` implies Enter = yes, which is a common UX convention, but the asymmetry means unexpected input (e.g., "no", "nope", "cancel") also proceeds — it only stops on the exact letter "n". This is a correctness issue: the function name and prompt contract say "yes or no" but the implementation is "anything except exactly 'n'".

**Fix:**
```typescript
resolve(answer.toLowerCase() !== 'n' && answer.toLowerCase() !== 'no')
```
Or, for stricter behavior that only accepts explicit confirmation:
```typescript
const yes = /^(y|yes|)$/i.test(answer.trim())  // blank Enter = yes; anything else = no
resolve(yes)
```
Pick one semantic and document it. The second form (blank = yes, anything else = no) matches the `[Y/n]` convention and prevents "no"/"nope" accidentally proceeding.

---

### WR-02: `estimateHeyGenCost` uses `b.summary` for word-count fallback — wrong field

**File:** `packages/heygen/src/cost.ts:12-14`

**Issue:** When `duration_seconds` is absent, the code estimates duration from `b.summary.split(/\s+/).length`. `StoryBeat.summary` is a 1–3 sentence narrative summary of the beat, not the full narration script. In practice summaries are short (10–40 words), so the fallback will dramatically underestimate video duration and therefore credits/cost for any arc where `duration_seconds` is not pre-populated. The field that would produce a reasonable word-count estimate is the full narration script text, but that is not currently part of `StoryBeat`. Until it is, the fallback should either be removed (and the caller warned that the estimate requires `duration_seconds`), or the word-count rate should be applied conservatively with an explicit warning in the returned estimate.

**Fix:** At minimum, add a comment and a visible warning in the returned estimate:
```typescript
// Fallback: summary is a short description, not the full script -- estimate will be low
const words = b.summary.split(/\s+/).filter(Boolean).length
// Use a lower WPM rate for summaries to partially compensate, and flag it
return sum + (words / 100) * 60   // 100 WPM vs 150 WPM -- conservative for short text
```
Better fix: add a `hasUnreliableEstimate: boolean` field to `HeyGenCostEstimate` and set it when any beat used the word-count path. Surface this to the user in `render.ts` / `run.ts`.

---

### WR-03: HeyGen pipeline logic is duplicated across `render.ts` and `run.ts`

**File:** `packages/cli/src/commands/render.ts:38-76`, `packages/cli/src/commands/run.ts:132-164`

**Issue:** The HeyGen preflight + cost-estimate + dry-run + Phase 7 stub block is copy-pasted verbatim in both commands. When Phase 7 lands (actual API submission), the implementation will need to be added in both places. One copy will likely be missed or lag behind, causing behavioral inconsistency between `buildstory render` and `buildstory run --renderer=heygen`.

**Fix:** Extract the HeyGen execution path into a shared helper, e.g. `packages/cli/src/commands/heygen-render.ts`:
```typescript
export async function runHeyGenPipeline(
  beats: StoryBeat[],
  heygenOpts: HeyGenConfig,
  dryRun: boolean,
): Promise<void> { ... }
```
Both `render.ts` and `run.ts` call this helper. This is the pattern already used for the Remotion path via `@buildstory/video`.

---

### WR-04: `preflight.ts` re-implements validation already expressed in `HeyGenOptionsSchema`

**File:** `packages/heygen/src/preflight.ts:6-21`

**Issue:** `HeyGenOptionsSchema` already declares `apiKey: z.string().min(1)`, `avatarId: z.string().min(1)`, and `voiceId: z.string().min(1)`. `preflightHeyGenCheck` manually checks `!opts.apiKey`, `!opts.avatarId`, `!opts.voiceId` with separate error messages. This means the "what counts as invalid" rule is expressed twice. If the schema adds a new required field, `preflight.ts` will silently miss it. The messages themselves are not derivable from the schema (they include docs URLs), so some manual logic is needed, but the conditions should be driven by the Zod parse result.

**Fix:** Run `HeyGenOptionsSchema.safeParse(opts)` and map `ZodError` issues to human messages, rather than re-checking raw fields:
```typescript
const result = HeyGenOptionsSchema.safeParse(opts)
if (!result.success) {
  for (const issue of result.error.issues) {
    if (issue.path[0] === 'apiKey') failures.push('HEYGEN_API_KEY not set...')
    else if (issue.path[0] === 'avatarId') failures.push('No avatar_id configured...')
    else if (issue.path[0] === 'voiceId') failures.push('No voice_id configured...')
  }
}
```
This keeps the docs URLs while deriving conditions from a single source of truth.

---

## Info

### IN-01: `estimateHeyGenCost` has a zero-division edge case on empty `beats` array

**File:** `packages/heygen/src/cost.ts:11-25`

**Issue:** Passing an empty `beats` array is not an error — `reduce` returns `0`, `creditsRequired` becomes `Math.ceil(0) = 0`, and the cost is `$0`. This is mathematically fine, but the returned `estimatedMinutes = 0` is potentially misleading at the call site. Not a crash risk, worth noting as a contract edge case.

**Fix:** No code change required. Document in JSDoc:
```typescript
/** Returns zero-cost estimate for empty beats array. Callers should guard upstream. */
```

---

### IN-02: `run.ts` totalSteps calculation does not account for HeyGen path

**File:** `packages/cli/src/commands/run.ts:77-81`

**Issue:** The step counter formula only models "scan + narrate + TTS + render = 4" for the video path. When `renderer === 'heygen'`, the TTS and render steps do not exist, so the step numbers shown in spinners will still say `[3/4]` and `[4/4]` for unrelated future work if the HeyGen path ever reaches those steps. Currently the HeyGen path exits early (Phase 7 stub), so this is latent, not active. But when Phase 7 lands, the step numbering will be wrong for HeyGen runs.

**Fix:** Compute `totalSteps` after resolving the renderer so the formula accounts for HeyGen (scan + narrate + 1 HeyGen step = 3) vs Remotion (scan + narrate + TTS + render = 4).

---

### IN-03: `loadConfig` deep-merge does not cover all top-level keys

**File:** `packages/cli/src/config.ts:62-70`

**Issue:** The deep merge explicitly handles `scan`, `tts`, `render`, `video`, and `heygen` nested objects. Scalar top-level fields (`provider`, `style`, `outputDir`) use shallow spread (`...projectConfig` wins). If a new nested config section is added to `BuildStoryConfig` in the future, it will be shallowly merged and the global config sub-fields will silently disappear. This is a maintainability issue — the pattern will silently break the merge contract for new keys.

**Fix:** Consider a generic deep-merge utility, or add a comment flagging that all new nested keys must be explicitly added to the merge block:
```typescript
// IMPORTANT: Add new nested config keys here explicitly — spread alone is a shallow merge.
```

---

_Reviewed: 2026-04-14T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
