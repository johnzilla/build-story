---
phase: 04-renderer
reviewed: 2026-04-06T00:00:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - packages/core/src/types/story.ts
  - packages/core/src/types/options.ts
  - packages/core/src/narrate/prompts/system.ts
  - packages/core/src/narrate/index.ts
  - packages/core/src/index.ts
  - packages/video/src/index.ts
  - packages/video/src/preflight.ts
  - packages/video/src/tts/generate.ts
  - packages/video/src/tts/measure.ts
  - packages/video/src/tts/index.ts
  - packages/video/src/tts/types.ts
  - packages/video/src/render/index.ts
  - packages/video/src/render/srt.ts
  - packages/video/src/render/composition/index.ts
  - packages/video/src/render/composition/Root.tsx
  - packages/video/src/render/composition/BuildStory.tsx
  - packages/video/src/render/composition/types.ts
  - packages/video/src/render/composition/scenes/TitleCard.tsx
  - packages/video/src/render/composition/scenes/TimelineBar.tsx
  - packages/video/src/render/composition/scenes/DecisionCallout.tsx
  - packages/video/src/render/composition/scenes/StatsCard.tsx
  - packages/cli/src/commands/render.ts
  - packages/cli/src/commands/run.ts
  - packages/cli/src/index.ts
  - packages/cli/src/config.ts
  - packages/cli/src/lazy.ts
findings:
  critical: 0
  warning: 7
  info: 5
  total: 12
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-04-06
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

This review covers the Phase 4 renderer — the `@buildstory/video` package (preflight, TTS, Remotion composition, render orchestration) and the updated CLI commands (`render`, `run`). The code is well-structured overall, with clean separation between TTS orchestration, Remotion composition, and CLI coordination. The Zod validation pattern is applied correctly at the right boundaries.

Seven warnings were found, all of which can cause incorrect runtime behavior or user-visible failures. None are security issues. The five info items cover dead code, missing input validation, and minor defensive gaps. No critical issues were found.

Key concerns to address before shipping:

1. `resolveCompositionEntry()` contains a dead branch that makes both code paths identical — the dist vs. src distinction is erased. This could cause the Remotion bundler to fail at the wrong path in production.
2. `generateSRT` uses non-null assertion on array access that is mismatched with the input lengths at the call site.
3. The `which` trick used to detect system Chrome paths in preflight does not work on Windows and silently fails on some Linux setups, leaving `chromeFound = false` incorrectly.
4. The `--no-title-card` and `--no-stats-card` flags are accepted by the CLI but never passed into or used by the composition, making those options dead.

---

## Warnings

### WR-01: `resolveCompositionEntry` — both branches of the dist/src check produce the same path

**File:** `packages/video/src/render/index.ts:31-35`

**Issue:** The comment says "When running from dist/render/index.js, go up to package root then into src/" vs. "When running from src/render/index.ts, path is already in src/". But both branches execute exactly the same expression: `path.resolve(thisDir, '../../')`. The `thisDir.includes('/dist/')` check is dead — neither branch is actually different. After tsup bundles `src/render/index.ts` → `dist/render/index.js`, `thisDir` will be `…/dist/render`, so `path.resolve(thisDir, '../../')` goes to the package root, and then `src/render/composition/index.ts` is appended — which is correct for production. When running under ts-node from `src/render/`, `thisDir` is `…/src/render`, so `path.resolve(thisDir, '../../')` also goes to the package root, and the same suffix is appended — also correct. The bug is that this was clearly intended to have two different offsets but was written identically, masking any future divergence if the dist layout changes.

**Fix:** Either remove the branch (the logic is the same in both cases and happens to work), or make the intent explicit:
```typescript
function resolveCompositionEntry(): string {
  const thisFile = fileURLToPath(import.meta.url)
  const thisDir = path.dirname(thisFile)
  // Both dist/render/ and src/render/ are two levels below the package root.
  const packageRoot = path.resolve(thisDir, '../../')
  return path.resolve(packageRoot, 'src/render/composition/index.ts')
}
```

---

### WR-02: `generateSRT` — non-null assertion on `scenes[i]` can crash when beats and scenes have mismatched lengths

**File:** `packages/video/src/render/srt.ts:7`

**Issue:** `scenes[i]!` suppresses the undefined check. In `renderVideo` (render/index.ts:81), `generateSRT` is called with `storyArc.beats` and `audioManifest.scenes`. These arrays should be the same length — one `SceneAudio` per beat — but nothing enforces this contract. If `orchestrateTTS` produces fewer scenes than beats (e.g., one TTS call threw and was silently swallowed, though currently it rethrows), or if `storyArc.beats` is longer because a caller passed a different arc, `scenes[i]` is `undefined` and the non-null assertion causes a runtime crash with a misleading error.

**Fix:** Replace the assertion with a length guard at the start of `generateSRT`:
```typescript
export function generateSRT(beats: StoryBeat[], scenes: SceneAudio[]): string {
  if (beats.length !== scenes.length) {
    throw new Error(
      `generateSRT: beats.length (${beats.length}) !== scenes.length (${scenes.length}). Audio manifest must have one scene per beat.`
    )
  }
  const nodes = beats.map((beat, i) => {
    const scene = scenes[i]! // safe: lengths verified above
    ...
  })
  ...
}
```

---

### WR-03: Chrome detection in preflight uses `which` — wrong tool for detecting executable paths, breaks on Windows and some Linux configurations

**File:** `packages/video/src/preflight.ts:51-57`

**Issue:** The code calls `execFileAsync('which', [candidate])` to probe system Chrome paths. `which` only resolves names that appear in `PATH` — it cannot confirm that `candidate` is a path to a file, only that a name is on PATH. More importantly, `which` does not exist on Windows, causing `execFileAsync` to throw and the `catch` block to absorb the error, resulting in `chromeFound = false` even when Chrome is present. On macOS and Linux this mostly works for bare names like `google-chrome`, but the outer loop also iterates `chromeCandidates` (which could be full absolute paths like `/usr/bin/chromium`), and `which /usr/bin/chromium` will fail even if the file exists.

**Fix:** For full paths from env vars, use `fs.access` to test the file directly; use `which` only for bare names:
```typescript
import { access } from 'node:fs/promises'

for (const candidate of chromeCandidates) {
  try {
    await access(candidate) // full path — check file exists
    chromeFound = true
    break
  } catch { /* not accessible */ }
}

if (!chromeFound) {
  for (const name of systemPaths) {
    try {
      await execFileAsync('which', [name])
      chromeFound = true
      break
    } catch { /* not found */ }
  }
}
```

---

### WR-04: `--no-title-card` and `--no-stats-card` CLI flags are parsed but never used

**File:** `packages/cli/src/commands/render.ts:13-17`, `packages/cli/src/commands/run.ts:34-37`

**Issue:** Both `renderCommand` and `run` accept `noTitleCard` and `noStatsCard` in their opts objects. These options are registered in the CLI (`packages/cli/src/index.ts:28-29, 62-63`). However, neither command ever passes them to `orchestrateTTS`, `renderVideo`, or the Remotion composition. The composition (`BuildStory.tsx`) hard-codes the `isFirst`/`isLast`/`isStats` logic with no way to override it. The flags are entirely inert — users who pass `--no-title-card` will get a title card anyway, with no warning.

**Fix:** Either wire the flags through to `BuildStoryInputProps` and honor them in `BuildStoryComposition`, or remove them from the CLI until they are implemented. Leaving dead options in a CLI is misleading:
```typescript
// Option A: Remove from CLI until implemented
// Option B: Pass through and guard in composition
// In BuildStory.tsx:
const isFirst = i === 0 && !props.showTitleCards === false
```
At minimum, print a warning if either flag is passed:
```typescript
if (opts.noTitleCard || opts.noStatsCard) {
  console.warn(chalk.yellow('  Warning: --no-title-card and --no-stats-card are not yet implemented.\n'))
}
```

---

### WR-05: TTS retry loop never actually retries on rate-limit — the backoff fires but on the last attempt only the error is rethrown, not retried

**File:** `packages/video/src/tts/generate.ts:28-47`

**Issue:** The retry logic structure is:
```
attempt 1: request fails with 429 → isRateLimitError → sleep(2s) → loop continues → attempt 2
attempt 2: request fails with 429 → isRateLimitError → sleep(4s) → loop continues → attempt 3
attempt 3: request fails (any error) → attempt === MAX_ATTEMPTS → throw err (no sleep, no retry)
```
This is actually correct for the retry logic itself. However, on a non-rate-limit error on attempt 1 or 2, the code hits `throw err` in the inner else branch and exits immediately — which is correct. The problem is subtler: if a rate-limit error occurs on attempt 3, the `attempt === MAX_ATTEMPTS` check runs first and throws before the rate-limit check, so the sleep is never reached and the error message to the user does not distinguish "exhausted retries on rate limit" from a plain API error. This is a low-severity variant but the ordering matters.

**Fix:** Restructure to check `attempt < MAX_ATTEMPTS` before the rate-limit branch for clarity, and add a descriptive rethrow:
```typescript
} catch (err: unknown) {
  if (attempt < MAX_ATTEMPTS && isRateLimitError(err)) {
    await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
    continue
  }
  if (attempt === MAX_ATTEMPTS && isRateLimitError(err)) {
    throw new Error(`TTS rate-limited after ${MAX_ATTEMPTS} attempts for scene text starting: "${text.slice(0, 40)}..."`)
  }
  throw err
}
```

---

### WR-06: `BuildStoryComposition` reads `audioManifest.scenes[i]` twice with different null-safety on each read

**File:** `packages/video/src/render/composition/BuildStory.tsx:36-64`

**Issue:** On line 36, `audioManifest.scenes[i]` is accessed with optional chaining (`scene?.durationSeconds`), indicating scenes can be undefined at index `i`. But on line 63, the same index is accessed with a non-null assertion inside a conditional: `audioManifest.scenes[i]!.filePath`. The `if (audioManifest.scenes[i])` guard before line 64 makes this safe in practice, but the pattern is inconsistent and the assertion is redundant after the truthiness check. More importantly, if `audioManifest.scenes` is shorter than `storyArc.beats`, the first read silently falls back to `beat.duration_seconds ?? 5` while the second read simply skips the `<Audio>` element — giving silent divergence between timing and audio without any error or warning to the user.

**Fix:** Consolidate the access into the `beatsWithFrames` map and thread the scene through:
```typescript
const beatsWithFrames = storyArc.beats.map((beat, i) => {
  const scene = audioManifest.scenes[i] // undefined if mismatched
  return {
    ...beat,
    scene, // carry it forward
    durationInFrames: Math.ceil(((scene?.durationSeconds ?? beat.duration_seconds ?? 5) + gapSeconds) * fps),
  }
})
// Then in the JSX:
{beat.scene && <Audio src={beat.scene.filePath} />}
```

---

### WR-07: `loadConfig` does not validate config shape — a bad TOML file silently produces a partial config with wrong types

**File:** `packages/cli/src/config.ts:33, 43`

**Issue:** Both `parse(readFileSync(...)) as BuildStoryConfig` casts are unsafe. The TOML is parsed to `unknown`, then cast directly to the interface without any runtime validation. If a user writes `speed = "fast"` in their `buildstory.toml` instead of a number, the cast succeeds at runtime but `ttsSpeed` becomes the string `"fast"`, which is passed as the `speed` field to the OpenAI client and causes a hard-to-debug API error. The project already uses Zod elsewhere — this is the right place to apply it.

**Fix:** Add a Zod schema for `BuildStoryConfig` and parse both config files through it:
```typescript
import { z } from 'zod'

const BuildStoryConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openai']).optional(),
  style: z.enum(['technical', 'overview', 'retrospective', 'pitch', 'story']).optional(),
  outputDir: z.string().optional(),
  scan: z.object({
    patterns: z.array(z.string()).optional(),
    excludes: z.array(z.string()).optional(),
    maxDepth: z.number().optional(),
  }).optional(),
  tts: z.object({
    voice: z.string().optional(),
    speed: z.number().optional(),
    concurrency: z.number().optional(),
  }).optional(),
  render: z.object({
    titleCard: z.boolean().optional(),
    statsCard: z.boolean().optional(),
  }).optional(),
}).passthrough() // tolerate unknown keys gracefully

// Then:
const raw = parse(readFileSync(globalPath, 'utf8'))
globalConfig = BuildStoryConfigSchema.parse(raw)
```

---

## Info

### IN-01: `replace('_', ' ')` only replaces the first underscore — `side_quest` and `open_loop` render incorrectly if they had more

**File:** `packages/video/src/render/composition/scenes/TimelineBar.tsx:37`, `packages/video/src/render/composition/scenes/DecisionCallout.tsx:57`, `packages/video/src/render/composition/scenes/StatsCard.tsx:38`

**Issue:** `beat.type.replace('_', ' ')` replaces only the first occurrence of underscore. Beat types `side_quest` and `open_loop` each have exactly one underscore, so this works today. But if a new beat type with multiple underscores is added, or if the code is copied elsewhere with that assumption, it silently mis-renders. The intent is clearly to humanize the type label for display.

**Fix:** Use `replaceAll` or a regex with the global flag:
```typescript
{beat.type.replaceAll('_', ' ')}
```

---

### IN-02: `estimateTTSCost` uses `beat.summary.length` but TTS generation uses `beat.summary` after truncation to 3900 chars — cost estimate can overstate for long summaries

**File:** `packages/video/src/tts/index.ts:12-17`

**Issue:** The cost estimate counts raw character length from `beat.summary`. The TTS generator in `generate.ts:23-25` silently truncates text that exceeds 3900 characters at the last sentence boundary. For beats with very long summaries, the estimate overstates cost. This is a minor accuracy issue, not a crash, but the discrepancy between estimated and actual cost could confuse users who pass `--dry-run` to budget their API spend.

**Fix:** Mirror the same truncation in the cost estimator:
```typescript
const MAX_TTS_CHARS = 3900
function effectiveTTSLength(text: string): number {
  if (text.length <= MAX_TTS_CHARS) return text.length
  const truncated = text.slice(0, text.lastIndexOf('.', MAX_TTS_CHARS) + 1) || text.slice(0, MAX_TTS_CHARS)
  return truncated.length
}

export function estimateTTSCost(beats: StoryBeat[]): TTSCostEstimate {
  const totalCharacters = beats.reduce((sum, b) => sum + effectiveTTSLength(b.summary), 0)
  ...
}
```

---

### IN-03: `STYLE_PROMPTS` is typed as `Record<string, string>` but should be `Record<keyof NarrateOptions['style'], string>` — mismatched key type erases type safety

**File:** `packages/core/src/narrate/prompts/system.ts:57`

**Issue:** `STYLE_PROMPTS: Record<string, string>` accepts any string key. The `buildSystemPrompt` function takes `style: keyof typeof STYLE_PROMPTS` — which resolves to `string`, defeating the purpose of having a typed style union in `NarrateOptions`. If a new style is added to `NarrateOptions` but omitted from `STYLE_PROMPTS`, TypeScript will not catch it at compile time; the runtime `undefined` check provides the only guard.

**Fix:** Narrow the type to the known style keys:
```typescript
type StyleKey = 'technical' | 'overview' | 'retrospective' | 'pitch' | 'story'

export const STYLE_PROMPTS: Record<StyleKey, string> = { ... }

export function buildSystemPrompt(
  style: StyleKey,
  timelineMetadata?: { rootDir: string; scannedAt: string },
): string { ... }
```

---

### IN-04: `withConcurrency` in `tts/index.ts` drops return order guarantee when concurrency > 1 — sort is needed but comment does not explain the race condition clearly

**File:** `packages/video/src/tts/index.ts:20-27, 57-58`

**Issue:** `withConcurrency` processes tasks in batches and `results.push(...await Promise.all(batch))`. Within a batch, `Promise.all` preserves insertion order. Across batches, the sort on line 57 is correct. However, the sort operates on `beatIndex` which is captured in the closure (`i` from the outer `beats.map`). This is correct as written, but the `rawScenes.sort` comment says "concurrency may complete out of order" — this is misleading because `withConcurrency` batches sequentially (batch N completes before batch N+1 starts), so inter-batch ordering is guaranteed. Only intra-batch ordering is non-deterministic in a theoretical async sense (though `Promise.all` preserves it). The sort is harmless redundancy — no action needed — but the comment should be clarified to avoid confusion during future maintenance.

**Fix:** Update the comment:
```typescript
// Sort by beatIndex — within each batch Promise.all preserves order,
// but we sort defensively across batches in case concurrency > 1 produces
// any out-of-order results from external I/O.
rawScenes.sort((a, b) => a.beatIndex - b.beatIndex)
```

---

### IN-05: `run.ts` line 207 — `outputs[ft] ?? ''` fallback silently writes an empty file if `format()` returns undefined

**File:** `packages/cli/src/commands/run.ts:207`

**Issue:** `outputs[ft]` was just assigned on line 203 with `outputs[ft] = await format(arc, ft, llmProvider)`. If `format()` returns `undefined` (its return type as called through the dynamic Record), the `?? ''` fallback writes an empty `.md` file without any error. The user gets a 0-byte file in their output directory with no indication that format generation failed.

**Fix:** Check the return value before writing:
```typescript
const content = outputs[ft]
if (!content) {
  console.warn(chalk.yellow(`  Warning: ${ft} format produced no output — skipping write.`))
} else {
  await writeFile(resolve(outputDir, `${ft}.md`), content)
}
```

---

_Reviewed: 2026-04-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
