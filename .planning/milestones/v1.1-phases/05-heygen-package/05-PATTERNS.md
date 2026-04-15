# Phase 5: HeyGen Package - Pattern Map

**Mapped:** 2026-04-14
**Files analyzed:** 10 (7 new, 3 modified)
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/heygen/package.json` | config | — | `packages/video/package.json` | exact |
| `packages/heygen/tsup.config.ts` | config | — | `packages/core/tsup.config.ts` | exact |
| `packages/heygen/tsconfig.json` | config | — | `packages/core/tsconfig.json` | exact |
| `packages/heygen/src/types.ts` | model | — | `packages/core/src/types/story.ts` | role-match |
| `packages/heygen/src/preflight.ts` | service | request-response | `packages/video/src/preflight.ts` | exact |
| `packages/heygen/src/cost.ts` | service | transform | `packages/video/src/tts/index.ts` (`estimateTTSCost`) | exact |
| `packages/heygen/src/index.ts` | config | — | `packages/video/src/index.ts` | exact |
| `packages/cli/src/lazy.ts` | utility | request-response | `packages/cli/src/lazy.ts` (existing functions) | exact |
| `packages/cli/src/config.ts` | config | — | `packages/cli/src/config.ts` (existing) | exact |
| `packages/cli/src/commands/render.ts` | controller | request-response | `packages/cli/src/commands/render.ts` (existing) | exact |
| `packages/cli/src/commands/run.ts` | controller | request-response | `packages/cli/src/commands/run.ts` (existing) | exact |

---

## Pattern Assignments

### `packages/heygen/package.json` (config)

**Analog:** `packages/video/package.json`

**Full scaffold pattern** (`packages/video/package.json` lines 1-37):
```json
{
  "name": "@buildstory/video",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist/", "src/"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run"
  }
}
```

**Key delta for heygen:** Replace `"name": "@buildstory/video"` with `"name": "@buildstory/heygen"`. Remove all Remotion, React, canvas, openai, ffmpeg-static deps. Retain `"@buildstory/core": "workspace:*"`, `"zod": "^4.3.6"`. Add `"p-retry": "^6.2.1"`. Keep all devDependencies identical (`@types/node ^25.5.2`, `tsup ^8.5.1`, `vitest ^4.1.2`).

---

### `packages/heygen/tsup.config.ts` (config)

**Analog:** `packages/core/tsup.config.ts` (lines 1-10)

**Full pattern to copy** (`packages/core/tsup.config.ts` lines 1-10):
```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
})
```

**Key delta for heygen:** Copy verbatim. The `external` array in `packages/video/tsup.config.ts` (line 8) is video-specific (Remotion/React) — heygen has no externals that need declaration.

---

### `packages/heygen/tsconfig.json` (config)

**Analog:** `packages/core/tsconfig.json` (lines 1-10)

**Full pattern to copy** (`packages/core/tsconfig.json` lines 1-10):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "ignoreDeprecations": "6.0"
  },
  "include": ["src/**/*"]
}
```

**Key delta for heygen:** Copy verbatim. Do NOT add `"composite": true` or `"references"` — no other package in this workspace uses project references (core and video both omit them). The RESEARCH.md suggested `"references": [{ "path": "../core" }]` but the real codebase does not use this pattern.

---

### `packages/heygen/src/types.ts` (model)

**Analog:** `packages/core/src/types/story.ts` for Zod schema + inferred type pattern.

**Zod schema + type inference pattern** (`packages/core/src/types/story.ts` lines 1-2, 15-25, 40-43):
```typescript
import { z } from 'zod'

// Schema first, type inferred from schema
export const StoryBeatSchema = z.object({
  type: BeatTypeSchema,
  title: z.string(),
  summary: z.string(),
  // ...
  duration_seconds: z.number().optional(),   // optional fields use .optional()
})

export type StoryBeat = z.infer<typeof StoryBeatSchema>
```

**Apply to heygen types:**
```typescript
// packages/heygen/src/types.ts
import { z } from 'zod'

export const HeyGenOptionsSchema = z.object({
  apiKey: z.string().min(1),
  avatarId: z.string().min(1),
  voiceId: z.string().min(1),
  width: z.number().default(1280),
  height: z.number().default(720),
  speed: z.number().min(0.5).max(2.0).default(1.0),
  timeoutSeconds: z.number().default(600),
})

export type HeyGenOptions = z.infer<typeof HeyGenOptionsSchema>

// Plain interfaces for output shapes (not validated via Zod — data originates in this package)
export interface HeyGenCostEstimate {
  sceneCount: number
  estimatedMinutes: number
  creditsRequired: number
  estimatedCostUSD: number
  avatarId: string
  voiceId: string
}

export interface PreflightResult {
  ok: boolean
  failures: string[]
}
```

**Note:** `PreflightResult` is re-declared here rather than imported from `@buildstory/video` — REND-13 prohibits any import from that package.

---

### `packages/heygen/src/preflight.ts` (service, request-response)

**Analog:** `packages/video/src/preflight.ts` (lines 1-74) — exact role and data flow match.

**PreflightResult interface pattern** (`packages/video/src/preflight.ts` lines 6-9):
```typescript
export interface PreflightResult {
  ok: boolean
  failures: string[]
}
```

**Core preflight function pattern** (`packages/video/src/preflight.ts` lines 11-74):
```typescript
export async function preflightCheck(opts: {
  openaiApiKey?: string
  skipRemotionCheck?: boolean
}): Promise<PreflightResult> {
  const failures: string[] = []

  // Each check: push to failures array, never throw
  if (!opts.openaiApiKey) {
    failures.push(
      'OPENAI_API_KEY not set. Required for TTS audio generation.'
    )
  }

  return { ok: failures.length === 0, failures }
}
```

**Apply to heygen preflight:**
- Function signature: `preflightHeyGenCheck(opts: HeyGenOptions): Promise<PreflightResult>`
- Check 1: `opts.apiKey` absent → push `'HEYGEN_API_KEY not set. Required for --renderer=heygen.'`
- Check 2: `opts.avatarId` absent → push exact D-06 message: `'No avatar_id configured. See https://docs.heygen.com/reference/list-avatars-v2 for available avatars.'`
- Check 3: `opts.voiceId` absent → push `'No voice_id configured. See https://docs.heygen.com/reference/list-voices-v2 for available voices.'`
- Return: `{ ok: failures.length === 0, failures }` — identical to analog

**No system binary checks** (no ffprobe, no Chrome) — heygen is HTTP-only.

---

### `packages/heygen/src/cost.ts` (service, transform)

**Analog:** `packages/video/src/tts/index.ts` `estimateTTSCost` function (lines 9-18).

**Cost estimation pattern** (`packages/video/src/tts/index.ts` lines 9-18):
```typescript
const TTS_COST_PER_1000_CHARS = 0.015

export function estimateTTSCost(beats: StoryBeat[]): TTSCostEstimate {
  const totalCharacters = beats.reduce((sum, b) => sum + b.summary.length, 0)
  return {
    totalCharacters,
    estimatedCostUSD: (totalCharacters / 1000) * TTS_COST_PER_1000_CHARS,
    sceneCount: beats.length,
  }
}
```

**Key delta for heygen cost:**
- Input: `beats: StoryBeat[]` + `opts: HeyGenOptions` (need avatarId/voiceId for return value)
- Duration source: prefer `beat.duration_seconds` (optional field, `packages/core/src/types/story.ts` line 24: `duration_seconds: z.number().optional()`); fall back to word-count heuristic `(words / 150) * 60` — the `undefined` path must be handled explicitly to avoid `NaN` (see Pitfall 4)
- Cost constants: `CREDITS_PER_MINUTE = 1`, `USD_PER_CREDIT = 0.99`
- Return `HeyGenCostEstimate` (not `TTSCostEstimate`)

```typescript
import type { StoryBeat } from '@buildstory/core'
import type { HeyGenOptions, HeyGenCostEstimate } from './types.js'

const CREDITS_PER_MINUTE = 1
const USD_PER_CREDIT = 0.99

export function estimateHeyGenCost(
  beats: StoryBeat[],
  opts: HeyGenOptions,
): HeyGenCostEstimate {
  const totalSeconds = beats.reduce((sum, b) => {
    if (b.duration_seconds !== undefined) return sum + b.duration_seconds
    const words = b.summary.split(/\s+/).length
    return sum + (words / 150) * 60
  }, 0)
  const estimatedMinutes = totalSeconds / 60
  const creditsRequired = Math.ceil(estimatedMinutes * CREDITS_PER_MINUTE)
  return {
    sceneCount: beats.length,
    estimatedMinutes,
    creditsRequired,
    estimatedCostUSD: creditsRequired * USD_PER_CREDIT,
    avatarId: opts.avatarId,
    voiceId: opts.voiceId,
  }
}
```

---

### `packages/heygen/src/index.ts` (config)

**Analog:** `packages/video/src/index.ts` (lines 1-8) — exact barrel export pattern.

**Barrel export pattern** (`packages/video/src/index.ts` lines 1-8):
```typescript
export { orchestrateTTS, estimateTTSCost } from './tts/index.js'
export { preflightCheck } from './preflight.js'
export { renderVideo } from './render/index.js'
export type { PreflightResult } from './preflight.js'
export type { TTSOptions, SceneAudio, AudioManifest, TTSCostEstimate } from './tts/types.js'
```

**Apply to heygen index:**
```typescript
// packages/heygen/src/index.ts
export { preflightHeyGenCheck } from './preflight.js'
export { estimateHeyGenCost } from './cost.js'
export type { HeyGenOptions, HeyGenCostEstimate, PreflightResult } from './types.js'
```

**Pattern notes:** `.js` extensions on all imports (NodeNext module resolution requirement — matches existing packages). Separate `export` and `export type` lines.

---

### `packages/cli/src/lazy.ts` — add `ensureHeyGenPackage()` (utility)

**Analog:** Existing `ensureVideoPackage()` / `detectVideoPackage()` in `packages/cli/src/lazy.ts` (lines 1-44).

**Full existing pattern** (`packages/cli/src/lazy.ts` lines 1-44):
```typescript
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'

export async function detectVideoPackage(): Promise<boolean> {
  try {
    await import('@buildstory/video')
    return true
  } catch {
    return false
  }
}

async function askYesNo(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() !== 'n')
    })
  })
}

export async function ensureVideoPackage(): Promise<void> {
  const installed = await detectVideoPackage()
  if (installed) return

  const proceed = await askYesNo(
    'Video rendering requires ~200MB of dependencies. Install now? [Y/n] ',
  )
  if (!proceed) {
    console.log('Skipping video install. Use --skip-video for text-only output.')
    process.exit(0)
  }

  console.log('Installing @buildstory/video dependencies...')
  const result = spawnSync('pnpm', ['install', '--filter', '@buildstory/video'], {
    stdio: 'inherit',
    cwd: process.cwd(),
  })
  if (result.status !== 0) {
    console.error('Failed to install video dependencies.')
    process.exit(1)
  }
}
```

**Critical constraint:** `askYesNo` is NOT exported (line 13: `async function askYesNo`). New functions must be added to this same file to share the private helper — do not attempt to import `askYesNo` from another module.

**New functions to append to the same file:**
```typescript
export async function detectHeyGenPackage(): Promise<boolean> {
  try {
    await import('@buildstory/heygen')
    return true
  } catch {
    return false
  }
}

export async function ensureHeyGenPackage(): Promise<void> {
  const installed = await detectHeyGenPackage()
  if (installed) return

  const proceed = await askYesNo(
    'HeyGen renderer requires installing @buildstory/heygen. Install now? [Y/n] ',
  )
  if (!proceed) {
    console.log('Skipping HeyGen install.')
    process.exit(0)
  }

  console.log('Installing @buildstory/heygen...')
  const result = spawnSync('pnpm', ['install', '--filter', '@buildstory/heygen'], {
    stdio: 'inherit',
    cwd: process.cwd(),
  })
  if (result.status !== 0) {
    console.error('Failed to install @buildstory/heygen.')
    process.exit(1)
  }
}
```

---

### `packages/cli/src/config.ts` — extend `BuildStoryConfig` (config)

**Analog:** `packages/cli/src/config.ts` existing interface and `loadConfig` (lines 6-62).

**Interface extension pattern** (`packages/cli/src/config.ts` lines 6-24):
```typescript
export interface BuildStoryConfig {
  provider?: 'anthropic' | 'openai'
  style?: 'technical' | 'overview' | 'retrospective' | 'pitch' | 'story'
  outputDir?: string
  scan?: {
    patterns?: string[]
    excludes?: string[]
    maxDepth?: number
  }
  tts?: {
    voice?: string
    speed?: number
    concurrency?: number
  }
  render?: {
    titleCard?: boolean
    statsCard?: boolean
  }
}
```

**Add two new optional sections** to the interface (after `render`):
```typescript
  video?: {
    renderer?: 'remotion' | 'heygen'
  }
  heygen?: {
    avatarId?: string
    voiceId?: string
  }
```

**Deep merge pattern** (`packages/cli/src/config.ts` lines 54-61):
```typescript
return {
  ...globalConfig,
  ...projectConfig,
  scan: { ...globalConfig.scan, ...projectConfig.scan },
  tts: { ...globalConfig.tts, ...projectConfig.tts },
  render: { ...globalConfig.render, ...projectConfig.render },
}
```

**Extend the return block** — add both new sections or the project config will silently overwrite the global config (Pitfall 1):
```typescript
  video: { ...globalConfig.video, ...projectConfig.video },
  heygen: { ...globalConfig.heygen, ...projectConfig.heygen },
```

---

### `packages/cli/src/commands/render.ts` — add renderer dispatch (controller, request-response)

**Analog:** `packages/cli/src/commands/render.ts` existing render flow (lines 1-105).

**Imports pattern** (`packages/cli/src/commands/render.ts` lines 1-8):
```typescript
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, dirname, basename } from 'node:path'
import chalk from 'chalk'
import ora from 'ora'
import type { StoryArc } from '@buildstory/core'
import { StoryArcSchema } from '@buildstory/core'
import { loadConfig } from '../config.js'
import { ensureVideoPackage } from '../lazy.js'
```

**Add to imports:** `import { ensureHeyGenPackage } from '../lazy.js'` (or extend existing import).

**Renderer resolution:** read `opts.renderer` (new CLI flag) first, then `config.video?.renderer`, then default `'remotion'`:
```typescript
const renderer = opts.renderer ?? config.video?.renderer ?? 'remotion'
```

**Existing preflight + cost + dry-run pattern** (`packages/cli/src/commands/render.ts` lines 35-61):
```typescript
// Lazy install check (REND-10, D-10)
await ensureVideoPackage()

// Dynamic import after install confirmed
const video = await import('@buildstory/video')

// Preflight (REND-11, D-12)
const openaiKey = process.env['OPENAI_API_KEY'] ?? ''
const preflight = await video.preflightCheck({ openaiApiKey: openaiKey })
if (!preflight.ok) {
  console.error(chalk.red('\n  Preflight check failed:\n'))
  preflight.failures.forEach((f: string) => console.error(chalk.red(`    - ${f}`)))
  console.error()
  process.exit(1)
}

// TTS cost estimate (REND-03, D-16)
const costEstimate = video.estimateTTSCost(storyArc.beats)
console.log(
  chalk.dim(
    `  Generating audio for ${costEstimate.sceneCount} scenes (~$${costEstimate.estimatedCostUSD.toFixed(2)} estimated)\n`,
  ),
)

if (opts.dryRun) {
  console.log(chalk.yellow('  --dry-run: Skipping TTS and render. Cost estimate above.\n'))
  return
}
```

**HeyGen branch mirrors this pattern exactly** — same structure, different function calls and output format per D-04:
```typescript
if (renderer === 'heygen') {
  await ensureHeyGenPackage()
  const heygen = await import('@buildstory/heygen')

  const heygenOpts = {
    apiKey: process.env['HEYGEN_API_KEY'] ?? '',
    avatarId: config.heygen?.avatarId ?? '',
    voiceId: config.heygen?.voiceId ?? '',
  }

  const preflight = await heygen.preflightHeyGenCheck(heygenOpts)
  if (!preflight.ok) {
    console.error(chalk.red('\n  Preflight check failed:\n'))
    preflight.failures.forEach((f: string) => console.error(chalk.red(`    - ${f}`)))
    console.error()
    process.exit(1)
  }

  const cost = heygen.estimateHeyGenCost(storyArc.beats, heygenOpts)
  console.log(
    chalk.dim(
      `  ${cost.sceneCount} scenes | avatar: ${cost.avatarId} | ~${cost.creditsRequired} credits (~$${cost.estimatedCostUSD.toFixed(2)} estimated)\n`
    )
  )

  if (opts.dryRun) {
    console.log(chalk.yellow('  --dry-run: Skipping HeyGen submission.\n'))
    return
  }

  // Phase 7: renderHeyGen() will go here
  console.error(chalk.red('  HeyGen video submission not yet implemented (Phase 7).'))
  process.exit(1)

} else {
  // Existing Remotion path — wrap current body in this else branch, unchanged
}
```

**Function signature change:** add `renderer?: string` to the `opts` parameter object.

---

### `packages/cli/src/commands/run.ts` — add renderer dispatch (controller, request-response)

**Analog:** `packages/cli/src/commands/run.ts` video pipeline block (lines 128-192).

**Existing video pipeline block pattern** (`packages/cli/src/commands/run.ts` lines 128-156):
```typescript
if (!skipVideo) {
  // Lazy install check (REND-10, D-10)
  await ensureVideoPackage()

  // Dynamic import after install confirmed
  const video = await import('@buildstory/video')

  // Preflight check (REND-11, D-12)
  const openaiKey = process.env['OPENAI_API_KEY'] ?? ''
  const preflight = await video.preflightCheck({ openaiApiKey: openaiKey })
  if (!preflight.ok) {
    console.error(chalk.red('\n  Preflight check failed:\n'))
    preflight.failures.forEach((f: string) => console.error(chalk.red(`    - ${f}`)))
    console.error()
    process.exit(1)
  }

  // TTS cost estimate (REND-03, D-16)
  const costEstimate = video.estimateTTSCost(arc.beats)
  console.log(...)

  if (opts.dryRun) {
    console.log(chalk.yellow('  --dry-run: Skipping TTS and render. Cost estimate above.\n'))
    return
  }
  // ... TTS and render steps
}
```

**Change required:** Inside the `if (!skipVideo)` block, add the same renderer resolution and if/else dispatch that `render.ts` gets. The HeyGen branch in `run.ts` ends with the same "not yet implemented" error (same Phase 5 boundary). The Remotion path is unchanged.

**Function signature change:** add `renderer?: string` to the `opts` parameter object of `run()`.

---

## Shared Patterns

### Dynamic Import After Lazy Install
**Source:** `packages/cli/src/commands/render.ts` lines 35-38 and `packages/cli/src/commands/run.ts` lines 130-133
**Apply to:** Both `render.ts` and `run.ts` HeyGen dispatch branches
```typescript
await ensureHeyGenPackage()
const heygen = await import('@buildstory/heygen')
```
Dynamic import is always after the ensure check. The package import uses the bare specifier — pnpm workspace resolves it.

### API Key From Environment Only
**Source:** `packages/cli/src/commands/render.ts` line 41 and `packages/cli/src/commands/run.ts` lines 136, 51-55
**Apply to:** HeyGen API key resolution in render.ts and run.ts
```typescript
const openaiKey = process.env['OPENAI_API_KEY'] ?? ''
```
Pattern: always `process.env['KEY_NAME'] ?? ''` — the empty string fallback lets preflight detect the missing key and produce an actionable error rather than crashing.

### Preflight Failure Display
**Source:** `packages/cli/src/commands/render.ts` lines 43-48
**Apply to:** HeyGen preflight failure handling in render.ts and run.ts
```typescript
if (!preflight.ok) {
  console.error(chalk.red('\n  Preflight check failed:\n'))
  preflight.failures.forEach((f: string) => console.error(chalk.red(`    - ${f}`)))
  console.error()
  process.exit(1)
}
```
Identical structure for both Remotion and HeyGen branches.

### Dry-Run Exit
**Source:** `packages/cli/src/commands/render.ts` lines 58-61
**Apply to:** HeyGen dry-run exit in render.ts and run.ts
```typescript
if (opts.dryRun) {
  console.log(chalk.yellow('  --dry-run: Skipping TTS and render. Cost estimate above.\n'))
  return
}
```
HeyGen version changes the message text but keeps the same `chalk.yellow` + `return` structure (D-08).

### Barrel Export With `.js` Extensions
**Source:** `packages/video/src/index.ts` lines 1-8
**Apply to:** `packages/heygen/src/index.ts`
```typescript
export { preflightCheck } from './preflight.js'
export type { PreflightResult } from './preflight.js'
```
NodeNext module resolution (`packages/tsconfig.base.json` line 4: `"moduleResolution": "NodeNext"`) requires `.js` extensions on all relative imports, even for `.ts` source files.

### Zod Schema Then Inferred Type
**Source:** `packages/core/src/types/story.ts` lines 15-25, 40-43
**Apply to:** `packages/heygen/src/types.ts` `HeyGenOptionsSchema`
```typescript
export const HeyGenOptionsSchema = z.object({ ... })
export type HeyGenOptions = z.infer<typeof HeyGenOptionsSchema>
```
Public interface types use Zod schemas. Internal output shapes (return values that originate inside the package) use plain `interface`.

---

## No Analog Found

All files have close analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `packages/cli/src/`, `packages/video/src/`, `packages/core/src/`
**Files read:** 14 (lazy.ts, config.ts, render.ts, run.ts, video/preflight.ts, video/tts/index.ts, video/index.ts, video/package.json, video/tsup.config.ts, video/tsconfig.json, core/tsup.config.ts, core/tsconfig.json, tsconfig.base.json, core/types/story.ts)
**Pattern extraction date:** 2026-04-14

### Codebase Corrections to RESEARCH.md Patterns

These RESEARCH.md patterns differ from the real codebase — planner must use codebase versions:

| RESEARCH.md Claim | Real Codebase |
|-------------------|---------------|
| `tsconfig.json` uses `"composite": true` and `"references"` | No existing package uses project references — `core` and `video` both omit these fields |
| `tsconfig.json` uses `"include": ["src"]` | Real pattern is `"include": ["src/**/*"]` (core) or `"include": ["src"]` (video) — use `["src/**/*"]` to match core |
| `"rootDir": "src"` missing from suggested tsconfig | Both `core` and `video` include `"rootDir": "src"` in compilerOptions |
| `tsup.config.ts` includes `sourcemap: true` in research | Real `core` tsup config includes `sourcemap: true`; `video` omits it — include it for heygen (matches core) |
