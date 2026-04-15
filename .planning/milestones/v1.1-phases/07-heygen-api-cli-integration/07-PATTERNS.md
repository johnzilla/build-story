# Phase 7: HeyGen API + CLI Integration - Pattern Map

**Mapped:** 2026-04-15
**Files analyzed:** 5 (3 new, 2 modified)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/heygen/src/api.ts` | service | request-response + file-I/O | `packages/heygen/src/preflight.ts` + `packages/cli/src/lazy.ts` | role-match |
| `packages/heygen/src/index.ts` | config (barrel) | — | `packages/heygen/src/index.ts` (existing) | exact (additive edit) |
| `packages/heygen/src/__tests__/api.test.ts` | test | request-response | `packages/heygen/src/__tests__/adapter.test.ts` | exact |
| `packages/cli/src/commands/render.ts` | controller | request-response | `packages/cli/src/commands/render.ts` (existing) | exact (targeted edit at line 82) |
| `packages/cli/src/commands/run.ts` | controller | request-response | `packages/cli/src/commands/run.ts` (existing) | exact (targeted edit at line 163) |

---

## Pattern Assignments

### `packages/heygen/src/api.ts` (service, request-response + file-I/O)

**Analog:** `packages/heygen/src/preflight.ts` (import style, HeyGenConfig usage) + `packages/cli/src/lazy.ts` (child_process.spawn pattern)

**Imports pattern** — copy from `packages/heygen/src/preflight.ts` lines 1-2 and extend:

```typescript
import { writeFile, unlink, mkdir } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { z } from 'zod'
import pRetry from 'p-retry'
import type { StoryArc } from '@buildstory/core'
import type { HeyGenConfig, HeyGenScene } from './types.js'
import { HeyGenOptionsSchema } from './types.js'
import { adaptStoryArc } from './adapter.js'
```

Note: `p-retry` and `zod` are already declared in `packages/heygen/package.json` dependencies. No new installs needed.

**Zod response validation pattern** — apply to every `fetch()` response (no raw casts):

```typescript
// Source: packages/heygen/src/types.ts lines 1-11 (Zod schema pattern)
// Apply same pattern for API response schemas

const HeyGenSubmitResponseSchema = z.object({
  data: z.object({ video_id: z.string() }).nullable(),
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
})

const HeyGenStatusResponseSchema = z.object({
  data: z.object({
    video_id: z.string(),
    status: z.enum(['pending', 'processing', 'completed', 'failed']),
    video_url: z.string().url().optional(),
    duration: z.number().optional(),
    error: z.object({ code: z.string(), message: z.string() }).nullable().optional(),
  }),
})
```

**Options parsing pattern** — copy from `packages/heygen/src/adapter.ts` lines 99-101 (validate-at-boundary):

```typescript
// packages/heygen/src/adapter.ts lines 99-101
export function adaptStoryArc(arc: StoryArc, opts: AdaptOptions): AdaptResult {
  const validatedArc = StoryArcSchema.parse(arc)
  const validatedOpts = AdaptOptionsSchema.parse(opts)
  // ...
}

// Apply same pattern in renderWithHeyGen:
export async function renderWithHeyGen(
  arc: StoryArc,
  config: HeyGenConfig,
  outputPath: string,
  onProgress: (msg: string) => void,
): Promise<{ videoPath: string }> {
  const opts = HeyGenOptionsSchema.parse(config) // validate + apply Zod defaults here
  // ...
}
```

**child_process.spawn pattern** — copy from `packages/cli/src/lazy.ts` lines 36-43 (spawnSync style → adapt to async spawn for FFmpeg concat):

```typescript
// packages/cli/src/lazy.ts lines 36-43 (spawnSync pattern — adapt to async spawn for FFmpeg)
const result = spawnSync('pnpm', ['install', '--filter', '@buildstory/video'], {
  stdio: 'inherit',
  cwd: process.cwd(),
})
if (result.status !== 0) {
  console.error('Failed to install video dependencies.')
  process.exit(1)
}

// For FFmpeg concat, use async spawn (non-blocking, pipe stdio to capture errors):
await new Promise<void>((resolve, reject) => {
  const proc = spawn(ffmpegBin, args, { stdio: 'pipe' })
  proc.on('close', (code) => {
    if (code === 0) resolve()
    else reject(new Error(`FFmpeg concat exited with code ${code}`))
  })
  proc.on('error', reject)
})
```

**Error classification pattern** — copy the "failures array" pattern from `packages/heygen/src/preflight.ts` lines 4-23, but throw errors for api.ts (preflight returns, api.ts throws):

```typescript
// packages/heygen/src/preflight.ts lines 4-23 (failures pattern — adapt to thrown errors in api.ts)
export async function preflightHeyGenCheck(opts: HeyGenConfig): Promise<PreflightResult> {
  const failures: string[] = []
  if (!opts.apiKey) {
    failures.push('HEYGEN_API_KEY not set. Required for --renderer=heygen.')
  }
  return { ok: failures.length === 0, failures }
}

// In api.ts, throw typed errors with actionable messages instead:
class HeyGenApiError extends Error {
  constructor(public code: string, message: string) {
    super(`HeyGen API error [${code}]: ${message}`)
    this.name = 'HeyGenApiError'
  }
}
class HeyGenTimeoutError extends Error {
  constructor(message: string, public videoId: string) {
    super(message)
    this.name = 'HeyGenTimeoutError'
  }
}
```

**p-retry usage pattern** — `p-retry` is in `packages/heygen/package.json` (v^6.2.1 — note: `packages/heygen/package.json` declares `p-retry ^6.2.1` but environment shows 8.0.0 installed; use the installed version's API which is compatible). Apply only to network-error wrapping on `fetch()` calls, not to status polling:

```typescript
// Apply p-retry for transient network errors on submit/status fetch — not for polling transitions
const response = await pRetry(
  () => fetch('https://api.heygen.com/v2/video/generate', { method: 'POST', /* ... */ }),
  {
    retries: 3,
    shouldRetry: (err) => !(err instanceof HeyGenApiError), // don't retry terminal API errors
  },
)
```

---

### `packages/heygen/src/index.ts` (barrel, additive edit)

**Analog:** `packages/heygen/src/index.ts` (current file — lines 1-6)

**Current file** (lines 1-6):

```typescript
export { preflightHeyGenCheck } from './preflight.js'
export { estimateHeyGenCost } from './cost.js'
export { adaptStoryArc } from './adapter.js'
export { HeyGenOptionsSchema, AdaptOptionsSchema } from './types.js'
export type { HeyGenOptions, HeyGenConfig, HeyGenCostEstimate, PreflightResult } from './types.js'
export type { HeyGenScene, AdaptOptions, AdaptResult } from './types.js'
```

**Add after line 3** (follow same export style — named exports, `.js` extension, type-only exports for interfaces):

```typescript
export { renderWithHeyGen } from './api.js'
// If api.ts defines public result types, add:
export type { HeyGenRenderResult } from './api.js'
```

---

### `packages/heygen/src/__tests__/api.test.ts` (test, request-response)

**Analog:** `packages/heygen/src/__tests__/adapter.test.ts` — exact structural match

**Test file structure** — copy from `packages/heygen/src/__tests__/adapter.test.ts`:

```typescript
// packages/heygen/src/__tests__/adapter.test.ts lines 1-4 (imports pattern)
import { describe, it, expect } from 'vitest'
import { adaptStoryArc } from '../adapter.js'
import type { StoryArc, StoryBeat } from '@buildstory/core'
import type { AdaptOptions } from '../types.js'

// Apply same pattern for api.test.ts:
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { HeyGenConfig } from '../types.js'
```

**Fixture helper pattern** — copy from `packages/heygen/src/__tests__/adapter.test.ts` lines 10-33:

```typescript
// packages/heygen/src/__tests__/adapter.test.ts lines 10-33
const makeBeat = (overrides: Partial<StoryBeat> = {}): StoryBeat => ({
  type: 'idea',
  title: 'Test beat',
  summary: 'A short summary.',
  evidence: [],
  sourceEventIds: [],
  significance: 2,
  ...overrides,
})

const makeArc = (beats: StoryBeat[]): StoryArc => ({
  version: '1',
  beats,
  metadata: {
    generatedAt: '2026-01-01T00:00:00Z',
    style: 'technical',
    sourceTimeline: '/test',
  },
})

const defaultOpts: AdaptOptions = {
  avatarId: 'Monica_chair_front_public',
  voiceId: 'test-voice-id',
}
```

**Test describe-block structure** — copy sectioning pattern from `adapter.test.ts` (sections divided by separator comments `// ---`). For `api.test.ts`, use sections: `submitChunk`, `pollUntilComplete`, `downloadMp4`, `concatMp4s`, `renderWithHeyGen`.

**fetch mocking pattern** — no existing analog in codebase (adapter.test.ts tests a pure function, no fetch). Use Vitest's `vi.spyOn` or global fetch mock:

```typescript
// Vitest global fetch mock (no existing codebase analog — use standard Vitest pattern)
beforeEach(() => {
  vi.resetAllMocks()
  global.fetch = vi.fn()
})

it('submitChunk returns video_id on success', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(JSON.stringify({ data: { video_id: 'vid-123' }, error: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  // ...
})
```

---

### `packages/cli/src/commands/render.ts` (controller, targeted edit at line 82)

**Analog:** `packages/cli/src/commands/render.ts` itself — the edit replaces lines 82-83 with the full heygen submission flow, following patterns already established in the same file above line 82.

**Spinner pattern to copy** — from `render.ts` lines 123-136 (Remotion TTS spinner):

```typescript
// packages/cli/src/commands/render.ts lines 123-136
const ttsSpinner = ora(`[1/2] Generating TTS audio...`).start()
const audioManifest = await video.orchestrateTTS(
  storyArc.beats,
  outputDir,
  { voice: ttsVoice, speed: ttsSpeed, apiKey: openaiKey, concurrency: ttsConcurrency },
  (completed: number, total: number) => {
    ttsSpinner.text = `[1/2] Generating TTS audio... ${completed}/${total} scenes`
  },
)
ttsSpinner.succeed(
  chalk.green(`[1/2] TTS complete — ...`),
)
```

**Replacement block** (replaces lines 82-83 — `console.error` + `process.exit(1)`):

```typescript
// packages/cli/src/commands/render.ts — replaces lines 82-83
// Import renderWithHeyGen via the already-imported heygen dynamic import at line 48
const { renderWithHeyGen } = heygen

const outputDir = resolve(opts.output, projectName)
await mkdir(outputDir, { recursive: true })
const outputPath = resolve(outputDir, `${projectName}.mp4`)

const heygenSpinner = ora('Submitting to HeyGen...').start()

const result = await renderWithHeyGen(
  storyArc,
  heygenOpts,
  outputPath,
  (msg: string) => { heygenSpinner.text = msg },
)

heygenSpinner.succeed(chalk.green('HeyGen render complete'))
console.log(chalk.bold('\n  Output:'))
console.log(`    Video: ${result.videoPath}`)
console.log()
```

**Error handling pattern** — copy from `render.ts` lines 60-65 (preflight error display):

```typescript
// packages/cli/src/commands/render.ts lines 60-65
if (!preflight.ok) {
  console.error(chalk.red('\n  Preflight check failed:\n'))
  preflight.failures.forEach((f: string) => console.error(chalk.red(`    - ${f}`)))
  console.error()
  process.exit(1)
}
```

**mkdir pattern** — copy from `render.ts` lines 115-116 (Remotion path):

```typescript
// packages/cli/src/commands/render.ts lines 115-116
const outputDir = resolve(opts.output, projectName)
await mkdir(outputDir, { recursive: true })
```

Note: `mkdir` is already imported at line 1 (`import { readFile, mkdir } from 'node:fs/promises'`). No import change needed.

---

### `packages/cli/src/commands/run.ts` (controller, targeted edit at line 163)

**Analog:** `packages/cli/src/commands/run.ts` itself — parallel placeholder to `render.ts` line 82. Apply the exact same replacement pattern as `render.ts`.

**Replacement block** (replaces lines 163-164 — `console.error` + `process.exit(1)`):

```typescript
// packages/cli/src/commands/run.ts — replaces lines 163-164
// heygen dynamic import already at line 134; heygenOpts already at lines 137-141
const { renderWithHeyGen } = heygen

mp4Path = resolve(outputDir, `${projectName}.mp4`)

const heygenSpinner = ora('Submitting to HeyGen...').start()

const heygenResult = await renderWithHeyGen(
  arc,
  heygenOpts,
  mp4Path,
  (msg: string) => { heygenSpinner.text = msg },
)

heygenSpinner.succeed(chalk.green('HeyGen render complete'))
mp4Path = heygenResult.videoPath
```

Note: `outputDir` is already assigned at line 121 (`const outputDir = resolve(opts.output, projectName)`). `mp4Path` is declared at line 127 (`let mp4Path: string | undefined`). The replacement assigns `mp4Path` so the final summary block at lines 284-285 picks it up correctly.

---

## Shared Patterns

### API Key from env only, never config files
**Source:** `packages/cli/src/commands/render.ts` lines 53-56
**Apply to:** `packages/heygen/src/api.ts` (accept as parameter, never read `process.env` internally)

```typescript
// packages/cli/src/commands/render.ts lines 53-56
const heygenOpts = {
  apiKey: process.env['HEYGEN_API_KEY'] ?? '',
  avatarId: config.heygen?.avatarId ?? '',
  voiceId: config.heygen?.voiceId ?? '',
}
```

The CLI reads `process.env`; `api.ts` receives `apiKey` as a parameter. Never call `process.env` inside the heygen package.

### Zod validate at function boundary (never trust external data)
**Source:** `packages/heygen/src/adapter.ts` lines 99-101, `packages/heygen/src/types.ts` lines 1-11
**Apply to:** All `fetch()` response parsing in `packages/heygen/src/api.ts`

```typescript
// packages/heygen/src/adapter.ts lines 99-101
const validatedArc = StoryArcSchema.parse(arc)
const validatedOpts = AdaptOptionsSchema.parse(opts)
```

### Dynamic import after lazy install check
**Source:** `packages/cli/src/commands/render.ts` lines 47-48
**Apply to:** `render.ts` and `run.ts` replacement blocks — `renderWithHeyGen` must be extracted from the already-performed dynamic import, not re-imported

```typescript
// packages/cli/src/commands/render.ts lines 47-48
await ensureHeyGenPackage()
const heygen = await import('@buildstory/heygen')
// ...
// Further down (replacement of line 82): destructure from heygen, don't re-import
const { renderWithHeyGen } = heygen
```

### ora spinner + onProgress callback separation
**Source:** `packages/cli/src/commands/render.ts` lines 123-136
**Apply to:** Both `render.ts` and `run.ts` replacement blocks; `api.ts` accepts `onProgress: (msg: string) => void` — never imports ora

```typescript
// Spinner lives in CLI; api.ts calls onProgress only:
const ttsSpinner = ora(`[1/2] Generating TTS audio...`).start()
await video.orchestrateTTS(
  storyArc.beats, outputDir, ttsOpts,
  (completed: number, total: number) => {
    ttsSpinner.text = `[1/2] Generating TTS audio... ${completed}/${total} scenes`
  },
)
ttsSpinner.succeed(chalk.green(`[1/2] TTS complete — ...`))
```

### chalk error formatting
**Source:** `packages/cli/src/commands/render.ts` lines 60-65
**Apply to:** All error paths in the CLI replacement blocks

```typescript
console.error(chalk.red('\n  Preflight check failed:\n'))
preflight.failures.forEach((f: string) => console.error(chalk.red(`    - ${f}`)))
console.error()
process.exit(1)
```

### `.js` extension on all local imports (ESM)
**Source:** `packages/heygen/src/index.ts` lines 1-6, `packages/heygen/src/adapter.ts` lines 1-4
**Apply to:** All imports in `packages/heygen/src/api.ts` and `packages/heygen/src/index.ts` additions

```typescript
// packages/heygen/src/index.ts
export { preflightHeyGenCheck } from './preflight.js'  // always .js, not .ts
import { adaptStoryArc } from './adapter.js'            // always .js, not .ts
```

### Warnings returned in metadata objects (not console.warn)
**Source:** `packages/heygen/src/adapter.ts` lines 102-116 (`warnings: string[]` in return)
**Apply to:** `renderWithHeyGen` return value — include any adapter warnings in the result object, not printed inside the heygen package

```typescript
// packages/heygen/src/adapter.ts lines 102-116
const warnings: string[] = []
// ...
return { chunks, warnings }

// renderWithHeyGen should similarly return { videoPath, warnings }
// CLI prints warnings after the call, not the heygen package
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/heygen/src/__tests__/api.test.ts` (fetch mocking) | test | request-response | No existing test in the codebase mocks `fetch` — `adapter.test.ts` tests a pure function. Standard Vitest `vi.fn()` pattern applies. |

---

## Key Anti-Patterns (from RESEARCH.md — enforce during planning)

| Anti-Pattern | Where to Block | Correct Pattern |
|--------------|----------------|-----------------|
| `import fluent-ffmpeg` anywhere in `packages/heygen/` | `api.ts` | `child_process.spawn('ffmpeg', args)` |
| `import '@buildstory/video'` in heygen package | `api.ts` | No cross-package dep to video package |
| Caching `video_url` across poll iterations | `api.ts` pollUntilComplete | Download immediately on `completed` status |
| Retrying error code `400140` (daily rate limit) | `api.ts` submitChunk | Terminal error — throw immediately |
| Reading `process.env.HEYGEN_API_KEY` inside heygen package | `api.ts` | Accept `apiKey` as parameter only |
| Raw `fetch()` response cast with `as HeyGenResponse` | `api.ts` | Always `Schema.parse(await res.json())` |

---

## Metadata

**Analog search scope:** `packages/heygen/src/`, `packages/cli/src/commands/`, `packages/cli/src/`
**Files scanned:** 8 source files read in full
**Pattern extraction date:** 2026-04-15
