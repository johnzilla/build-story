# Phase 03: Narrator - Research

**Researched:** 2026-04-05
**Domain:** LLM structured output, provider-agnostic narration pipeline, text format generation
**Confidence:** HIGH (SDK APIs verified via official docs; version numbers confirmed via npm registry)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Single LLM call for beat extraction + narrative — one call receives the full Timeline, extracts beats, classifies them (9 beat types), and generates narrative summaries for each beat. Style preset changes the system prompt. Output is a Zod-validated StoryArc.
- **D-02:** Provider-native structured output — Anthropic `output_config` + `zodOutputFormat` for Claude, OpenAI `zodResponseFormat` + `parse()` for GPT. Each provider's native schema enforcement mechanism. Post-validate through `StoryArcSchema.parse()`.
- **D-03:** Provider-agnostic LLM client — a common interface that wraps both SDKs. `narrate()` doesn't know which provider it's using. The client handles prompt construction, schema enforcement, and response parsing per provider.
- **D-04:** LLM-generated text per format — a second LLM call takes StoryArc beats + a format-specific system prompt and generates the final text. Each format has a tailored prompt.
- **D-05:** All formats by default — `buildstory narrate timeline.json` generates all 4 formats. `--format thread` generates only thread.
- **D-06:** Chunk by GSD phase boundaries — if timeline exceeds maxInputTokens, group events by source phase. Narrate each chunk separately, then a synthesis call merges the arcs.
- **D-07:** Simple character-based token estimation — ~4 chars/token heuristic. No extra dependencies.
- **D-08:** maxInputTokens guard — default 100000 tokens. If over limit, chunk (D-06) or fail with clear error.

### Claude's Discretion

- Exact system prompt wording for each style preset (technical, overview, retrospective, pitch)
- Format-specific prompt engineering (what makes a good thread vs blog vs outline)
- How to structure the synthesis call when chunking
- Error handling for LLM API failures (retries, fallback provider)
- How to make output deterministic (NARR-09): temperature=0, system prompt pinning

### Deferred Ideas (OUT OF SCOPE)

- `story.config.json` editorial control file — accepted by CEO plan but implementation deferred
- `buildstory init` command — accepted by CEO plan, not in Phase 3 scope
- Video rendering from video-script output — separate milestone
- Incremental narration (only narrate new/changed events) — v2
- Custom beat types beyond the 9 fixed types — v2

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NARR-01 | LLM narrator supports Anthropic (Claude) provider via official SDK | Anthropic SDK 0.82.0 with `client.messages.parse()` + `zodOutputFormat` |
| NARR-02 | LLM narrator supports OpenAI provider via official SDK | OpenAI SDK 6.33.0 with `client.chat.completions.parse()` + `zodResponseFormat` |
| NARR-03 | Four narrative style presets: technical, overview, retrospective, pitch | System prompt variation per style; single `LLMProvider` interface |
| NARR-04 (D-09) | Beat classification using 9 beat types per `StoryBeat` schema | BeatTypeSchema already defined in `story.ts`; LLM extracts + classifies |
| NARR-05 | Each beat includes source event links tracing back to timeline events | `StoryBeat.sourceEventIds` field already in schema |
| NARR-06 (D-11) | Word count and estimated reading time per format output | Post-process after format generation; no LLM call needed |
| NARR-07 (D-12) | StoryArc JSON with beats + text format outputs (outline.md, thread.md, blog.md, video-script.md) | `format()` stub to be replaced; 4 output files written by CLI |
| NARR-08 | LLM cost guard: configurable max input tokens | Character-based estimation (~4 chars/token); check before API call |
| NARR-09 | Deterministic output: same input produces equivalent result | `temperature: 0` both providers; prompt pinning; structured outputs reduce variation |
| CLI-02 | `buildstory narrate <timeline.json>` command | New commander subcommand reading timeline.json, calling narrate() + format() |

</phase_requirements>

---

## Summary

Phase 3 replaces the `narrate()` and `format()` stubs with real LLM calls. The core work is: (1) a provider-agnostic `LLMProvider` interface with Anthropic and OpenAI implementations, (2) structured output extraction using each provider's native mechanism (Anthropic `client.messages.parse()` + `zodOutputFormat`, OpenAI `client.chat.completions.parse()` + `zodResponseFormat`), (3) Zod post-validation of the `StoryArc`, (4) a second LLM call per format type generating final publishable text, and (5) the `buildstory narrate` CLI command.

Both LLM SDKs (`@anthropic-ai/sdk` and `openai`) are installed in `@buildstory/core` since `narrate()` lives there. This is consistent with the existing ESLint boundary rule which bans `fs`/`process`/config imports from core, not network libraries. The SDKs are not yet installed in the project — they must be added as dependencies of `packages/core` in Wave 0.

The critical technical finding is that **Anthropic now has a native structured outputs API** (`output_config.format` + `zodOutputFormat`) that is more direct than the older tool_use workaround. The `@anthropic-ai/sdk` 0.82.0 ships `@anthropic-ai/sdk/helpers/zod` which converts a Zod schema to the `output_config` format and handles parsing. OpenAI SDK 6.33.0 ships `openai/helpers/zod` with `zodResponseFormat` for the same purpose. Both project's Zod v4 schemas work with both helpers, though care is needed — details in the Pitfalls section.

**Primary recommendation:** Use `client.messages.parse()` + `zodOutputFormat(StoryArcSchema)` for Anthropic and `client.chat.completions.parse()` + `zodResponseFormat(StoryArcSchema, 'story_arc')` for OpenAI. Post-validate with `StoryArcSchema.parse()` as the final safety net. Both providers get `temperature: 0` for NARR-09 determinism.

---

## Standard Stack

### Core (New Dependencies for Phase 3)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | 0.82.0 | Anthropic Claude API client | Official SDK. `client.messages.parse()` + `zodOutputFormat` for structured output. [VERIFIED: npm registry] |
| openai | 6.33.0 | OpenAI API client | Official SDK v6. `client.chat.completions.parse()` + `zodResponseFormat` for structured output. [VERIFIED: npm registry] |

Both go in `packages/core` dependencies (not devDependencies — runtime calls).

### Already in Project

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| zod | 4.3.6 | Schema validation | Already in `@buildstory/core`. `StoryArcSchema` + `StoryBeatSchema` already defined. |

### SDK Zod Helpers (Sub-path Imports)

| Import | From | Purpose |
|--------|------|---------|
| `zodOutputFormat` | `@anthropic-ai/sdk/helpers/zod` | Converts Zod schema to Anthropic `output_config.format` |
| `zodResponseFormat` | `openai/helpers/zod` | Converts Zod schema to OpenAI `response_format` |

Both sub-path imports are supported in ESM environments. [VERIFIED: official GitHub helpers.md docs]

### Installation

```bash
# Add LLM SDKs to @buildstory/core (runtime deps — not devDeps)
pnpm add --filter @buildstory/core @anthropic-ai/sdk@^0.82.0 openai@^6.33.0
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 3 additions)

```
packages/core/src/
├── narrate/
│   ├── index.ts             # narrate() — replaces stub
│   ├── providers/
│   │   ├── interface.ts     # LLMProvider interface
│   │   ├── anthropic.ts     # AnthropicProvider implementation
│   │   └── openai.ts        # OpenAIProvider implementation
│   ├── prompts/
│   │   ├── system.ts        # Style preset system prompts
│   │   └── format-prompts.ts # Per-format system prompts
│   └── chunker.ts           # Phase-boundary chunking logic
├── format/
│   └── index.ts             # format() — replaces stub
packages/cli/src/
└── commands/
    └── narrate.ts           # New: buildstory narrate <timeline.json>
```

### Pattern 1: LLMProvider Interface

**What:** A common interface that both providers implement. `narrate()` accepts a provider instance, not raw API keys.

**When to use:** Everywhere in `narrate/index.ts`.

```typescript
// Source: CONTEXT.md + established provider interface pattern
// packages/core/src/narrate/providers/interface.ts
import type { StoryArc } from '../../types/story.js'
import type { Timeline } from '../../types/timeline.js'

export interface LLMProvider {
  extractStoryArc(timeline: Timeline, style: string): Promise<StoryArc>
  generateFormat(arc: StoryArc, formatType: string, prompt: string): Promise<string>
  synthesizeArcs(arcs: StoryArc[], systemPrompt: string): Promise<StoryArc>
}
```

### Pattern 2: Anthropic Structured Output via `client.messages.parse()`

**What:** Use `client.messages.parse()` with `zodOutputFormat()` — the new native Anthropic structured output API (GA as of late 2025).

**When to use:** `AnthropicProvider.extractStoryArc()`.

```typescript
// Source: [VERIFIED: https://platform.claude.com/docs/en/build-with-claude/structured-outputs]
// packages/core/src/narrate/providers/anthropic.ts
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { StoryArcSchema } from '../../types/story.js'

const client = new Anthropic({ apiKey })

const response = await client.messages.parse({
  model: 'claude-sonnet-4-5',
  max_tokens: 4096,
  temperature: 0,        // NARR-09: determinism
  system: systemPrompt,  // style preset
  messages: [{ role: 'user', content: timelineJson }],
  output_config: {
    format: zodOutputFormat(StoryArcSchema)
  }
})

// parsed_output is typed as StoryArc (inferred from zodOutputFormat)
const arc = response.parsed_output
```

**Response extraction:** `response.parsed_output` — already validated against `StoryArcSchema` by the SDK helper. Still run `StoryArcSchema.parse()` as a final safety net per project conventions.

### Pattern 3: OpenAI Structured Output via `client.chat.completions.parse()`

**What:** Use `client.chat.completions.parse()` with `zodResponseFormat()`.

**When to use:** `OpenAIProvider.extractStoryArc()`.

```typescript
// Source: [VERIFIED: https://github.com/openai/openai-node/blob/master/helpers.md]
// packages/core/src/narrate/providers/openai.ts
import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { StoryArcSchema } from '../../types/story.js'

const client = new OpenAI({ apiKey })

const completion = await client.chat.completions.parse({
  model: 'gpt-4o',
  temperature: 0,        // NARR-09: determinism
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: timelinePayload }
  ],
  response_format: zodResponseFormat(StoryArcSchema, 'story_arc')
})

const arc = completion.choices[0]?.message.parsed
```

**Response extraction:** `completion.choices[0]?.message.parsed` — typed as `StoryArc`. Null-check required (can be null on content filter or length finish reason). Still post-validate with `StoryArcSchema.parse()`.

### Pattern 4: Token Estimation and Cost Guard (NARR-08)

**What:** Estimate token count before any API call; chunk or fail if over limit.

```typescript
// Source: D-07 (CONTEXT.md)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)  // ~4 chars per token, safe overestimate
}

function buildTimelinePayload(timeline: Timeline): string {
  return JSON.stringify(timeline)
}

function guardTokens(payload: string, maxInputTokens: number): void {
  const estimated = estimateTokens(payload)
  if (estimated > maxInputTokens) {
    throw new Error(
      `Timeline too large: estimated ${estimated} tokens exceeds limit of ${maxInputTokens}. ` +
      `Use chunking or increase maxInputTokens.`
    )
  }
}
```

### Pattern 5: Phase-Boundary Chunking (D-06)

**What:** Group `TimelineEvent` records by their source phase prefix when the full timeline is too large.

```typescript
// Source: D-06 (CONTEXT.md) + TimelineEvent.path field
function groupByPhase(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const groups = new Map<string, TimelineEvent[]>()
  for (const event of events) {
    // Extract phase prefix from path e.g. ".planning/phases/01-scaffold/"
    const match = event.path?.match(/phases\/(\d+-[^/]+)/)
    const key = match ? match[1] : 'ungrouped'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(event)
  }
  return groups
}
```

### Pattern 6: Format Generation (D-04)

**What:** Second LLM call per format type. `format()` stub already exists in `packages/core/src/format/index.ts`.

```typescript
// Source: D-04 (CONTEXT.md)
// The StoryArc beats become the user message; format prompt becomes system message
async function generateFormat(arc: StoryArc, formatType: FormatType): Promise<string> {
  const prompt = FORMAT_PROMPTS[formatType]  // e.g. "Write 8-15 tweets, each under 280 chars..."
  const arcJson = JSON.stringify(arc.beats, null, 2)
  // Plain text output — no structured output needed for format calls
  // Use chat completion / messages.create (not .parse) since output is free text
  return provider.generateFormat(arc, formatType, prompt)
}
```

### Pattern 7: `buildstory narrate` CLI Command

**What:** New `packages/cli/src/commands/narrate.ts` following the same pattern as `scan.ts`.

```typescript
// Source: established CLI pattern from packages/cli/src/commands/run.ts
// Reads timeline.json from disk, calls narrate() + format(), writes output files
import { readFile, writeFile } from 'node:fs/promises'
import { narrate, format } from '@buildstory/core'
import type { FormatType } from '@buildstory/core'
import { TimelineSchema } from '@buildstory/core'

export async function narrateCommand(
  timelinePath: string,
  opts: { format?: string; provider: string; style: string; output: string }
): Promise<void> {
  const raw = await readFile(timelinePath, 'utf-8')
  const timeline = TimelineSchema.parse(JSON.parse(raw))
  const arc = await narrate(timeline, { provider, style, apiKey })
  const formatTypes: FormatType[] = opts.format
    ? [opts.format as FormatType]
    : ['outline', 'thread', 'blog', 'video-script']
  for (const ft of formatTypes) {
    const text = await format(arc, ft)
    await writeFile(`${opts.output}/${ft}.md`, text)
  }
}
```

### Anti-Patterns to Avoid

- **Calling raw `messages.create()` for structured output**: Use `messages.parse()` with `zodOutputFormat` — it handles the `output_config` construction, validates the response, and types the return value. Raw `create()` returns untyped text.
- **Trusting `parsed_output` without Zod post-validation**: The SDK helper validates but project convention requires `StoryArcSchema.parse()` at all pipeline boundaries.
- **Putting LLM SDK imports in the CLI package**: SDKs go in `@buildstory/core` because `narrate()` lives there. CLI is a thin wrapper.
- **Using `zod-to-json-schema` package**: It does not reliably support Zod v4. Use `z.toJSONSchema()` (native Zod v4 method) if you need raw JSON Schema, or use the SDK helpers (`zodOutputFormat` / `zodResponseFormat`) which handle conversion internally.
- **Expecting full determinism from `temperature: 0`**: LLMs are probabilistic. `temperature: 0` and structured outputs reduce variation significantly but cannot guarantee byte-identical output. NARR-09 says "equivalent" — that's achievable.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zod schema → JSON Schema conversion | Custom schema serializer | `zodOutputFormat` (Anthropic) / `zodResponseFormat` (OpenAI) | SDK helpers handle provider-specific schema transformations and edge cases |
| Response validation and parsing | Custom JSON parser + type guards | `client.messages.parse()` / `client.chat.completions.parse()` | SDK handles finish reason errors, content filter errors, parse errors |
| Token counting | tiktoken or equivalent | `Math.ceil(text.length / 4)` | D-07 locks this; no heavy dep needed for a cost guard heuristic |
| Retry logic | Custom exponential backoff | SDK's built-in retry (`maxRetries` option) | Both `@anthropic-ai/sdk` and `openai` SDK have built-in retry with backoff |

**Key insight:** Both SDK helpers (`zodOutputFormat`, `zodResponseFormat`) handle the complex problem of converting Zod schemas to provider-specific JSON Schema format with all the edge cases (optional fields, union types, enums). Do not write this conversion manually.

---

## Common Pitfalls

### Pitfall 1: OpenAI `zodResponseFormat` and Zod v4 Compatibility

**What goes wrong:** `zodResponseFormat` from `openai/helpers/zod` uses vendored `zod-to-json-schema` internally. This had known compatibility issues with Zod v4 that were reported in late 2025 (GitHub issues #1540, #1576).

**Why it happens:** The vendored schema converter expected `ZodFirstPartyTypeKind` which was restructured in Zod v4.

**How to avoid:** Use `openai@^6.33.0` (latest). Check release notes to confirm Zod v4 support. If `zodResponseFormat` fails at runtime, fallback: use `z.toJSONSchema(StoryArcSchema)` (native Zod v4 method) and pass the raw JSON schema to `response_format: { type: 'json_schema', json_schema: { name: 'story_arc', schema: rawSchema, strict: true } }`.

**Warning signs:** TypeScript type errors importing from `openai/helpers/zod`; runtime errors about `ZodFirstPartyTypeKind`; `parsed` being null when the model returns valid JSON.

**Confidence:** MEDIUM — confirmed issues existed; whether `6.33.0` resolves fully needs runtime verification. [CITED: https://github.com/openai/openai-node/issues/1540]

### Pitfall 2: Anthropic `output_config` vs Old `output_format` Parameter

**What goes wrong:** Older code examples use `output_format` at the top-level of `messages.create()`. The API has moved this to `output_config.format`. Old beta header (`structured-outputs-2025-11-13`) is also no longer required.

**Why it happens:** The feature moved from beta to GA and the parameter location changed.

**How to avoid:** Use `output_config: { format: zodOutputFormat(schema) }` with `client.messages.parse()`. [VERIFIED: Anthropic structured outputs docs]

**Warning signs:** TypeScript errors on the `output_format` parameter; unexpected `output_format is not a valid property` API errors.

### Pitfall 3: ESM Sub-Path Imports in tsup Build

**What goes wrong:** `import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'` fails at build time or runtime if `tsup` or the project's tsconfig doesn't resolve sub-path exports.

**Why it happens:** Sub-path exports (`"./helpers/zod"` in package.json) require `moduleResolution: bundler` or `node16` in tsconfig.

**How to avoid:** The project already uses `moduleResolution: bundler` (recommended in STACK.md for `smol-toml`). Verify `packages/core/tsconfig.json` has `"moduleResolution": "bundler"`. [ASSUMED — need to confirm tsconfig contents]

**Warning signs:** `Cannot find module '@anthropic-ai/sdk/helpers/zod'` at build time.

### Pitfall 4: `StoryArcSchema` Has `version: z.literal('1')` — LLM Won't Produce It

**What goes wrong:** The LLM is unlikely to spontaneously include `"version": "1"` in its output unless explicitly told to. The Zod schema requires it. Structured output enforcement will either reject the response or include the field only if the schema description makes it clear.

**Why it happens:** `z.literal('1')` is a constant, not something the LLM "knows" to include.

**How to avoid:** Add the `version` field explicitly in the system prompt instruction: "Your JSON output MUST include `version: '1'`". Alternatively, strip the `version` field from the schema passed to the LLM (use a subset schema for structured output), then add it back programmatically before calling `StoryArcSchema.parse()`.

**Warning signs:** `StoryArcSchema.parse()` failing with "Expected '1', received undefined" on the `version` field.

### Pitfall 5: OpenAI Seed Parameter Deprecated

**What goes wrong:** Using `seed` parameter for determinism in OpenAI requests may not work as expected.

**Why it happens:** The `seed` parameter was reported as deprecated for ChatCompletions as of October 2025. [CITED: OpenAI community forums, Oct 2025]

**How to avoid:** Use `temperature: 0` as the primary determinism control. Do not rely on `seed`. OpenAI's structured outputs + `temperature: 0` provides sufficient determinism for NARR-09's "equivalent output" requirement. [VERIFIED: NARR-09 says "equivalent", not "byte-identical"]

### Pitfall 6: Timeline JSON Can Be Large — Serialize Thoughtfully

**What goes wrong:** Passing the full `Timeline` object as JSON in the user message sends all `rawContent` fields to the LLM, exploding token count.

**Why it happens:** `TimelineEvent.rawContent` stores the full file content of each artifact.

**How to avoid:** Build a trimmed representation for the LLM prompt: include `id`, `date`, `source`, `summary`, `artifactType`, `crossRefs` — omit `rawContent` or truncate it. Token estimate should run on the trimmed payload, not the raw JSON.

---

## Code Examples

Verified patterns from official sources:

### Anthropic: Full Structured Output Call

```typescript
// Source: [VERIFIED: https://platform.claude.com/docs/en/build-with-claude/structured-outputs]
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { StoryArcSchema } from '../types/story.js'

const client = new Anthropic({ apiKey })

const response = await client.messages.parse({
  model: 'claude-sonnet-4-5',
  max_tokens: 4096,
  temperature: 0,
  system: systemPrompt,
  messages: [{ role: 'user', content: timelinePayload }],
  output_config: {
    format: zodOutputFormat(StoryArcSchema)
  }
})

// parsed_output is StoryArc | null (null on refusal)
if (!response.parsed_output) throw new Error('LLM refused or failed to produce structured output')
const arc = StoryArcSchema.parse(response.parsed_output)  // final safety net
```

### OpenAI: Full Structured Output Call

```typescript
// Source: [VERIFIED: https://github.com/openai/openai-node/blob/master/helpers.md]
import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { StoryArcSchema } from '../types/story.js'

const client = new OpenAI({ apiKey })

const completion = await client.chat.completions.parse({
  model: 'gpt-4o',
  temperature: 0,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: timelinePayload }
  ],
  response_format: zodResponseFormat(StoryArcSchema, 'story_arc')
})

const parsed = completion.choices[0]?.message.parsed
if (!parsed) throw new Error('LLM refused or failed to produce structured output')
const arc = StoryArcSchema.parse(parsed)  // final safety net
```

### SDK Built-in Retry

```typescript
// Both SDKs support maxRetries option:
// Source: [ASSUMED — standard SDK option, but pattern is conventional]
const anthropicClient = new Anthropic({ apiKey, maxRetries: 2 })
const openaiClient = new OpenAI({ apiKey, maxRetries: 2 })
```

### Native Zod v4 JSON Schema (Fallback)

```typescript
// If zodResponseFormat has Zod v4 issues, use native conversion:
// Source: [VERIFIED: https://zod.dev/json-schema — Zod v4 native .toJSONSchema()]
import { z } from 'zod'
const rawSchema = z.toJSONSchema(StoryArcSchema)
// Then pass to response_format manually
```

### Style Prompt Pattern

```typescript
// Source: CONTEXT.md + design doc spec
const STYLE_PROMPTS: Record<string, string> = {
  technical: `You are a technical writer extracting a development narrative...`,
  overview: `You are a product communicator summarizing a project arc...`,
  retrospective: `You are writing a retrospective — what was learned, what was pivoted...`,
  pitch: `You are writing for investors and stakeholders — outcomes, momentum, traction...`
}
```

### Format-Specific Targets (from design doc)

```typescript
// Source: CONTEXT.md design doc reference
const FORMAT_SPECS = {
  outline:       'narrative essay, 800-1500 words, full arc with H2 sections',
  thread:        '8-15 posts, each under 280 characters, ends with CTA',
  blog:          '500-1000 words, H2 sections, code blocks where relevant, blockquotes for key decisions',
  'video-script':'60-120 second narration, [SCENE: type] markers before each segment'
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Anthropic tool_use workaround for structured output | `output_config.format` + `client.messages.parse()` | Nov 2025 → GA | Simpler code; no tool_use loop needed; `zodOutputFormat` handles schema conversion |
| Manual JSON schema for OpenAI function calling | `zodResponseFormat` + `client.chat.completions.parse()` | Aug 2024 | SDK handles Zod conversion + response parsing |
| OpenAI `seed` parameter for determinism | `temperature: 0` (seed deprecated Oct 2025) | Oct 2025 | Use temperature control only |
| `zod-to-json-schema` package | `z.toJSONSchema()` native method | Zod v4 (Aug 2025) | Zero external dependency; package no longer maintained |

**Deprecated/outdated:**
- `output_format` (top-level Anthropic param): moved to `output_config.format`
- `anthropic-beta: structured-outputs-2025-11-13` header: no longer required
- `openai` seed parameter: deprecated Oct 2025 per community reports [LOW confidence — single source]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | OpenAI `zodResponseFormat` fully supports Zod v4 in v6.33.0 | Pitfall 1, Code Examples | May need to use `z.toJSONSchema()` fallback instead; extra work but not blocking |
| A2 | `packages/core/tsconfig.json` already has `moduleResolution: bundler` | Pitfall 3 | If not set, sub-path imports fail at build; fixable in Wave 0 |
| A3 | Claude SDK `maxRetries` constructor option is supported in 0.82.0 | Code Examples | If not supported in this version, implement manual try/catch retry; low risk |
| A4 | OpenAI `seed` parameter is deprecated | State of the Art | If still supported, it can be added for extra determinism; not blocking |

---

## Open Questions (RESOLVED)

1. **Does `zodResponseFormat` work with Zod v4 in openai@6.33.0?**
   - What we know: There were breaking issues in mid-2025 (GitHub issues #1540, #1576). SDK claims Zod v4 support as of current versions.
   - What's unclear: Whether `6.33.0` specifically (the version in STACK.md) resolves all edge cases with `StoryArcSchema`'s union types and literals.
   - Recommendation: Wave 0 should include a smoke test — install both SDKs, run `zodResponseFormat(StoryArcSchema, 'test')` and verify it produces a valid JSON schema without throwing.
   - **RESOLVED:** Plan 02 Task 1 implements a Zod v4 fallback path in OpenAIProvider — if `zodResponseFormat` throws at import or call time, falls back to `z.toJSONSchema(StoryArcSchema)` with manual `response_format: { type: 'json_schema', json_schema: { name: 'story_arc', schema: rawSchema, strict: true } }`. Runtime smoke test is implicit in provider unit tests.

2. **Which Claude model should be the default?**
   - What we know: `claude-sonnet-4-5` appears in Anthropic SDK examples. The design doc mentions Claude Sonnet cost estimates.
   - What's unclear: Whether to default to `claude-sonnet-4-5` or `claude-opus-4-5`. Cost vs. quality tradeoff is Claude's discretion per CONTEXT.md.
   - Recommendation: Default to `claude-sonnet-4-5` (cost-efficient); add a `model` option to `NarrateOptions` for override in a future phase.
   - **RESOLVED:** Plan 02 Task 1 defaults AnthropicProvider to `'claude-sonnet-4-5'` — cost-efficient for narrative extraction. Model override deferred to future `NarrateOptions.model` field.

3. **Which GPT model should be the default?**
   - What we know: `gpt-4o` is the standard for structured output with `zodResponseFormat`.
   - What's unclear: Whether `gpt-4o-mini` produces acceptable StoryArc quality.
   - Recommendation: Default to `gpt-4o`; allow override via `NarrateOptions.model` in future.
   - **RESOLVED:** Plan 02 Task 1 defaults OpenAIProvider to `'gpt-4o'` — best structured output quality. Model override deferred to future `NarrateOptions.model` field.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22 | Both SDKs | ✓ | 22.22.0 | — |
| `@anthropic-ai/sdk` | NARR-01 | ✗ (not installed) | — | Must install in Wave 0 |
| `openai` | NARR-02 | ✗ (not installed) | — | Must install in Wave 0 |
| `ANTHROPIC_API_KEY` env var | NARR-01 | Not verified | — | CLI reads from env; core accepts via options |
| `OPENAI_API_KEY` env var | NARR-02 | Not verified | — | CLI reads from env; core accepts via options |
| pnpm | Package install | ✓ (project uses it) | 10.x | — |

**Missing dependencies with no fallback:**
- `@anthropic-ai/sdk` and `openai` must be installed via `pnpm add --filter @buildstory/core` before any narrate work can proceed. This is a Wave 0 prerequisite.

**Missing dependencies with fallback:**
- API keys: not validated at research time. CLI already handles missing keys with a clear error (reads from env). Core receives `apiKey` via `NarrateOptions` — callers are responsible for providing it.

---

## Sources

### Primary (HIGH confidence)
- [Anthropic structured outputs docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — `output_config.format`, `zodOutputFormat`, `client.messages.parse()`, TypeScript examples verified
- [anthropic-sdk-typescript/helpers.md](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/helpers.md) — `zodOutputFormat` usage, `output_config` format, Zod integration
- [openai/openai-node/helpers.md](https://github.com/openai/openai-node/blob/master/helpers.md) — `zodResponseFormat`, `client.chat.completions.parse()`, TypeScript examples
- [npm: @anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk) — version 0.82.0 confirmed
- [npm: openai](https://www.npmjs.com/package/openai) — version 6.33.0 confirmed
- [zod.dev/json-schema](https://zod.dev/json-schema) — `z.toJSONSchema()` native Zod v4 method

### Secondary (MEDIUM confidence)
- [OpenAI community: seed deprecation](https://community.openai.com/t/is-the-seed-parameter-getting-deprecated/1363139) — seed deprecated Oct 2025 (community report)
- [GitHub: openai-node #1540](https://github.com/openai/openai-node/issues/1540) — Zod v4 zodResponseFormat compatibility issue

### Tertiary (LOW confidence)
- OpenAI seed deprecation claims — from community forum posts, not official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both SDK versions confirmed via npm registry; API patterns verified via official docs
- Architecture: HIGH — provider interface pattern follows existing project conventions; structured output patterns from official sources
- Pitfalls: MEDIUM — Pitfall 1 (Zod v4 compat) and Pitfall 5 (seed deprecation) are MEDIUM due to community source reliance

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (30 days — LLM SDK APIs are relatively stable; Anthropic structured outputs GA as of Nov 2025)
