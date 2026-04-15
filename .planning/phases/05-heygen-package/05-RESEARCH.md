# Phase 5: HeyGen Package - Research

**Researched:** 2026-04-14
**Domain:** TypeScript workspace package scaffold — HeyGen preflight, cost estimation, dry-run, renderer dispatch infrastructure
**Confidence:** HIGH (codebase patterns directly read; HeyGen API shapes MEDIUM from prior research; no new external queries needed — all canonical refs already researched)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use `--renderer=heygen` CLI flag and `[video] renderer = "heygen"` in `buildstory.toml` to select HeyGen. Default remains `remotion`.
- **D-02:** Simple if/else branch in `render.ts` — no plugin registry, no renderer abstraction beyond a conditional import.
- **D-03:** Same lazy-install prompt pattern as Remotion. `ensureHeyGenPackage()` mirrors `ensureVideoPackage()` in `lazy.ts`.
- **D-04:** Show both credits and USD estimate: `~5 credits (~$4.95 estimated)`. This gives users HeyGen's native billing unit alongside real cost.
- **D-05:** Use the same display position as existing TTS cost — printed before any API call, after preflight passes.
- **D-06:** Avatar and voice IDs are required configuration. If not set, preflight fails with an actionable error: "No avatar_id configured. See https://docs.heygen.com/reference/list-avatars-v2 for available avatars."
- **D-07:** No built-in default avatar/voice. Discovery commands (`list-avatars`, `list-voices`) are deferred to v1.2 — error message points to HeyGen docs/dashboard until then.
- **D-08:** Minimal output matching Remotion's pattern — just the cost estimate line. Keep `--dry-run` consistent across renderers.

### Claude's Discretion
- VideoRenderer interface shape — Claude can design the interface contract based on what both renderers need
- Package scaffold details (tsup config, tsconfig, package.json structure) — follow existing `@buildstory/video` patterns
- Zod schema design for HeyGen API responses
- Error message wording (beyond the avatar/voice discovery hint specified in D-06)

### Deferred Ideas (OUT OF SCOPE)
- Avatar/voice discovery commands (`buildstory heygen list-avatars`, `list-voices`) — deferred to v1.2 (CLI-11)
- `--avatar` and `--voice` per-run CLI flag overrides — deferred to v1.2 (CLI-10)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REND-12 | Pluggable VideoRenderer interface exists so CLI can dispatch to Remotion or HeyGen by name | VideoRenderer interface designed here; lives in CLI render.ts per ARCHITECTURE.md decision |
| REND-13 | `@buildstory/heygen` is a standalone workspace package with no imports from `@buildstory/video` | Package scaffold and boundary rules documented; zero `@buildstory/video` imports enforced |
| HGVR-01 | User can configure `HEYGEN_API_KEY` via environment variable | `process.env['HEYGEN_API_KEY']` only — never in config; preflight validates presence |
| SAFE-01 | Preflight check validates HEYGEN_API_KEY is set and valid before any API call | Preflight function mirrors existing `preflightCheck()` pattern in `@buildstory/video` |
| SAFE-02 | Cost estimation displays estimated credits and USD before submitting to HeyGen | `estimateHeyGenCost()` function; display format `~N credits (~$X.XX estimated)` |
| SAFE-03 | `--dry-run` mode shows full plan (scenes, cost, avatar, voice) without calling HeyGen API | Mirrors existing `--dry-run` in render.ts; exits after cost display |
| SAFE-04 | Missing API key or invalid configuration fails with an actionable error message | Preflight returns `{ ok: false, failures: string[] }` matching `PreflightResult` interface |
</phase_requirements>

---

## Summary

Phase 5 is a scaffold-and-safety phase. The goal is to create `packages/heygen/` as a standalone workspace package and wire up the minimum infrastructure in the CLI to select it via `--renderer=heygen`. No HeyGen API calls are made — the package establishes preflight validation, cost estimation, and dry-run support so the user understands what will happen before spending credits. Actual video generation is Phase 7.

The technical work is straightforward because the patterns already exist in the codebase: `preflightCheck()` in `@buildstory/video/src/preflight.ts` defines the `{ ok, failures }` contract; `estimateTTSCost()` in `@buildstory/video/src/tts/index.ts` defines the cost display pattern; `ensureVideoPackage()` in `packages/cli/src/lazy.ts` defines the lazy-install prompt. Phase 5 clones these patterns for the HeyGen renderer.

The only net-new design work is the `VideoRenderer` interface (Claude's discretion) and the `HeyGenOptions` / `HeyGenConfig` types. The `BuildStoryConfig` interface in `config.ts` needs `video` and `heygen` sections added. The `render.ts` command needs a renderer resolution branch. Everything else is copy-adapt from existing patterns.

**Primary recommendation:** Scaffold `packages/heygen/` with types, preflight, and cost estimation. Update CLI config and render command. The package exports nothing that calls HeyGen yet — that's Phase 7.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HEYGEN_API_KEY resolution | CLI (render.ts) | @buildstory/heygen preflight | Env var read in CLI; passed as typed value to heygen package — matches existing `openaiKey` pattern in render.ts |
| VideoRenderer interface | CLI (render.ts inline) | — | Per D-02 and ARCHITECTURE.md: two renderers do not justify a shared registry; interface defined inline in CLI |
| `ensureHeyGenPackage()` lazy install | CLI (lazy.ts) | — | Direct mirror of `ensureVideoPackage()`; install prompt lives in CLI wrapper |
| Preflight validation | @buildstory/heygen | — | Package is responsible for its own preflight; returns `PreflightResult`; CLI calls it and exits on failure |
| Cost estimation | @buildstory/heygen | — | `estimateHeyGenCost(beats)` returns credits + USD; CLI prints the formatted line |
| Dry-run output | CLI (render.ts) | — | Dry-run decision (proceed or exit) is a CLI concern; heygen package just provides the estimate |
| Config schema (`[video]`, `[heygen]`) | CLI (config.ts) | — | Config is CLI responsibility per package boundary rule; `@buildstory/heygen` never reads TOML |
| HeyGenOptions construction | CLI (render.ts) | — | CLI reads config + env → constructs typed `HeyGenOptions` → passes to heygen package |

---

## Standard Stack

### Core (for `@buildstory/heygen` package)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 6.0.2 | Language | Workspace standard — matches all other packages |
| tsup | 8.5.1 | Bundler | Zero-config CJS+ESM+dts; exact pattern used by `@buildstory/video` |
| Vitest | 4.1.2 | Test runner | Workspace standard |
| zod | 4.3.6 | Schema validation | Workspace standard; validates `HeyGenOptions` and API response shapes |
| p-retry | ^6.2.1 | Polling retry | Only new dependency; needed for Phase 7 polling loop but can be declared now in package.json |

[VERIFIED: codebase packages/video/package.json — tsup 8.5.1, vitest 4.1.2, zod 4.3.6 confirmed in workspace]

### What `@buildstory/heygen` Must NOT Import

| Package | Reason |
|---------|--------|
| `@buildstory/video` | REND-13: zero imports; would transitively pull in Remotion (~200MB) |
| `remotion`, `@remotion/*` | Same reason |
| `canvas`, `sharp` | No frame generation — HeyGen renders server-side |
| `openai` | HeyGen has built-in TTS; OpenAI not needed in this package |
| `fluent-ffmpeg`, `ffmpeg-static` | No local assembly — HeyGen returns a finished MP4 URL |
| `smol-toml` | Config parsing is CLI responsibility |

[VERIFIED: ARCHITECTURE.md Anti-Pattern 2, PITFALLS.md Pitfall 16 — package boundary enforced]

### Installation

```bash
# Create package directory
mkdir -p packages/heygen/src

# heygen package dependencies
pnpm add --filter @buildstory/heygen zod@^4 p-retry@^6

# heygen package devDependencies
pnpm add -D --filter @buildstory/heygen @types/node tsup vitest

# CLI additions (no new packages — chalk, ora, commander already declared)
# Just code changes to packages/cli
```

---

## Architecture Patterns

### System Architecture Diagram

```
buildstory CLI (render.ts)
        │
        ├─ resolve renderer: "heygen" vs "remotion" (--renderer flag or [video] renderer in toml)
        │
        ├─ [renderer = remotion] ──────────────────────────────────────────────────────────────┐
        │    ensureVideoPackage() → dynamic import('@buildstory/video')                       │
        │    preflightCheck() → estimateTTSCost() → orchestrateTTS() → renderVideo()          │
        │                                                                             [EXISTING]
        │
        └─ [renderer = heygen] ────────────────────────────────────────────────────────────────┐
             ensureHeyGenPackage() [lazy.ts]                                                   │
             dynamic import('@buildstory/heygen')                                              │
                     │                                                                         │
                     ▼                                                                         │
             preflightHeyGenCheck(HeyGenConfig)                                                │
                     │  checks: HEYGEN_API_KEY present, avatar_id set, voice_id set           │
                     │  returns { ok, failures }                                               │
                     │  on failure → print failures + exit(1)                                  │
                     │                                                                         │
                     ▼                                                                         │
             estimateHeyGenCost(beats, HeyGenConfig)                                           │
                     │  returns { credits, estimatedUSD, sceneCount, avatarId, voiceId }       │
                     │  CLI prints: "~N credits (~$X.XX estimated)"                            │
                     │                                                                         │
                     ▼                                                                         │
             if --dry-run → print plan + exit(0)                    [PHASE 5 BOUNDARY]         │
                                                                                               │
             [Phase 7 will continue here: renderHeyGen() → poll → download]               [NEW]
```

### Recommended Project Structure

```
packages/heygen/
├── src/
│   ├── types.ts        # HeyGenOptionsSchema, HeyGenOptions, HeyGenConfig, HeyGenCostEstimate, PreflightResult
│   ├── preflight.ts    # preflightHeyGenCheck(HeyGenConfig) — returns PreflightResult
│   ├── cost.ts         # estimateHeyGenCost(beats, HeyGenConfig) — credits + USD
│   └── index.ts        # exports: preflightHeyGenCheck, estimateHeyGenCost, types
├── package.json        # @buildstory/heygen 0.1.0
├── tsup.config.ts      # mirrors @buildstory/video tsup config
└── tsconfig.json       # references ../core; composite: true

packages/cli/src/
├── commands/
│   └── render.ts       # ADD: renderer resolution branch (if/else heygen vs remotion)
├── config.ts           # ADD: video?: { renderer? }, heygen?: { avatarId?, voiceId? }
└── lazy.ts             # ADD: ensureHeyGenPackage(), detectHeyGenPackage()
```

### Pattern 1: PreflightResult Shape (copy from `@buildstory/video`)

**What:** Both renderers return the same `{ ok: boolean; failures: string[] }` shape. CLI code that checks preflight results works identically for both renderers.

**When to use:** Any validation that must fail fast before API calls. Used for API key presence, avatar_id/voice_id presence.

```typescript
// packages/heygen/src/preflight.ts
// Source: mirrors packages/video/src/preflight.ts (VERIFIED: read directly)

export interface PreflightResult {
  ok: boolean
  failures: string[]
}

export async function preflightHeyGenCheck(opts: HeyGenConfig): Promise<PreflightResult> {
  const failures: string[] = []

  if (!opts.apiKey) {
    failures.push(
      'HEYGEN_API_KEY not set. Required for --renderer=heygen.'
    )
  }

  if (!opts.avatarId) {
    failures.push(
      'No avatar_id configured. See https://docs.heygen.com/reference/list-avatars-v2 for available avatars.'
    )
  }

  if (!opts.voiceId) {
    failures.push(
      'No voice_id configured. See https://docs.heygen.com/reference/list-voices-v2 for available voices.'
    )
  }

  return { ok: failures.length === 0, failures }
}
```

[VERIFIED: packages/video/src/preflight.ts read directly — `{ ok, failures }` pattern confirmed]

### Pattern 2: Cost Estimation (mirrors `estimateTTSCost`)

**What:** Returns an object with the cost figures; CLI formats and prints. The heygen package never calls `console.log` — it returns data, CLI displays it.

**When to use:** Called in render.ts immediately after preflight passes, before dry-run check.

```typescript
// packages/heygen/src/cost.ts
// Source: mirrors packages/video/src/tts/index.ts estimateTTSCost() (VERIFIED: read directly)

export interface HeyGenCostEstimate {
  sceneCount: number
  estimatedMinutes: number
  creditsRequired: number
  estimatedCostUSD: number
  avatarId: string
  voiceId: string
}

// Cost model: 1 credit = 1 minute of standard avatar video, ~$0.99/credit
const CREDITS_PER_MINUTE = 1
const USD_PER_CREDIT = 0.99

export function estimateHeyGenCost(
  beats: StoryBeat[],
  opts: HeyGenConfig
): HeyGenCostEstimate {
  // Use duration_seconds if present; fall back to word-count estimate (150 wpm)
  const totalSeconds = beats.reduce((sum, b) => {
    if (b.duration_seconds) return sum + b.duration_seconds
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

[VERIFIED: cost model from STACK.md §v1.1 Addendum HeyGen API Pricing; duration_seconds optional field confirmed in packages/core/src/types/story.ts]

### Pattern 3: VideoRenderer Interface in render.ts

**What:** A minimal interface defined inline in CLI render.ts. Not in `@buildstory/core` (core must stay free of rendering concerns). Allows the dry-run and cost-display code paths to be written once.

**When to use:** The if/else branch in render.ts uses this interface shape implicitly — it's a type annotation, not a registry.

```typescript
// packages/cli/src/commands/render.ts (inline interface per D-02 and ARCHITECTURE.md)
// Source: ARCHITECTURE.md §Renderer Interface Contract (VERIFIED: read directly)

interface VideoRenderer {
  readonly name: string
  preflight(opts: unknown): Promise<{ ok: boolean; failures: string[] }>
  estimateCost(beats: StoryBeat[]): { label: string; creditsRequired?: number; estimatedCostUSD?: number }
}
```

### Pattern 4: Lazy Install for `@buildstory/heygen`

**What:** `ensureHeyGenPackage()` mirrors `ensureVideoPackage()` exactly. Prompt message differs (no Remotion/Chrome weight — HeyGen is HTTP-only, package is small).

```typescript
// packages/cli/src/lazy.ts — new function (mirrors ensureVideoPackage)
// Source: packages/cli/src/lazy.ts read directly (VERIFIED)

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

[VERIFIED: packages/cli/src/lazy.ts read directly — `askYesNo` is a private function in that file; reuse it]

### Pattern 5: Renderer Dispatch in render.ts

**What:** Simple if/else after lazy install. No registry. Resolves renderer from CLI flag first, then config, then default.

```typescript
// packages/cli/src/commands/render.ts additions
// Source: ARCHITECTURE.md §CLI Integration Points (VERIFIED)

const renderer = opts.renderer ?? config.video?.renderer ?? 'remotion'

if (renderer === 'heygen') {
  await ensureHeyGenPackage()
  const heygen = await import('@buildstory/heygen')

  const apiKey = process.env['HEYGEN_API_KEY'] ?? ''
  // HeyGenConfig (z.input type) -- defaulted fields (width, height, speed, timeoutSeconds) are optional
  const heygenOpts = {
    apiKey,
    avatarId: config.heygen?.avatarId ?? '',
    voiceId: config.heygen?.voiceId ?? '',
  }

  // Preflight (SAFE-01, SAFE-04)
  const preflight = await heygen.preflightHeyGenCheck(heygenOpts)
  if (!preflight.ok) {
    console.error(chalk.red('\n  Preflight check failed:\n'))
    preflight.failures.forEach((f: string) => console.error(chalk.red(`    - ${f}`)))
    console.error()
    process.exit(1)
  }

  // Cost estimate (SAFE-02, D-04)
  const cost = heygen.estimateHeyGenCost(storyArc.beats, heygenOpts)
  console.log(
    chalk.dim(
      `  ${cost.sceneCount} scenes | avatar: ${cost.avatarId} | ~${cost.creditsRequired} credits (~$${cost.estimatedCostUSD.toFixed(2)} estimated)\n`
    )
  )

  // Dry-run exit (SAFE-03, D-08)
  if (opts.dryRun) {
    console.log(chalk.yellow('  --dry-run: Skipping HeyGen submission.\n'))
    return
  }

  // Phase 7: renderHeyGen() will go here
  console.error(chalk.red('  HeyGen video submission not yet implemented (Phase 7).'))
  process.exit(1)

} else {
  // Existing Remotion path — unchanged
  await ensureVideoPackage()
  // ... existing code ...
}
```

### Pattern 6: Config Schema Extension

**What:** Add `video` and `heygen` sections to `BuildStoryConfig`. Deep merge must be extended to include these new nested objects.

```typescript
// packages/cli/src/config.ts additions
// Source: packages/cli/src/config.ts read directly (VERIFIED — current interface shown)

export interface BuildStoryConfig {
  // ... existing fields unchanged ...
  video?: {
    renderer?: 'remotion' | 'heygen'
  }
  heygen?: {
    avatarId?: string
    voiceId?: string
  }
}

// In loadConfig() return, extend the deep merge:
return {
  ...globalConfig,
  ...projectConfig,
  scan: { ...globalConfig.scan, ...projectConfig.scan },
  tts: { ...globalConfig.tts, ...projectConfig.tts },
  render: { ...globalConfig.render, ...projectConfig.render },
  video: { ...globalConfig.video, ...projectConfig.video },    // ADD
  heygen: { ...globalConfig.heygen, ...projectConfig.heygen }, // ADD
}
```

### Anti-Patterns to Avoid

- **API key in config:** `heygen.apiKey` must never appear in `BuildStoryConfig`. Only `process.env['HEYGEN_API_KEY']`. This is the same rule as `OPENAI_API_KEY`. [VERIFIED: ARCHITECTURE.md Anti-Pattern 3]
- **VideoRenderer interface in core:** Core must stay free of rendering concerns. Interface lives inline in CLI render.ts. [VERIFIED: ARCHITECTURE.md §Renderer Interface Contract]
- **Any import from `@buildstory/video`:** The heygen package must have zero `@buildstory/video` imports. [VERIFIED: REND-13, Pitfall 16]
- **Calling `console.log` from heygen package:** The package returns data; the CLI prints it. Matches the existing pattern in `@buildstory/video` (estimateTTSCost returns an object, render.ts prints it).
- **Running TTS before heygen dispatch:** When renderer is heygen, skip `orchestrateTTS()` entirely. HeyGen performs TTS server-side. [VERIFIED: Pitfall 16]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lazy install prompt | Custom yes/no prompt | Copy `askYesNo()` from lazy.ts | Already implemented and tested in the codebase |
| PreflightResult type | New type | Copy the `{ ok: boolean; failures: string[] }` interface from `packages/video/src/preflight.ts` | Identical shape; consistency with how CLI reads results |
| Cost display format | New display logic | Mirror `estimateTTSCost` call site pattern in render.ts | Format is already established for TTS cost |
| Duration estimation fallback | Complex NLP | Word count / 150 wpm heuristic | Same approach used in narrate phase for `duration_seconds`; good enough for cost estimate |
| Package.json scaffold | From scratch | Copy `packages/video/package.json` and remove Remotion/canvas/sharp/openai deps | Reuse the exact tsup/vitest/tsconfig pattern |

**Key insight:** This phase is almost entirely plumbing — copy-adapt existing patterns. The only novel design is the `VideoRenderer` interface shape and the `HeyGenOptions` type contract.

---

## Common Pitfalls

### Pitfall 1: `heygen` Section Missing from Deep Merge in loadConfig

**What goes wrong:** Developer adds `heygen?: { avatarId?, voiceId? }` to `BuildStoryConfig` interface but forgets to add the deep merge in the `return` statement of `loadConfig()`. The project `buildstory.toml` `[heygen]` section silently overwrites the global config rather than merging.

**Why it happens:** The merge block at the bottom of `loadConfig()` is easy to miss when adding a new top-level config section.

**How to avoid:** After adding to the interface, immediately check the return statement of `loadConfig()` and add the merge line.

**Warning signs:** Global config `heygen.voiceId` is set but ignored when project config sets `heygen.avatarId` only.

### Pitfall 2: `askYesNo` Is Private — Not Exported from lazy.ts

**What goes wrong:** `ensureHeyGenPackage()` cannot call `askYesNo()` because it is a module-private function in `lazy.ts`.

**Why it happens:** `askYesNo` is not exported in the current `lazy.ts`. The pattern is to add the new function to the same file so it shares the private helper.

**How to avoid:** Add `ensureHeyGenPackage()` and `detectHeyGenPackage()` directly to `packages/cli/src/lazy.ts` (same file as `ensureVideoPackage`). Do not try to import `askYesNo` from elsewhere.

[VERIFIED: packages/cli/src/lazy.ts read directly — askYesNo is unexported]

### Pitfall 3: `--renderer` Option Not Added to `run.ts` Command

**What goes wrong:** `--renderer=heygen` works in `buildstory render` but not in `buildstory run` (the full pipeline command), breaking the success criterion "Running any HeyGen render command without `HEYGEN_API_KEY` set prints an actionable error".

**Why it happens:** The renderer dispatch is added to `render.ts` only; `run.ts` is forgotten.

**How to avoid:** After updating `render.ts`, check `run.ts` for its render invocation and pass the `--renderer` option through. Both commands must support renderer selection.

[VERIFIED: CONTEXT.md Integration Points §packages/cli/src/commands/run.ts listed explicitly]

### Pitfall 4: `duration_seconds` Optional Field Causes NaN in Cost Estimate

**What goes wrong:** `beat.duration_seconds` is optional in `StoryBeatSchema`. If none of the beats have it set (common for story arcs generated before NARR-11 was implemented), the sum is `NaN` and the cost estimate prints `~NaN credits`.

**Why it happens:** `undefined + undefined` in JavaScript reduces to `NaN`.

**How to avoid:** The cost estimation function must explicitly handle the `undefined` case with the word-count fallback: `if (b.duration_seconds) return sum + b.duration_seconds; const words = b.summary.split(/\s+/).length; return sum + (words / 150) * 60`.

[VERIFIED: packages/core/src/types/story.ts — `duration_seconds: z.number().optional()` confirmed]

### Pitfall 5: `packages/heygen` Not Registered in `pnpm-workspace.yaml`

**What goes wrong:** The new package is created but not detected by pnpm as a workspace package. `@buildstory/heygen` cannot be imported via `workspace:*` protocol.

**Why it happens:** `pnpm-workspace.yaml` uses `packages/*` glob — which should auto-include `packages/heygen/`. However, the package.json `name` field must match exactly `@buildstory/heygen` for the `workspace:*` protocol to resolve.

**How to avoid:** Verify `pnpm-workspace.yaml` uses `packages/*` (it does — confirmed). Verify the new `package.json` has `"name": "@buildstory/heygen"` exactly. Run `pnpm install` from root after creating the package to update the lockfile.

[VERIFIED: pnpm-workspace.yaml contents read — `packages: ['packages/*']`]

### Pitfall 6: HeyGen Preflight Triggers on Dry-Run — Before Config Can Be Validated

**What goes wrong:** If preflight requires `avatarId` and `voiceId`, then `--dry-run` without those configured fails with a preflight error before printing the plan. The user cannot use dry-run to discover what they need to configure.

**Why it happens:** Preflight and dry-run are in sequence — preflight first, dry-run check second. For HeyGen, the preflight includes config validation, not just API key validation.

**How to avoid:** Decide whether `--dry-run` should skip the avatar/voice preflight check. Given that D-03 ("Dry-run output: `~5 credits (~$4.95 estimated)`") and the success criterion say the plan must include "avatar, voice", the avatar/voice must be set for dry-run to show them. Keep the current sequence: preflight fails fast even for dry-run. This is consistent and avoids a partial-state dry-run output.

---

## Code Examples

### HeyGen package.json scaffold

```json
{
  "name": "@buildstory/heygen",
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
  },
  "dependencies": {
    "@buildstory/core": "workspace:*",
    "zod": "^4.3.6",
    "p-retry": "^6.2.1"
  },
  "devDependencies": {
    "@types/node": "^25.5.2",
    "tsup": "^8.5.1",
    "vitest": "^4.1.2"
  }
}
```

[VERIFIED: matches STACK.md §v1.1 Addendum §New Package; @buildstory/video package.json read directly for tsup/vitest versions]

### tsup.config.ts (copy from video package)

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

### tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "composite": true
  },
  "include": ["src"],
  "references": [{ "path": "../core" }]
}
```

### Types file

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

/** Full output type -- all fields required (after Zod defaults applied). Used for Phase 7 API submission. */
export type HeyGenOptions = z.infer<typeof HeyGenOptionsSchema>

/** Input type -- fields with Zod defaults are optional. Used by preflight and cost estimation. */
export type HeyGenConfig = z.input<typeof HeyGenOptionsSchema>

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

### index.ts exports

```typescript
// packages/heygen/src/index.ts
export { preflightHeyGenCheck } from './preflight.js'
export { estimateHeyGenCost } from './cost.js'
export { HeyGenOptionsSchema } from './types.js'
export type { HeyGenOptions, HeyGenConfig, HeyGenCostEstimate, PreflightResult } from './types.js'
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single monolithic render command | Renderer dispatch via `--renderer` flag | v1.1 (this phase) | Enables renderer substitution without touching Remotion code |
| No `video.renderer` in config | `[video] renderer = "heygen"` in buildstory.toml | v1.1 (this phase) | Persistent per-project renderer preference |
| Implicit Remotion assumption in render.ts | Explicit renderer resolution with default fallback | v1.1 (this phase) | Backward compatible — existing Remotion users unaffected |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | HeyGen credit cost is ~$0.99/credit (standard avatar, pay-as-you-go) | Standard Stack / Cost Estimation | Cost estimate is displayed in USD before user submits; if pricing has changed, estimate is inaccurate. Low risk: user sees estimate before spending. |
| A2 | `p-retry ^6.2.1` is the correct version for Phase 5 package.json | Standard Stack | Version may have changed; can be verified at planning time with `npm view p-retry version`. Impact: minor — semver range `^6` will pull latest 6.x. |

**All implementation patterns are VERIFIED from direct codebase reads (lazy.ts, render.ts, config.ts, preflight.ts, tts/index.ts, story.ts, package.json files). No assumed patterns from training data.**

---

## Open Questions (RESOLVED)

1. **Should `--renderer` be added to `buildstory run` in Phase 5 or deferred to Phase 7?**
   - What we know: CONTEXT.md lists `run.ts` as an integration point. The success criteria say "Running any HeyGen render command without `HEYGEN_API_KEY` set prints an actionable error."
   - What's unclear: Whether "any HeyGen render command" includes `buildstory run --renderer=heygen` or only `buildstory render --renderer=heygen`.
   - Recommendation: Add `--renderer` to both `render.ts` and `run.ts` in Phase 5. The flag addition is minimal effort and avoids an inconsistency where `render` supports `--renderer` but `run` does not. The actual HeyGen execution path in `run.ts` can throw a "not yet implemented" error (same as `render.ts`) until Phase 7.
   - **RESOLVED:** Added to both `render` and `run` in Phase 5 per CONTEXT.md integration points listing both `render.ts` and `run.ts`. Plan 05-02 Task 2 implements `--renderer` on both commands.

2. **`p-retry` dependency in Phase 5 package.json vs. Phase 7?**
   - What we know: Phase 5 does not call HeyGen API. `p-retry` is needed for the polling loop in Phase 7.
   - What's unclear: Whether to declare `p-retry` now or defer to Phase 7.
   - Recommendation: Declare it now in `package.json` during the Phase 5 scaffold. Adding a dependency later requires re-running `pnpm install` at an unexpected moment. The package.json is written once; adding a dep in Phase 5 is cheap.
   - **RESOLVED:** `p-retry` declared in Phase 5 `package.json` during scaffold. Plan 05-01 Task 1 includes `"p-retry": "^6.2.1"` in dependencies.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All packages | Yes | v22.22.0 | — |
| pnpm | Workspace management | Yes | 10.31.0 | — |
| ffprobe | (Not needed for Phase 5) | Yes | system | — |
| TypeScript | Build | Yes (workspace) | 6.0.2 | — |

Phase 5 introduces no external service dependencies — it only scaffolds the package and wires up CLI dispatch. No HeyGen API calls are made. No new system tools required.

---

## Sources

### Primary (HIGH confidence — directly read from codebase)
- `packages/cli/src/lazy.ts` — `ensureVideoPackage()`, `askYesNo()` patterns
- `packages/cli/src/config.ts` — `BuildStoryConfig` interface, `loadConfig()` deep merge pattern
- `packages/cli/src/commands/render.ts` — existing render flow, TTS cost display, dry-run pattern
- `packages/video/src/preflight.ts` — `PreflightResult` interface, `preflightCheck()` structure
- `packages/video/src/tts/index.ts` — `estimateTTSCost()` pattern
- `packages/video/src/index.ts` — public API surface pattern
- `packages/video/package.json` — tsup/vitest/tsconfig scaffold to copy
- `packages/core/src/types/story.ts` — `StoryBeat.duration_seconds` optional field confirmed
- `pnpm-workspace.yaml` — `packages/*` glob confirmed

### Secondary (MEDIUM confidence — from prior research documents)
- `.planning/research/STACK.md` §v1.1 Addendum — HeyGen API shapes, credit pricing model
- `.planning/research/ARCHITECTURE.md` §HeyGen Renderer Integration — package structure decisions, VideoRenderer interface placement, `HeyGenOptions` type
- `.planning/research/FEATURES.md` §SECTION 2 — cost model, `duration_seconds` fallback rationale
- `.planning/research/PITFALLS.md` §HeyGen Integration Pitfalls — Pitfall 9 (beat format mismatch), Pitfall 12 (Avatar IV cost), Pitfall 16 (Remotion leakage)
- `.planning/phases/05-heygen-package/05-CONTEXT.md` — all locked decisions

---

## Metadata

**Confidence breakdown:**
- Package scaffold patterns: HIGH — read directly from existing packages
- CLI integration patterns: HIGH — read render.ts, lazy.ts, config.ts directly
- HeyGen credit pricing: MEDIUM — from prior research; no real-time verification
- `p-retry` version: MEDIUM — from prior research; minor version may have moved

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable patterns; HeyGen pricing could change but only affects display accuracy, not implementation)
