# Architecture Research

**Domain:** TypeScript monorepo toolkit — file scanner + LLM pipeline + video renderer
**Researched:** 2026-04-05
**Updated:** 2026-04-14 (HeyGen renderer integration added)
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Wrapper Layer                               │
│  ┌──────────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │   buildstory     │  │ n8n-nodes-      │  │  @buildstory/ │  │
│  │   (CLI package)  │  │ buildstory      │  │  mcp (future) │  │
│  │                  │  │ (n8n package)   │  │               │  │
│  │ commander args   │  │ n8n INode impl  │  │  MCP protocol │  │
│  └────────┬─────────┘  └────────┬────────┘  └───────┬───────┘  │
│           │                     │                    │          │
└───────────┼─────────────────────┼────────────────────┼──────────┘
            │         workspace:* │                    │
            └─────────────────────┼────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────┐
│                   @buildstory/core                               │
│                                                                  │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐  │
│  │  scan()      │  │  narrate()    │  │  render()            │  │
│  │              │  │               │  │                      │  │
│  │  FileWalker  │  │  LLMProvider  │  │  FrameGenerator      │  │
│  │  GitReader   │  │  (Anthropic/  │  │  TTSProvider         │  │
│  │  ArtifactParser  │  OpenAI)     │  │  FFmpegAssembler     │  │
│  │  Timeline    │  │  ScriptBuilder│  │                      │  │
│  └──────┬───────┘  └──────┬────────┘  └──────────┬───────────┘  │
│         │                 │                       │              │
│  Timeline JSON      Script JSON              Video file          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
            │                 │                       │
┌───────────┴─────────────────┴───────────────────────┴────────────┐
│                    External Dependencies                          │
│                                                                   │
│  ┌──────────────┐  ┌────────────────┐  ┌───────────────────────┐ │
│  │  Filesystem  │  │  LLM APIs      │  │  FFmpeg binary        │ │
│  │  Git repo    │  │  (Anthropic /  │  │  (ffmpeg-static or    │ │
│  │              │  │   OpenAI)      │  │   system install)     │ │
│  └──────────────┘  └────────────────┘  └───────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `buildstory` (CLI) | Parse argv, load `buildstory.toml`, call core functions, write output | `@buildstory/core` only |
| `n8n-nodes-buildstory` | Implement n8n INode interface, map n8n credentials/params to core inputs | `@buildstory/core` only |
| `@buildstory/core` | All business logic: scan, narrate, render | External APIs, filesystem, FFmpeg |
| `FileWalker` | Glob-based artifact discovery, include/exclude patterns | `fast-glob`, local filesystem |
| `GitReader` | Commit history, blame, tags, branch events | `simple-git` |
| `ArtifactParser` | Markdown heading/date/status/xref extraction | `remark` or `unified` |
| `Timeline` | Merge file+git events into sorted chronological structure, emit Timeline JSON | FileWalker, GitReader, ArtifactParser |
| `LLMProvider` | Abstract interface for Anthropic and OpenAI; structured JSON output | Anthropic SDK, OpenAI SDK |
| `ScriptBuilder` | Four narrative styles; scene segmentation; duration pacing | LLMProvider |
| `FrameGenerator` | Render visual frames per scene type | `node-canvas` or `sharp` |
| `TTSProvider` | Abstract TTS interface; OpenAI TTS default | OpenAI TTS API |
| `FFmpegAssembler` | Stitch frames + audio, fades, subtitles, output video | `fluent-ffmpeg` + ffmpeg binary |

## Recommended Project Structure

```
build-story/
├── packages/
│   ├── core/                       # @buildstory/core
│   │   ├── src/
│   │   │   ├── scan/
│   │   │   │   ├── file-walker.ts      # fast-glob based artifact discovery
│   │   │   │   ├── git-reader.ts       # simple-git history integration
│   │   │   │   ├── artifact-parser.ts  # markdown extraction
│   │   │   │   ├── timeline.ts         # merge + sort into Timeline
│   │   │   │   └── index.ts            # exports scan()
│   │   │   ├── narrate/
│   │   │   │   ├── llm-provider.ts     # abstract interface
│   │   │   │   ├── anthropic.ts        # Anthropic implementation
│   │   │   │   ├── openai.ts           # OpenAI implementation
│   │   │   │   ├── script-builder.ts   # styles, scenes, pacing
│   │   │   │   └── index.ts            # exports narrate()
│   │   │   ├── render/
│   │   │   │   ├── frame-generator.ts  # node-canvas/sharp frame rendering
│   │   │   │   ├── tts-provider.ts     # abstract TTS interface
│   │   │   │   ├── openai-tts.ts       # OpenAI TTS implementation
│   │   │   │   ├── ffmpeg-assembler.ts # fluent-ffmpeg video assembly
│   │   │   │   └── index.ts            # exports render()
│   │   │   ├── types/
│   │   │   │   ├── timeline.ts         # TimelineEvent, Timeline
│   │   │   │   ├── script.ts           # Scene, Script
│   │   │   │   └── options.ts          # ScanOptions, NarrateOptions, RenderOptions
│   │   │   └── index.ts                # public API: scan, narrate, render + types
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cli/                        # buildstory (CLI binary)
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   │   ├── scan.ts             # buildstory scan
│   │   │   │   ├── narrate.ts          # buildstory narrate
│   │   │   │   ├── render.ts           # buildstory render (updated v1.1)
│   │   │   │   └── run.ts              # buildstory run (all three)
│   │   │   ├── config.ts               # buildstory.toml loader (updated v1.1)
│   │   │   └── index.ts                # commander entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── video/                      # @buildstory/video (Remotion renderer)
│   │   └── src/
│   │       ├── tts/                # OpenAI TTS orchestration
│   │       ├── render/             # Remotion composition + ffmpeg assembly
│   │       ├── preflight.ts        # Chrome + ffprobe + API key checks
│   │       └── index.ts
│   │
│   ├── heygen/                     # @buildstory/heygen (NEW — v1.1)
│   │   └── src/
│   │       ├── types.ts            # HeyGenOptions, HeyGenResult, API Zod schemas
│   │       ├── client.ts           # fetch wrapper: createVideo(), getVideoStatus()
│   │       ├── adapter.ts          # StoryArc → HeyGen video_inputs payload
│   │       ├── poll.ts             # polling loop with timeout and backoff
│   │       ├── download.ts         # stream video_url to local file
│   │       ├── cost.ts             # credit estimation before submission
│   │       ├── preflight.ts        # HEYGEN_API_KEY check, optional avatar/voice validation
│   │       └── index.ts            # exports renderHeyGen(), preflightHeyGenCheck(), estimateHeyGenCost()
│   │
│   └── n8n-nodes/                  # n8n-nodes-buildstory (future milestone)
│
├── pnpm-workspace.yaml
├── package.json
├── turbo.json
└── tsconfig.base.json
```

---

## HeyGen Renderer Integration (v1.1)

### Decision: New Package `@buildstory/heygen`

Create `packages/heygen/` as a new standalone package. Do not modify `@buildstory/video`.

**Why a separate package:**
- `@buildstory/video` bundles Remotion (headless Chrome), FFmpeg, OpenAI TTS, and canvas — all heavy native dependencies. HeyGen is HTTP-only. Mixing them forces every HeyGen user to install 200MB+ of rendering dependencies they do not need.
- The milestone goal is "without touching the existing Remotion pipeline" — a structural package boundary enforces this.
- Consistent with existing pattern: each renderer is an independently installable package. The CLI lazy-imports whichever is needed.

### Updated Package Dependency Graph

```
@buildstory/core          (unchanged — owns StoryArc, StoryBeat types)
        ↑                         ↑
@buildstory/video          @buildstory/heygen (NEW)
(Remotion renderer)        (HeyGen HTTP renderer)
        ↑                         ↑
        └─────────────────────────┘
                    ↑
              buildstory CLI
```

### HeyGen API Mechanics

**MEDIUM confidence** — WebSearch confirmed against official HeyGen docs structure; WebFetch unavailable for full verification.

**Generate video:**
`POST https://api.heygen.com/v2/video/generate`
Header: `X-Api-Key: {HEYGEN_API_KEY}`

Request body:
```typescript
{
  video_inputs: [{
    character: {
      type: "avatar",
      avatar_id: string,      // from config or --avatar flag
      avatar_style: "normal"
    },
    voice: {
      type: "text",
      input_text: string,     // narration text, ≤5000 chars per item
      voice_id: string,       // from config or --voice flag
      speed: number           // 0.8–1.2 recommended
    },
    background: {
      type: "color",
      value: "#1a1a2e"
    }
  }],
  dimension: { width: 1280, height: 720 }
}
```

Response: `{ data: { video_id: string } }`

**Key difference from Remotion:** HeyGen performs TTS server-side. There is no local audio generation step. The beat summaries from `StoryArc` map directly to `input_text`.

**Poll for completion:**
`GET https://api.heygen.com/v1/video_status.get?video_id={video_id}`

Status values: `"pending"` | `"processing"` | `"completed"` | `"failed"`

On `"completed"`, response includes `video_url` (valid 7 days). Poll every 10 seconds; typical generation time 2–5 minutes per video.

**Cost:** Standard avatar = 1 credit per minute of output. Avatar IV = 1 credit per 10 seconds (~6 credits/minute). Pay-as-you-go from $5; no free API credits as of Feb 2026.

**Authentication:** `process.env.HEYGEN_API_KEY` only — never stored in `buildstory.toml`.

### Data Flow: StoryArc → HeyGen → MP4

```
StoryArc (JSON from narrate phase)
    │
    ▼
@buildstory/heygen/adapter.ts
    │  Maps beats[] → single video_inputs item
    │  Concatenates beat summaries (Strategy A — see below)
    │  Injects avatar_id, voice_id from HeyGenOptions
    │  Estimates credit cost from beat.duration_seconds
    │
    ▼
@buildstory/heygen/client.ts
    │  POST /v2/video/generate → video_id
    │
    ▼
@buildstory/heygen/poll.ts
    │  GET /v1/video_status.get?video_id={id}
    │  Polls every 10s, reports progress via onProgress callback
    │  Default timeout: 10 minutes (configurable via HEYGEN_TIMEOUT_SECONDS)
    │
    ▼
@buildstory/heygen/download.ts
    │  Streams video_url → outputPath MP4
    │
    ▼
MP4 file at opts.outputPath
```

### Multi-Beat Strategy: Concatenation (v1.1)

HeyGen's `video_inputs` accepts multiple items, but community reports indicate only the first item is reliably processed when items use different character/voice configurations. Two approaches exist:

**Strategy A — Single concatenated narration (recommended for v1.1):**
Concatenate all `beat.summary` texts (prefixed with beat titles) into one `input_text` within a single `video_inputs` item. HeyGen renders one continuous avatar narration. This is simpler, avoids reliability issues with multi-item arrays, and produces an immediately usable video. Character limit: 5000 chars per item; use 4800 as safe buffer.

**Strategy B — Per-beat segments with ffmpeg stitch (future):**
Submit one `video_inputs` item per beat, receive N `video_id`s, poll all, download N MP4s, stitch with ffmpeg. Produces per-beat visual variety. Adds ffmpeg dependency to `@buildstory/heygen` and significant API call overhead. Defer until Strategy A validates the concept.

Text assembly for Strategy A:
```typescript
function buildInputText(beats: StoryBeat[]): string {
  const MAX = 4800
  const parts = beats.map(b => `${b.title}. ${b.summary}`)
  let text = parts.join(' ')
  if (text.length > MAX) {
    // truncate at last sentence boundary; log a warning with beat count dropped
    text = text.slice(0, text.lastIndexOf('.', MAX) + 1) || text.slice(0, MAX)
  }
  return text
}
```

### Renderer Interface Contract

A minimal interface for the CLI to dispatch to either renderer. **Do not over-engineer**: two renderers do not require a plugin registry. A simple discriminated union in the CLI render command is sufficient for v1.1.

```typescript
// Location: packages/cli/src/commands/render.ts (inline, not a shared package)
// Rationale: renderer concerns belong to the wrapper layer, not @buildstory/core

export interface VideoRenderer {
  readonly name: string
  preflight(opts: unknown): Promise<{ ok: boolean; failures: string[] }>
  estimate(arc: StoryArc): { label: string; estimatedCostUSD?: number; estimatedDurationSeconds: number }
  render(arc: StoryArc, opts: { outputPath: string; onProgress?: (progress: number) => void }): Promise<void>
}
```

Do not put this interface in `@buildstory/core`. Core must remain free of rendering concerns per the package boundary constraint in CLAUDE.md.

### New `HeyGenOptions` Type

```typescript
// packages/heygen/src/types.ts
export interface HeyGenOptions {
  apiKey: string           // from process.env.HEYGEN_API_KEY
  avatarId: string         // required: HeyGen avatar ID
  voiceId: string          // required: HeyGen voice ID
  width?: number           // default: 1280
  height?: number          // default: 720
  speed?: number           // default: 1.0
  timeoutSeconds?: number  // default: 600
}

export interface HeyGenResult {
  videoId: string
  videoUrl: string
  durationSeconds: number
  creditsUsed: number
}
```

### CLI Integration Points

**Modified: `packages/cli/src/commands/render.ts`**

Current path: preflight → TTS → renderVideo()

New path: resolve renderer → branch:

```typescript
const renderer = opts.renderer ?? config.video?.renderer ?? 'remotion'

if (renderer === 'heygen') {
  // lazy import — no Remotion/ffmpeg installed needed
  const heygenPkg = await import('@buildstory/heygen')
  const apiKey = process.env['HEYGEN_API_KEY'] ?? ''
  if (!apiKey) {
    console.error(chalk.red('  HEYGEN_API_KEY not set. Required for --renderer=heygen.'))
    process.exit(1)
  }
  // preflight → estimate → renderHeyGen()
} else {
  // existing Remotion path — unchanged
  const video = await import('@buildstory/video')
  // ... existing TTS + renderVideo() flow
}
```

**Modified: `packages/cli/src/config.ts`**

Extend `BuildStoryConfig`:
```typescript
export interface BuildStoryConfig {
  // ... existing fields ...
  video?: {
    renderer?: 'remotion' | 'heygen'
  }
  heygen?: {
    avatarId?: string     // default avatar for this project
    voiceId?: string      // default voice for this project
  }
}
```

`HEYGEN_API_KEY` is never added to `BuildStoryConfig`. It is always read from `process.env`.

### CLI Flag

Add `--renderer <name>` to `buildstory render` and `buildstory run` commands:

```bash
buildstory render story-arc.json --renderer=heygen
buildstory render story-arc.json --renderer=heygen --avatar=<id> --voice=<id>
buildstory run --renderer=heygen
```

`--avatar` and `--voice` flags override `buildstory.toml` heygen config. If neither flag nor config provides them, preflight fails with a clear error listing how to find available avatar/voice IDs.

### Build Order for v1.1 Milestone

```
1. packages/heygen/src/types.ts
   packages/cli/src/commands/render.ts (VideoRenderer interface only)
   — No dependencies. Defines contracts upfront.

2. packages/heygen/src/client.ts
   packages/heygen/src/preflight.ts
   — Depends on types. Immediately testable against HeyGen API.

3. packages/heygen/src/adapter.ts
   — Depends on StoryArc from @buildstory/core (already built).
   — Pure function, unit-testable without API.

4. packages/heygen/src/poll.ts
   packages/heygen/src/download.ts
   packages/heygen/src/cost.ts
   — Depends on client types. Complete polling + download logic.

5. packages/heygen/src/index.ts (renderHeyGen orchestration)
   — Wires all above. Integration-testable end-to-end.

6. packages/cli/src/commands/render.ts (full renderer dispatch)
   packages/cli/src/config.ts (heygen config section)
   — Last because it depends on the package being functional.
```

---

## Architectural Patterns

### Pattern 1: Unidirectional Dependency Flow

**What:** Dependencies only point inward — wrappers depend on core, core has zero knowledge of wrappers. Enforced at the package.json level: `@buildstory/core` has no `workspace:*` dependencies on CLI or n8n packages.

**When to use:** Always. This is the load-bearing constraint for the wrapper pattern.

**Trade-offs:** Core must express all configurability through typed options objects. No "check if running in CLI" conditionals inside core.

**Example:**
```typescript
// packages/core/src/index.ts — the only interface wrappers see
export async function scan(options: ScanOptions): Promise<Timeline> { ... }
export async function narrate(timeline: Timeline, options: NarrateOptions): Promise<Script> { ... }
export async function render(script: Script, options: RenderOptions): Promise<RenderResult> { ... }

// packages/cli/src/commands/run.ts — thin: translate CLI → typed options → call core
const timeline = await scan({ rootDir, patterns, excludes })
const script   = await narrate(timeline, { provider, style, apiKey })
const result   = await render(script, { outputPath, ttsVoice, apiKey })
```

### Pattern 2: Structured JSON as Phase Contracts

**What:** Each pipeline phase produces and consumes versioned, typed JSON. `scan()` → `Timeline`, `narrate()` → `Script`. These are serializable and can be written to disk between phases (enabling `buildstory scan > timeline.json`, then `buildstory narrate --input timeline.json`).

**When to use:** Any time you need phase independence, resumability, or debuggability.

**Trade-offs:** Requires disciplined type design upfront. Schema changes break the pipeline at phase boundaries — use versioned types or Zod validation at parse boundaries.

**Example:**
```typescript
// types/timeline.ts
export interface Timeline {
  version: "1"
  rootDir: string
  scannedAt: string
  dateRange: { start: string; end: string }
  events: TimelineEvent[]
}

export interface TimelineEvent {
  id: string
  date: string
  source: "file" | "git-commit" | "git-tag"
  path?: string
  summary: string
  metadata: Record<string, unknown>
}
```

### Pattern 3: Provider Abstraction for External APIs

**What:** LLM and TTS integrations are implemented behind narrow provider interfaces. Core calls the interface; concrete provider classes are instantiated by the options resolver.

**When to use:** Any external API you want to swap — currently Anthropic/OpenAI for LLM, OpenAI TTS for audio.

**Trade-offs:** Adds one indirection. Worth it: provider classes are the unit-test boundary (mock the interface, not `fetch`).

**Example:**
```typescript
// narrate/llm-provider.ts
export interface LLMProvider {
  complete(prompt: string, schema: ZodSchema): Promise<unknown>
}

// narrate/anthropic.ts
export class AnthropicProvider implements LLMProvider { ... }

// narrate/openai.ts
export class OpenAIProvider implements LLMProvider { ... }
```

### Pattern 4: n8n Node Module System Constraint

**What:** n8n custom nodes MUST output CommonJS. Monorepo packages default to ESM. This creates an incompatibility: you cannot use `"type": "module"` in the n8n package without breaking n8n's `require()` loader.

**When to use:** Applies to `n8n-nodes-buildstory` only.

**Trade-offs:** The n8n package needs `"type": "commonjs"` (or omit `type`) and must compile to CJS with `"module": "CommonJS"` in its tsconfig. The core package remains ESM. The bridge is straightforward because `@buildstory/core` exports pure logic — no DOM, no framework internals.

**Example:**
```jsonc
// packages/n8n-nodes/tsconfig.json
{
  "compilerOptions": {
    "module": "CommonJS",       // ← required for n8n compatibility
    "moduleResolution": "node",
    "outDir": "dist"
  },
  "references": [{ "path": "../core" }]
}
```

## Data Flow

### Pipeline Data Flow

```
Filesystem + Git repo
        ↓
   [FileWalker]  ─────────────────────────────────→  artifact file paths
   [GitReader]   ─────────────────────────────────→  commit/tag/blame events
   [ArtifactParser] ←── file paths ─────────────→  parsed markdown events
        ↓
   [Timeline builder] — merge + sort chronologically
        ↓
   Timeline JSON   (serializable; can write to disk)
        ↓
   [LLMProvider]  ←── Timeline + style prompt ───→  structured scene list
   [ScriptBuilder] — scene segmentation + pacing
        ↓
   StoryArc JSON   (serializable; can write to disk)
        ↓
   ┌────────────────────────────────────┐
   │         Renderer Branch            │
   │                                    │
   │  --renderer=remotion (default)     │  --renderer=heygen
   │  [FrameGenerator] → PNG frames     │  [HeyGen adapter] → video_inputs
   │  [TTSProvider] → WAV audio         │  [HeyGen client] → POST /v2/video/generate
   │  [FFmpegAssembler] → MP4           │  [Poll loop] → wait for completion
   │                                    │  [Download] → stream MP4
   └────────────────────────────────────┘
        ↓
   Output video file (MP4)
```

### Configuration Flow

```
buildstory.toml (global: ~/.config/buildstory/)
        +
buildstory.toml (project: ./buildstory.toml)
        ↓
   [config.ts in CLI] — merge, validate, resolve defaults
        ↓
   ScanOptions / NarrateOptions / RenderOptions / HeyGenOptions
        ↓
   @buildstory/core functions (core never reads toml directly)
   @buildstory/heygen functions (heygen never reads toml directly)
```

### Key Data Flows

1. **Scan phase output is the master record:** All subsequent phases derive from Timeline. If scan produces incorrect dates or missing events, downstream phases cannot correct it — scan quality gates matter most.
2. **Script JSON links back to source events:** Each Scene in Script carries `sourceEventIds: string[]` pointing back into Timeline. This enables future features (provenance, citations) and debugging.
3. **Frames + audio are ephemeral (Remotion path):** Generated in a temp directory during render. Only the assembled video is the final artifact — temp cleanup is the render phase's responsibility.
4. **HeyGen path produces no local intermediate files:** No frames, no audio segments — only the final downloaded MP4. This is the primary dependency advantage of HeyGen.
5. **Resumable pipeline via disk:** `buildstory scan --output timeline.json` followed by `buildstory narrate --input timeline.json` enables partial re-runs without re-scanning or re-calling the LLM. The same story arc JSON can be rendered by either renderer independently.

## Build Order

Dependencies must be built in this order. Turborepo infers this automatically from `workspace:*` references in `package.json`.

```
1. @buildstory/core          ← no internal workspace dependencies
         ↓
2. @buildstory/video         ← depends on workspace:@buildstory/core
   @buildstory/heygen        ← depends on workspace:@buildstory/core (parallel with video)
         ↓
3. buildstory (CLI)          ← depends on workspace:@buildstory/core
                                optionally lazy-imports @buildstory/video or @buildstory/heygen
```

### TypeScript Project References

Each `tsconfig.json` mirrors the package dependency graph:

```jsonc
// packages/cli/tsconfig.json
{
  "compilerOptions": { "composite": true, "outDir": "dist" },
  "references": [{ "path": "../core" }]
}

// packages/heygen/tsconfig.json
{
  "compilerOptions": { "composite": true, "outDir": "dist" },
  "references": [{ "path": "../core" }]
}
```

Running `tsc --build` from the root compiles in dependency order. Turborepo's `build` task is configured to depend on `^build` (upstream packages build first).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Anthropic API | `@anthropic-ai/sdk`, structured output via tool_use | Use `tool_use` for guaranteed JSON schema compliance |
| OpenAI API | `openai` SDK, `response_format: { type: "json_schema" }` | Structured outputs available since GPT-4o |
| OpenAI TTS | `openai` SDK, `audio.speech.create()` | Returns Buffer; write to temp file for ffmpeg |
| FFmpeg | `fluent-ffmpeg` wrapper + `ffmpeg-static` for bundled binary | `ffmpeg-static` avoids requiring system install; detect at startup |
| Git | `simple-git` | Wrap in try/catch — scanning non-git dirs is valid |
| HeyGen API | Native Node `fetch`, `X-Api-Key` header | No SDK — HTTP client is thin enough to DIY; avoids third-party SDK dependency |

### Internal Boundaries

| Boundary | Communication | Contract |
|----------|---------------|----------|
| CLI → core | Function call with typed options objects | `ScanOptions`, `NarrateOptions`, `RenderOptions` in `@buildstory/core/types` |
| CLI → heygen (lazy) | Dynamic `import('@buildstory/heygen')` | `renderHeyGen()`, `preflightHeyGenCheck()`, `estimateHeyGenCost()` |
| CLI → video (lazy) | Dynamic `import('@buildstory/video')` | `renderVideo()`, `orchestrateTTS()`, `preflightCheck()` |
| n8n nodes → core | Same function calls; n8n credentials map to provider API keys | Same typed interfaces — n8n is just another thin caller |
| scan → narrate | `Timeline` JSON object (or deserialized from disk) | `Timeline` type in `@buildstory/core/types/timeline.ts` |
| narrate → render | `StoryArc` JSON object (or deserialized from disk) | `StoryArc` type in `@buildstory/core/types/story.ts` |
| heygen adapter → heygen client | `HeyGenVideoGenerateRequest` (internal type) | Defined in `packages/heygen/src/types.ts` |
| FrameGenerator → FFmpegAssembler | Directory of PNG files + timing metadata | Frame filenames must be zero-padded sequential for ffmpeg concat |
| TTSProvider → FFmpegAssembler | Audio segment files + per-scene duration | Duration from TTS response drives frame count calculation |

## Anti-Patterns

### Anti-Pattern 1: Letting Config Bleed into Core

**What people do:** Import `toml` or read `process.env` inside `@buildstory/core` functions because "it's convenient."

**Why it's wrong:** Core becomes untestable without filesystem setup. n8n and MCP wrappers cannot control config loading. The wrapper value collapses.

**Do this instead:** Core functions accept fully-resolved typed options. The wrapper (CLI, n8n node) is responsible for loading config, resolving defaults, and passing concrete values. Core never touches `process.env` or config files.

### Anti-Pattern 2: Adding HeyGen to `@buildstory/video`

**What people might do:** Extend `@buildstory/video` with a HeyGen code path since it's "also a renderer."

**Why it's wrong:** `@buildstory/video` bundles 200MB+ of native dependencies (Remotion, headless Chrome, canvas, FFmpeg). HeyGen is HTTP-only. A user who only wants HeyGen would install all of it. Separate packages = independent install footprints.

**Do this instead:** `packages/heygen/` as a standalone package. The CLI lazy-imports whichever is needed.

### Anti-Pattern 3: Storing HEYGEN_API_KEY in buildstory.toml

**What people do:** Add `api_key` to the `[heygen]` section of `buildstory.toml` for convenience.

**Why it's wrong:** Config files are committed to repos. API keys in config files leak credentials.

**Do this instead:** Read `process.env.HEYGEN_API_KEY` only. Print a clear diagnostic if missing. Document the env var in README.

### Anti-Pattern 4: Building a Renderer Plugin Registry for Two Renderers

**What people do:** Create a `renderers` registry object, `register()` functions, and runtime dynamic loading by string key.

**Why it's wrong:** Two known renderers do not justify this complexity. It obfuscates the dispatch logic and makes it harder to read.

**Do this instead:** A simple `if (renderer === 'heygen') { ... } else { ... }` in `render.ts`. Refactor if a third renderer is ever needed.

### Anti-Pattern 5: Fat Phase Functions

**What people do:** Write `scan()` as a 500-line function that does walking, git, parsing, and timeline merging in one place.

**Why it's wrong:** Untestable sub-components, no reuse across phases, refactoring requires surgery.

**Do this instead:** Each phase's `index.ts` orchestrates focused sub-components (`FileWalker`, `GitReader`, `ArtifactParser`). Each sub-component is a class or set of functions testable in isolation. The phase function is a thin orchestrator.

### Anti-Pattern 6: Skipping Intermediate JSON Serialization

**What people do:** Chain `scan() → narrate() → render()` in memory only, never allowing disk checkpoints.

**Why it's wrong:** Re-running the full pipeline to iterate on video style means re-scanning (slow) and re-calling LLM (costs money). No way to inspect what the LLM produced.

**Do this instead:** Design `Timeline` and `StoryArc` as serializable from day one. The CLI `run` command chains them in memory by default but accepts `--save-timeline` / `--save-arc` flags. Re-entry points (`buildstory render story-arc.json --renderer=heygen`) use the same core functions with deserialized inputs.

## Scaling Considerations

BuildStory is a local developer tool processing single repositories. Scaling to "many users" means many independent invocations, not a shared server. Relevant scale concerns:

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single repo, typical size | Default architecture — in-process, synchronous pipeline |
| Monorepo with 10k+ files | FileWalker needs concurrency limits; `fast-glob` handles this well with `concurrency` option |
| Long git history (10k+ commits) | GitReader should filter by date range before processing; `simple-git`'s `log({ '--after': date })` |
| Long story arc (20+ beats) | HeyGen: concatenate and truncate at 4800 chars; log beats dropped. Remotion: no limit. |
| Long-form video (30+ min) | Remotion: frame generation bottleneck; consider worker_threads for `node-canvas`. HeyGen: server-side, no local bottleneck |
| HeyGen generation latency | Typical: 2–5 min. Poll with configurable timeout (default 10 min via `HEYGEN_TIMEOUT_SECONDS`) |
| n8n workflows | n8n handles concurrency at workflow level — core functions need to be stateless (they already are with the options pattern) |

## Sources

- n8n monorepo package organization: [DeepWiki n8n core packages](https://deepwiki.com/n8n-io/n8n/1.1-core-packages)
- n8n custom nodes in monorepo (CJS/ESM conflict): [n8n community discussion](https://community.n8n.io/t/building-custom-nodes-in-a-monorepo-possible/45297)
- pnpm workspace protocol and catalog support: [pnpm workspaces docs](https://pnpm.io/workspaces)
- TypeScript project references for build order: [TypeScript docs](https://www.typescriptlang.org/docs/handbook/project-references.html)
- fluent-ffmpeg + ffmpeg-static pattern: [Creatomate video rendering guide](https://creatomate.com/blog/video-rendering-with-nodejs-and-ffmpeg)
- Turborepo dependency graph and build ordering: [Turborepo pipeline guide](https://vercel.com/academy/production-monorepos/update-turborepo-pipeline)
- HeyGen API — [Create Avatar Video v2 reference](https://docs.heygen.com/reference/create-video) (MEDIUM confidence — WebSearch verified, WebFetch unavailable)
- HeyGen API — [Video Status endpoint](https://docs.heygen.com/reference/video-status)
- HeyGen multiple video_inputs limitation: [community thread](https://docs.heygen.com/discuss/6732a523cde84a0016c7b04c) (LOW confidence — community forum report)
- HeyGen API pricing: [heygen.com/api-pricing](https://www.heygen.com/api-pricing)
- Existing codebase: `packages/video/src/render/index.ts`, `packages/video/src/tts/`, `packages/cli/src/commands/render.ts`, `packages/cli/src/config.ts`, `packages/core/src/types/story.ts` — read directly, HIGH confidence

---
*Architecture research for: TypeScript monorepo toolkit — file scanner + LLM pipeline + video renderer*
*Initial research: 2026-04-05 | HeyGen integration: 2026-04-14*
