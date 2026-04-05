# Architecture Research

**Domain:** TypeScript monorepo toolkit — file scanner + LLM pipeline + video renderer
**Researched:** 2026-04-05
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
│   │   │   │   ├── render.ts           # buildstory render
│   │   │   │   └── run.ts              # buildstory run (all three)
│   │   │   ├── config.ts               # buildstory.toml loader (toml parser)
│   │   │   └── index.ts                # commander entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── n8n-nodes/                  # n8n-nodes-buildstory (future milestone)
│       ├── src/
│       │   ├── BuildStoryScan.node.ts
│       │   ├── BuildStoryNarrate.node.ts
│       │   └── BuildStoryRender.node.ts
│       ├── package.json
│       └── tsconfig.json
│
├── pnpm-workspace.yaml
├── package.json                    # root: scripts, shared devDeps
├── turbo.json                      # build task graph
└── tsconfig.base.json              # shared compiler options
```

### Structure Rationale

- **`packages/core/src/scan/`, `narrate/`, `render/`:** Mirror the three pipeline phases. Each subfolder owns everything for that phase, making the boundary visually obvious. Phase-specific types stay colocated with their phase.
- **`packages/core/src/types/`:** Shared data structures (Timeline, Script) that cross phase boundaries live here. These are the contracts between phases — define them early and stabilize them.
- **`packages/core/src/index.ts`:** Single public API surface — `scan()`, `narrate()`, `render()` plus their option/result types. Wrappers import only from this barrel.
- **`packages/cli/src/commands/`:** One file per subcommand. Each command file: parse args → load config → call core → write output. No business logic.
- **`packages/cli/src/config.ts`:** All `buildstory.toml` loading and merging (global + project-level) isolated here. Never bleeds into core.

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
   Script JSON     (serializable; can write to disk)
        ↓
   [FrameGenerator] ← scene visual type assignments → PNG frames per scene
   [TTSProvider]   ← narration text per scene ──────→ audio segments (MP3/WAV)
        ↓
   [FFmpegAssembler] — stitch frames + audio, fades, subtitles
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
   ScanOptions / NarrateOptions / RenderOptions
        ↓
   @buildstory/core functions (core never reads toml directly)
```

### Key Data Flows

1. **Scan phase output is the master record:** All subsequent phases derive from Timeline. If scan produces incorrect dates or missing events, downstream phases cannot correct it — scan quality gates matter most.
2. **Script JSON links back to source events:** Each Scene in Script carries `sourceEventIds: string[]` pointing back into Timeline. This enables future features (provenance, citations) and debugging.
3. **Frames + audio are ephemeral:** Generated in a temp directory during render. Only the assembled video is the final artifact — temp cleanup is the render phase's responsibility.
4. **Resumable pipeline via disk:** `buildstory scan --output timeline.json` followed by `buildstory narrate --input timeline.json` enables partial re-runs without re-scanning or re-calling the LLM. The CLI handles this; core functions accept typed objects and do not know about files.

## Build Order

Dependencies must be built in this order. Turborepo infers this automatically from `workspace:*` references in `package.json`.

```
1. @buildstory/core          ← no internal workspace dependencies
         ↓
2. buildstory (CLI)          ← depends on workspace:@buildstory/core
   n8n-nodes-buildstory      ← depends on workspace:@buildstory/core (parallel with CLI)
```

### TypeScript Project References

Each `tsconfig.json` mirrors the package dependency graph:

```jsonc
// packages/cli/tsconfig.json
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

### Internal Boundaries

| Boundary | Communication | Contract |
|----------|---------------|----------|
| CLI → core | Function call with typed options objects | `ScanOptions`, `NarrateOptions`, `RenderOptions` in `@buildstory/core/types` |
| n8n nodes → core | Same function calls; n8n credentials map to provider API keys | Same typed interfaces — n8n is just another thin caller |
| scan → narrate | `Timeline` JSON object (or deserialized from disk) | `Timeline` type in `@buildstory/core/types/timeline.ts` |
| narrate → render | `Script` JSON object (or deserialized from disk) | `Script` type in `@buildstory/core/types/script.ts` |
| FrameGenerator → FFmpegAssembler | Directory of PNG files + timing metadata | Frame filenames must be zero-padded sequential for ffmpeg concat |
| TTSProvider → FFmpegAssembler | Audio segment files + per-scene duration | Duration from TTS response drives frame count calculation |

## Anti-Patterns

### Anti-Pattern 1: Letting Config Bleed into Core

**What people do:** Import `toml` or read `process.env` inside `@buildstory/core` functions because "it's convenient."

**Why it's wrong:** Core becomes untestable without filesystem setup. n8n and MCP wrappers cannot control config loading. The wrapper value collapses.

**Do this instead:** Core functions accept fully-resolved typed options. The wrapper (CLI, n8n node) is responsible for loading config, resolving defaults, and passing concrete values. Core never touches `process.env` or config files.

### Anti-Pattern 2: Fat Phase Functions

**What people do:** Write `scan()` as a 500-line function that does walking, git, parsing, and timeline merging in one place.

**Why it's wrong:** Untestable sub-components, no reuse across phases, refactoring requires surgery.

**Do this instead:** Each phase's `index.ts` orchestrates focused sub-components (`FileWalker`, `GitReader`, `ArtifactParser`). Each sub-component is a class or set of functions testable in isolation. The phase function is a thin orchestrator.

### Anti-Pattern 3: Skipping Intermediate JSON Serialization

**What people do:** Chain `scan() → narrate() → render()` in memory only, never allowing disk checkpoints.

**Why it's wrong:** Re-running the full pipeline to iterate on video style means re-scanning (slow) and re-calling LLM (costs money). No way to inspect what the LLM produced.

**Do this instead:** Design `Timeline` and `Script` as serializable from day one. The CLI `run` command chains them in memory by default but accepts `--save-timeline` / `--save-script` flags. Re-entry points (`buildstory narrate --input timeline.json`) use the same core functions with deserialized inputs.

### Anti-Pattern 4: Monolithic n8n Module Type

**What people do:** Set `"type": "module"` in the n8n nodes package to match the rest of the monorepo.

**Why it's wrong:** n8n's node loader uses `require()`. ESM modules cannot be `require()`'d. Runtime error: `ERR_REQUIRE_ESM`.

**Do this instead:** Keep `n8n-nodes-buildstory` as CommonJS output (`"module": "CommonJS"` in tsconfig, no `"type": "module"` in package.json). The n8n package imports from `@buildstory/core` which can be ESM — Node.js supports dynamic `import()` from CJS, or use dual-publish on core if needed.

## Scaling Considerations

BuildStory is a local developer tool processing single repositories. Scaling to "many users" means many independent invocations, not a shared server. Relevant scale concerns:

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single repo, typical size | Default architecture — in-process, synchronous pipeline |
| Monorepo with 10k+ files | FileWalker needs concurrency limits; `fast-glob` handles this well with `concurrency` option |
| Long git history (10k+ commits) | GitReader should filter by date range before processing; `simple-git`'s `log({ '--after': date })` |
| Long-form video (30+ min) | Frame generation becomes the bottleneck; consider worker_threads for `node-canvas` rendering |
| n8n workflows | n8n handles concurrency at workflow level — core functions need to be stateless (they already are with the options pattern) |

## Sources

- n8n monorepo package organization: [DeepWiki n8n core packages](https://deepwiki.com/n8n-io/n8n/1.1-core-packages)
- n8n custom nodes in monorepo (CJS/ESM conflict): [n8n community discussion](https://community.n8n.io/t/building-custom-nodes-in-a-monorepo-possible/45297)
- Platform-agnostic core + wrapper pattern: [Storyie monorepo architecture](https://storyie.com/blog/monorepo-architecture)
- pnpm workspace protocol and catalog support: [pnpm workspaces docs](https://pnpm.io/workspaces)
- TypeScript project references for build order: [TypeScript docs](https://www.typescriptlang.org/docs/handbook/project-references.html)
- fluent-ffmpeg + ffmpeg-static pattern: [Creatomate video rendering guide](https://creatomate.com/blog/video-rendering-with-nodejs-and-ffmpeg)
- CLI thin wrapper architecture (2026): [hackers.pub TypeScript CLI 2026](https://hackers.pub/@hongminhee/2026/typescript-cli-2026)
- Turborepo dependency graph and build ordering: [Turborepo pipeline guide](https://vercel.com/academy/production-monorepos/update-turborepo-pipeline)

---
*Architecture research for: TypeScript monorepo toolkit — file scanner + LLM pipeline + video renderer*
*Researched: 2026-04-05*
