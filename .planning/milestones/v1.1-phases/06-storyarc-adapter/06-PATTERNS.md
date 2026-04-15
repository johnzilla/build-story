# Phase 6: StoryArc Adapter - Pattern Map

**Mapped:** 2026-04-15
**Files analyzed:** 4 (2 new source files, 1 modified source file, 1 new test file)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/heygen/src/adapter.ts` | service | transform | `packages/heygen/src/cost.ts` | exact (same package, same beat-iteration pattern, same pure function shape) |
| `packages/heygen/src/types.ts` | model | — | `packages/heygen/src/types.ts` (self — additive edit) | exact |
| `packages/heygen/src/index.ts` | config | — | `packages/heygen/src/index.ts` (self — additive edit) | exact |
| `packages/heygen/src/__tests__/adapter.test.ts` | test | transform | `packages/core/src/narrate/chunker.test.ts` | exact (pure transform, fixture-builder helpers, `chunks.flat()` pattern) |

---

## Pattern Assignments

### `packages/heygen/src/adapter.ts` (service, transform)

**Analog:** `packages/heygen/src/cost.ts`

**Imports pattern** (cost.ts lines 1-2):
```typescript
import type { StoryBeat } from '@buildstory/core'
import type { HeyGenConfig, HeyGenCostEstimate } from './types.js'
```
Adapter imports follow the same shape — workspace type imports with `import type`, local types with `.js` extension:
```typescript
import type { StoryArc, BeatType } from '@buildstory/core'
import type { AdaptOptions, AdaptResult, HeyGenScene } from './types.js'
```

**Core beat-iteration pattern** (cost.ts lines 7-26):
```typescript
export function estimateHeyGenCost(
  beats: StoryBeat[],
  opts: HeyGenConfig,
): HeyGenCostEstimate {
  const totalSeconds = beats.reduce((sum, b) => {
    if (b.duration_seconds !== undefined) return sum + b.duration_seconds
    const words = b.summary.split(/\s+/).length
    return sum + (words / 150) * 60
  }, 0)
  // ...
  return {
    sceneCount: beats.length,
    // ...
  }
}
```
The adapter follows the identical pattern: named export function with typed inputs and typed return, iterating `arc.beats` (or a beat array), accumulating results, returning a plain typed object.

**Warning accumulator pattern** (preflight.ts lines 3-23):
```typescript
export async function preflightHeyGenCheck(opts: HeyGenConfig): Promise<PreflightResult> {
  const failures: string[] = []

  if (!opts.apiKey) {
    failures.push('HEYGEN_API_KEY not set. Required for --renderer=heygen.')
  }
  // ...
  return { ok: failures.length === 0, failures }
}
```
The adapter's `warnings` array uses this exact pattern: declare `const warnings: string[] = []`, push warning strings during iteration, include in return object. Never `console.warn`.

**Named constants pattern** (cost.ts lines 3-4):
```typescript
const CREDITS_PER_MINUTE = 1
const USD_PER_CREDIT = 0.99
```
The adapter declares its limits as named constants at module scope:
```typescript
const HEYGEN_CHAR_LIMIT = 1500
const HEYGEN_MAX_SCENES = 10
```

**Color map pattern** — no analog exists in the codebase; use a typed `const` object:
```typescript
import type { BeatType } from '@buildstory/core'

const BEAT_COLOR_MAP: Record<BeatType, string> = {
  idea:       '#1E3A5F',
  goal:       '#2D5F8A',
  attempt:    '#4A90D9',
  obstacle:   '#D35400',
  pivot:      '#E74C3C',
  side_quest: '#8E44AD',
  decision:   '#F39C12',
  result:     '#27AE60',
  open_loop:  '#7F8C8D',
} as const
```
`Record<BeatType, string>` is the enforced type — TypeScript will error at compile time if a new BeatType variant is added to `@buildstory/core` without updating this map.

---

### `packages/heygen/src/types.ts` (model — additive edit)

**Analog:** `packages/heygen/src/types.ts` lines 1-31 (the file being extended)

**Existing Zod schema + dual-type pattern** (types.ts lines 1-17):
```typescript
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

/** Full output type -- all fields required (after Zod defaults applied). */
export type HeyGenOptions = z.infer<typeof HeyGenOptionsSchema>

/** Input type -- fields with Zod defaults are optional. */
export type HeyGenConfig = z.input<typeof HeyGenOptionsSchema>
```
New types follow the same pattern: Zod schema exported alongside its inferred TypeScript type. `AdaptOptions` has no defaults so it uses `z.infer` only (not the input/infer split). `HeyGenScene` is a plain interface (not Zod-inferred) because the adapter constructs it directly from typed inputs and does not need runtime parsing.

**New type additions to append** (mirroring existing interface style at lines 19-31):
```typescript
export interface HeyGenScene {
  character: {
    type: 'avatar'
    avatar_id: string
    avatar_style?: 'normal' | 'circle' | 'closeUp'
  }
  voice: {
    type: 'text'
    input_text: string
    voice_id: string
    speed?: number
  }
  background: {
    type: 'color'
    value: string  // hex e.g. "#1E3A5F"
  }
}

export const AdaptOptionsSchema = z.object({
  avatarId: z.string().min(1),
  voiceId: z.string().min(1),
  speed: z.number().min(0.5).max(2.0).optional(),
  avatarStyle: z.enum(['normal', 'circle', 'closeUp']).optional(),
})

export type AdaptOptions = z.infer<typeof AdaptOptionsSchema>

export interface AdaptResult {
  chunks: HeyGenScene[][]   // one sub-array per API call (≤10 scenes each)
  warnings: string[]         // non-fatal notices (e.g., truncation)
}
```

---

### `packages/heygen/src/index.ts` (config — additive edit)

**Analog:** `packages/heygen/src/index.ts` lines 1-4 (the file being extended)

**Existing re-export pattern** (index.ts lines 1-4):
```typescript
export { preflightHeyGenCheck } from './preflight.js'
export { estimateHeyGenCost } from './cost.js'
export { HeyGenOptionsSchema } from './types.js'
export type { HeyGenOptions, HeyGenConfig, HeyGenCostEstimate, PreflightResult } from './types.js'
```
Add two new lines following this pattern exactly:
```typescript
export { adaptStoryArc } from './adapter.js'
export type { HeyGenScene, AdaptOptions, AdaptResult } from './types.js'
```
Note: `AdaptOptionsSchema` is exported on the value line (not the `export type` line), same as `HeyGenOptionsSchema`.

---

### `packages/heygen/src/__tests__/adapter.test.ts` (test, transform)

**Primary analog:** `packages/core/src/narrate/chunker.test.ts` (pure transform, no mocks, fixture builders, `.flat()` assertions)

**Secondary analog:** `packages/core/src/__tests__/timeline-builder.test.ts` (describe/it/expect structure, factory helpers)

**Test file structure** (chunker.test.ts lines 1-21):
```typescript
import { describe, it, expect } from 'vitest'
import { groupByPhase, chunkTimeline } from './chunker.js'
import type { Timeline, TimelineEvent } from '../types/timeline.js'

const makeEvent = (overrides: Partial<TimelineEvent> & { id: string }): TimelineEvent => ({
  date: '2026-01-01',
  source: 'file',
  summary: 'Test event',
  // ...
  ...overrides,
})

const makeTimeline = (events: TimelineEvent[]): Timeline => ({
  version: '1',
  rootDir: '/test',
  // ...
  events,
})
```
Adapter test follows the same: `import { describe, it, expect } from 'vitest'`, no `vi` (pure function, no mocks needed), fixture builder helpers at file scope:
```typescript
import { describe, it, expect } from 'vitest'
import { adaptStoryArc } from '../adapter.js'
import type { StoryArc, StoryBeat } from '@buildstory/core'
import type { AdaptOptions } from '../types.js'

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

**"All items accounted for" assertion pattern** (chunker.test.ts lines 113-124):
```typescript
it('all original events are accounted for across chunks', () => {
  // ...
  const allIds = chunks.flatMap((c) => c.events.map((e) => e.id))
  expect(allIds.sort()).toEqual(['e1', 'e2', 'e3'].sort())
})
```
Adapter test uses the equivalent:
```typescript
it('all beats are accounted for across chunks', () => {
  const beats = Array.from({ length: 15 }, (_, i) =>
    makeBeat({ title: `beat-${i}` })
  )
  const result = adaptStoryArc(makeArc(beats), defaultOpts)
  expect(result.chunks.flat()).toHaveLength(15)
})
```

**format.test.ts arc fixture pattern** (format.test.ts lines 5-23):
```typescript
const makeArc = (overrides: Partial<StoryArc> = {}): StoryArc => ({
  version: '1',
  beats: [
    {
      type: 'idea',
      title: 'Initial concept',
      summary: 'The project started with a spark of an idea.',
      evidence: ['evidence item'],
      sourceEventIds: ['evt-1'],
      significance: 2,
    },
  ],
  metadata: {
    generatedAt: '2026-01-01T00:00:00Z',
    style: 'technical',
    sourceTimeline: '/test',
  },
  ...overrides,
})
```
This is the authoritative `StoryArc` fixture shape. The adapter test's `makeArc` and `makeBeat` helpers should produce objects matching this shape exactly.

---

## Shared Patterns

### Beat Array Iteration (pure accumulation)
**Source:** `packages/heygen/src/cost.ts` lines 7-26
**Apply to:** `adapter.ts` — `adaptStoryArc()` and `beatToScene()` internal helpers
```typescript
// Pattern: accept typed array, reduce/map, return plain typed object
export function estimateHeyGenCost(beats: StoryBeat[], opts: HeyGenConfig): HeyGenCostEstimate {
  const totalSeconds = beats.reduce((sum, b) => {
    if (b.duration_seconds !== undefined) return sum + b.duration_seconds
    const words = b.summary.split(/\s+/).length
    return sum + (words / 150) * 60
  }, 0)
  return { sceneCount: beats.length, ... }
}
```

### Warning Accumulator
**Source:** `packages/heygen/src/preflight.ts` lines 3-23
**Apply to:** `adapter.ts` — collect truncation warnings during beat iteration
```typescript
const failures: string[] = []
// ... push conditionally ...
return { ok: failures.length === 0, failures }
```
Adapter equivalent: `const warnings: string[] = []` → push on truncation → `return { chunks, warnings }`.

### Zod Schema + Inferred Type Export
**Source:** `packages/heygen/src/types.ts` lines 1-17
**Apply to:** `types.ts` additions (`AdaptOptionsSchema` + `AdaptOptions`)
```typescript
export const HeyGenOptionsSchema = z.object({ ... })
export type HeyGenOptions = z.infer<typeof HeyGenOptionsSchema>
export type HeyGenConfig = z.input<typeof HeyGenOptionsSchema>
```

### Re-export from index
**Source:** `packages/heygen/src/index.ts` lines 1-4
**Apply to:** `index.ts` — add adapter and new type exports
```typescript
export { preflightHeyGenCheck } from './preflight.js'
export { estimateHeyGenCost } from './cost.js'
export { HeyGenOptionsSchema } from './types.js'
export type { HeyGenOptions, HeyGenConfig, HeyGenCostEstimate, PreflightResult } from './types.js'
```

### `.js` extension on local imports
**Source:** All files in `packages/heygen/src/`
**Apply to:** `adapter.ts` and `__tests__/adapter.test.ts` — local imports must use `.js` extension (ESM resolution):
```typescript
import type { AdaptOptions, AdaptResult, HeyGenScene } from './types.js'
import { adaptStoryArc } from '../adapter.js'
```

---

## No Analog Found

None — all four files have clear analogs in the existing codebase.

---

## Metadata

**Analog search scope:** `packages/heygen/src/`, `packages/core/src/__tests__/`, `packages/core/src/narrate/`, `packages/core/src/format/`
**Files scanned:** 9 source files read
**Pattern extraction date:** 2026-04-15
