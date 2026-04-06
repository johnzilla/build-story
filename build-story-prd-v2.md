# BuildStory — Product Requirements Document

**Project:** BuildStory
**Author:** Generated from conversation, April 5, 2026
**Status:** Draft — Ready for GStack/GSD initialization

---

## Overview

BuildStory is a monorepo toolkit that scans GStack and GSD planning artifacts across one or more repositories, reconstructs a chronological development timeline, generates a narrative script via LLM, and renders a narrated video documenting the project's history. The core logic lives in a standalone library (`@buildstory/core`) with thin wrappers for CLI usage, n8n community nodes, and future integrations (MCP server, GitHub Actions).

## Problem

Builders who use structured planning tools (GStack, GSD) with Claude Code CLI generate extensive planning files — decisions, roadmaps, task logs, architecture docs — but this rich project history sits unused in markdown files. There is no way to automatically transform this paper trail into a shareable, visual narrative of how a project evolved from idea to shipped product.

## Target User

Solo developers and small teams who build with Claude Code CLI using GStack/GSD workflows. They already have the raw material; they need the tool that assembles it.

## Use Cases

- **Portfolio content:** Generate a video walkthrough of a project's development history for credibility and showcasing.
- **Onboarding:** New collaborators watch a 3-5 minute video to understand why decisions were made.
- **Reflection:** Review a project's arc — pivots, breakthroughs, blockers — as a coherent narrative.
- **Content creation:** Automated B-roll for developer vlogs, podcast supplements, or social media clips.
- **Workflow automation:** n8n node triggered on git push to auto-generate project updates, pipe timelines to Notion/Slack, or produce weekly build recaps.

---

## Architecture

BuildStory follows a core-library pattern. All business logic lives in `@buildstory/core`. Wrappers are thin shells that map their environment's input/output conventions to core function calls.

```
┌─────────────────────────────────────────────────────┐
│                  @buildstory/core                    │
│                                                     │
│   scan(options) → Timeline                          │
│   narrate(timeline, options) → Script               │
│   render(script, options) → Buffer (MP4)            │
│                                                     │
│   Pure library. No CLI args. No n8n imports.        │
│   Takes typed inputs, returns typed outputs.        │
└──────────┬──────────────┬──────────────┬────────────┘
           │              │              │
    ┌──────▼──────┐ ┌─────▼──────┐ ┌────▼─────────┐
    │ buildstory  │ │ n8n-nodes- │ │ Future:      │
    │   CLI       │ │ buildstory │ │ MCP, GH Act, │
    │             │ │            │ │ API server   │
    └─────────────┘ └────────────┘ └──────────────┘
```

### Monorepo Structure

```
buildstory/
├── packages/
│   ├── core/                      # @buildstory/core
│   │   ├── src/
│   │   │   ├── index.ts           # Public API: scan, narrate, render
│   │   │   ├── scanner/
│   │   │   │   ├── walker.ts      # Filesystem traversal, pattern matching
│   │   │   │   ├── parser.ts      # Markdown AST extraction
│   │   │   │   ├── git.ts         # Git history integration
│   │   │   │   └── index.ts       # scan() orchestrator
│   │   │   ├── narrator/
│   │   │   │   ├── llm.ts         # LLM API client (provider-agnostic)
│   │   │   │   ├── prompts.ts     # System prompts per narrative style
│   │   │   │   ├── scenes.ts      # Scene segmentation logic
│   │   │   │   └── index.ts       # narrate() orchestrator
│   │   │   ├── renderer/
│   │   │   │   ├── frames.ts      # Frame generation (canvas/sharp)
│   │   │   │   ├── tts.ts         # TTS engine abstraction
│   │   │   │   ├── ffmpeg.ts      # FFmpeg assembly pipeline
│   │   │   │   └── index.ts       # render() orchestrator
│   │   │   ├── types.ts           # All shared types
│   │   │   └── utils/
│   │   │       ├── markdown.ts    # Markdown parsing helpers
│   │   │       ├── dates.ts       # Date extraction & normalization
│   │   │       └── patterns.ts    # Artifact detection patterns
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cli/                       # buildstory (npm binary)
│   │   ├── src/
│   │   │   ├── index.ts           # Entry point, arg parsing
│   │   │   ├── commands/
│   │   │   │   ├── scan.ts        # CLI scan command
│   │   │   │   ├── narrate.ts     # CLI narrate command
│   │   │   │   ├── render.ts      # CLI render command
│   │   │   │   └── run.ts         # Full pipeline command
│   │   │   ├── config.ts          # buildstory.toml loader
│   │   │   └── output.ts          # Console formatting, progress bars
│   │   ├── package.json           # bin: { "buildstory": "./dist/index.js" }
│   │   └── tsconfig.json
│   │
│   └── n8n-nodes/                 # n8n-nodes-buildstory
│       ├── nodes/
│       │   ├── BuildStoryScanner/
│       │   │   ├── BuildStoryScanner.node.ts
│       │   │   └── buildstory-scanner.svg    # Node icon
│       │   ├── BuildStoryNarrator/
│       │   │   ├── BuildStoryNarrator.node.ts
│       │   │   └── buildstory-narrator.svg
│       │   └── BuildStoryRenderer/
│       │       ├── BuildStoryRenderer.node.ts
│       │       └── buildstory-renderer.svg
│       ├── credentials/
│       │   ├── AnthropicApi.credentials.ts
│       │   └── TtsApi.credentials.ts
│       ├── package.json
│       └── tsconfig.json
│
├── pnpm-workspace.yaml
├── package.json                   # Root — workspace scripts
├── tsconfig.base.json             # Shared TS config
├── buildstory.toml.example        # Example config for CLI users
└── README.md
```

### Layer Responsibilities

| Layer | Does | Does NOT |
|-------|------|----------|
| **`@buildstory/core`** | Scan files, parse markdown, call LLM, generate frames, assemble video, define types | Parse CLI args, read config files, manage n8n credentials, print to console |
| **`buildstory` CLI** | Parse args (Commander/yargs), load `buildstory.toml`, call core functions, write output files, show progress | Contain any business logic, know about n8n |
| **`n8n-nodes-buildstory`** | Map n8n UI parameters to core inputs, pass JSON between nodes, register credentials | Contain any business logic, know about CLI |

### Core Public API

```typescript
// @buildstory/core — the entire public surface

// Phase 1
export async function scan(options: ScanOptions): Promise<Timeline>

// Phase 2
export async function narrate(
  timeline: Timeline,
  options: NarrateOptions
): Promise<Script>

// Phase 3
export async function render(
  script: Script,
  options: RenderOptions
): Promise<RenderResult>

// All types
export type {
  ScanOptions, Timeline, TimelineEvent,
  NarrateOptions, NarrativeStyle, Script, Scene, VisualType,
  RenderOptions, RenderResult, TtsEngine
}
```

### Wrapper Examples

**CLI:**
```typescript
import { scan } from '@buildstory/core'
import { loadConfig } from './config'

const config = loadConfig('buildstory.toml')
const options = { ...config.scan, ...parseCliArgs() }
const timeline = await scan(options)
fs.writeFileSync('timeline.json', JSON.stringify(timeline, null, 2))
console.log(`Scanned ${timeline.events.length} events`)
```

**n8n node:**
```typescript
import { scan } from '@buildstory/core'

export class BuildStoryScanner implements INodeType {
  async execute(this: IExecuteFunctions) {
    const repoPath = this.getNodeParameter('repoPath', 0) as string
    const useGit = this.getNodeParameter('useGitHistory', 0) as boolean
    const timeline = await scan({ paths: [repoPath], useGitHistory: useGit })
    return [this.helpers.returnJsonArray(timeline.events)]
  }
}
```

**Future MCP server:**
```typescript
import { scan } from '@buildstory/core'

server.tool('buildstory_scan', async ({ repoPath }) => {
  const timeline = await scan({ paths: [repoPath] })
  return { content: [{ type: 'text', text: JSON.stringify(timeline) }] }
})
```

Same core function, three completely different invocation contexts.

### External Dependencies

| Dependency | Purpose | Required By |
|------------|---------|-------------|
| FFmpeg | Video/audio stitching | Renderer only |
| LLM API (Claude) | Narrative generation | Narrator only |
| TTS engine | Voice narration | Renderer only |
| Git | History extraction | Scanner (optional) |

---

## Phase 1: Scan

**Goal:** Walk one or more repositories, locate GStack/GSD artifacts, extract structured data, and produce a unified timeline.

### Input (ScanOptions)

```typescript
interface ScanOptions {
  paths: string[]                    // Repo paths or globs
  includePatterns?: string[]         // Override default artifact patterns
  excludePatterns?: string[]         // Additional exclusions
  maxDepth?: number                  // Directory depth limit (default: 5)
  useGitHistory?: boolean            // Enrich with git data (default: true)
  customArtifacts?: string[]         // Additional filename patterns
}
```

### Artifact Detection

The scanner identifies files by known naming conventions and directory patterns used by GStack and GSD:

**GStack artifacts:**
- `PLANNING.md`, `PLAN.md`
- `ARCHITECTURE.md`, `ARCH.md`
- `DECISIONS.md`, `DECISION_LOG.md`
- `ROADMAP.md`
- `STATUS.md`, `PROGRESS.md`
- `CHANGELOG.md`
- `*.gstack` files
- Files within `.gstack/` directories

**GSD artifacts:**
- `TASKS.md`, `TODO.md`
- `SESSION_LOG.md`, `SESSION_NOTES.md`
- `BLOCKERS.md`
- `*.gsd` files
- Files within `.gsd/` directories

**General planning artifacts:**
- `README.md` (project description extraction only)
- `ADR/` directories (Architecture Decision Records)
- `docs/` directories (selective — planning-related files only)
- `.claude/` directory artifacts (session history, commands)

Detection patterns are configurable:

```typescript
// Defaults in @buildstory/core
const DEFAULT_INCLUDE = [
  'PLANNING.md', 'PLAN.md', 'ARCHITECTURE.md', 'DECISIONS.md',
  'ROADMAP.md', 'STATUS.md', 'CHANGELOG.md', 'TASKS.md',
  'SESSION_LOG.md', 'BLOCKERS.md', '*.gstack', '*.gsd'
]
const DEFAULT_EXCLUDE = ['node_modules', 'target', '.git', 'vendor', 'dist']
```

### Data Extraction

For each artifact, extract:

| Field | Source | Notes |
|-------|--------|-------|
| `timestamp` | Git blame, file mtime, inline dates | Prefer git blame for accuracy |
| `artifactType` | Filename/path pattern match | planning, decision, roadmap, task, session, architecture |
| `title` | First H1/H2 heading | Fallback to filename |
| `contentSummary` | Full text (for LLM) | Truncated to configurable max tokens |
| `keyEntities` | Extracted names, tools, concepts | Simple keyword extraction |
| `status` | Inline status markers | done, in-progress, blocked, abandoned |
| `relationships` | Cross-references to other files | Link detection via path references |

### Git History Integration (Optional)

When a `.git` directory is present and `useGitHistory` is true:

- Extract commit messages with timestamps for additional timeline events
- Use `git blame` for per-line dating of planning files
- Identify branch creation/merge events as milestone markers
- Extract tag names as version/release events

### Output: Timeline

```typescript
interface Timeline {
  project: {
    name: string
    root: string
    scanDate: string               // ISO 8601
  }
  events: TimelineEvent[]
  metadata: {
    totalArtifacts: number
    totalEvents: number
    dateRange: { earliest: string; latest: string }
    reposScanned: number
  }
}

interface TimelineEvent {
  id: string                       // evt_001, evt_002, ...
  timestamp: string                // ISO 8601
  sourceFile: string               // Relative path
  artifactType: ArtifactType
  title: string
  summary: string
  rawContent: string
  tags: string[]
  milestone: boolean
}
```

Example JSON output:

```json
{
  "project": {
    "name": "my-project",
    "root": "/path/to/my-project",
    "scanDate": "2026-04-05T10:54:00Z"
  },
  "events": [
    {
      "id": "evt_001",
      "timestamp": "2026-01-15T09:30:00Z",
      "sourceFile": "PLANNING.md",
      "artifactType": "planning",
      "title": "Initial project planning",
      "summary": "Defined core architecture as a three-phase pipeline...",
      "rawContent": "## Project Plan\n\nThe goal is to build...",
      "tags": ["architecture", "cli"],
      "milestone": false
    }
  ],
  "metadata": {
    "totalArtifacts": 14,
    "totalEvents": 47,
    "dateRange": {
      "earliest": "2026-01-15T09:30:00Z",
      "latest": "2026-04-01T16:00:00Z"
    },
    "reposScanned": 1
  }
}
```

---

## Phase 2: Narrate

**Goal:** Transform the structured timeline into a narrative script suitable for video production.

### Input (NarrateOptions)

```typescript
interface NarrateOptions {
  style?: NarrativeStyle            // default: 'technical'
  targetDurationSeconds?: number    // default: 180
  llmProvider?: 'anthropic' | 'openai'
  model?: string                    // default: 'claude-sonnet-4-20250514'
  apiKey?: string                   // or resolved from env
  maxTokens?: number                // default: 4096
}

type NarrativeStyle = 'technical' | 'overview' | 'retrospective' | 'pitch'
```

### LLM Integration

- Send timeline events to LLM with a style-specific system prompt
- LLM identifies dramatic arc: inception → key decisions → pivots → breakthroughs → current state
- Returns structured scenes with narration text, visual type assignments, and pacing

### Narrative Styles

| Style | Tone | Audience |
|-------|------|----------|
| `technical` | Detailed, precise, architecture-focused | Developers, engineers |
| `overview` | High-level, accessible, outcome-focused | General/portfolio |
| `retrospective` | Reflective, lessons-learned | Personal review |
| `pitch` | Energetic, value-focused | Stakeholders, investors |

### Output: Script

```typescript
interface Script {
  title: string
  durationEstimateSeconds: number
  style: NarrativeStyle
  scenes: Scene[]
}

interface Scene {
  id: string                        // scene_001, scene_002, ...
  narration: string                 // TTS input text
  durationSeconds: number
  visualType: VisualType
  visualData: Record<string, any>   // Type-specific payload
  sourceEvents: string[]            // Links back to timeline event IDs
}
```

### Visual Types

| Type | Description | Data Needed |
|------|-------------|-------------|
| `text_reveal` | Animated title + subtitle | primaryText, secondaryText |
| `decision_card` | Decision with rationale | decision, reasoning |
| `timeline_scrub` | Animated timeline advancement | dateRange, milestoneLabel |
| `code_reveal` | Code appearing line by line | codeSnippet, language |
| `architecture_diagram` | Box diagram of system | components, connections |
| `diff_highlight` | Before/after comparison | oldText, newText |
| `milestone_card` | Achievement/shipping moment | title, date, description |
| `montage` | Rapid sequence of file names/commits | fileList |

---

## Phase 3: Render

**Goal:** Generate video frames from the script and assemble into a final MP4 with narration.

### Input (RenderOptions)

```typescript
interface RenderOptions {
  resolution?: [number, number]     // default: [1920, 1080]
  fps?: number                      // default: 30
  fontFamily?: string               // default: 'JetBrains Mono'
  accentColor?: string              // default: '#01696f'
  tts?: {
    engine: 'piper' | 'openai' | 'elevenlabs'
    voice?: string                  // Engine-specific voice ID
    apiKey?: string
  }
  backgroundMusic?: boolean         // default: true
  musicVolume?: number              // default: 0.15
  outputPath?: string               // CLI only — core returns Buffer
  subtitles?: boolean               // default: true
}

interface RenderResult {
  video: Buffer                     // MP4 binary
  subtitles?: string                // SRT content
  durationSeconds: number
}
```

### Frame Generation

- Use `node-canvas` or `sharp` for 2D rasterization (text, shapes, backgrounds)
- Render each scene as a sequence of PNG frames at target FPS
- Scene transitions: crossfade, slide, cut

### TTS Engines

| Engine | Pros | Cons |
|--------|------|------|
| Piper (local) | Free, offline, fast | Lower quality |
| OpenAI TTS | High quality, easy API | Cost per request |
| ElevenLabs | Best quality, voice cloning | Higher cost |

### Assembly (FFmpeg)

- Stitch PNG frame sequences into video stream
- Mix TTS audio with optional background music
- Apply fade transitions between scenes
- Output as MP4 (H.264 + AAC)

---

## Configuration

### CLI: `buildstory.toml`

Lives at project root or `~/.config/buildstory/config.toml` for global defaults. The CLI wrapper reads this and maps it to core function options.

```toml
[scan]
include_patterns = ["PLANNING.md", "DECISIONS.md", "ROADMAP.md", "*.gstack", "*.gsd"]
exclude_patterns = ["node_modules", "target", ".git", "vendor"]
max_depth = 5
use_git_history = true

[narrate]
llm_provider = "anthropic"
model = "claude-sonnet-4-20250514"
api_key_env = "ANTHROPIC_API_KEY"
default_style = "technical"
target_duration_seconds = 180
max_tokens = 4096

[render]
resolution = [1920, 1080]
fps = 30
font_family = "JetBrains Mono"
accent_color = "#01696f"

[render.tts]
engine = "openai"
voice = "onyx"
api_key_env = "OPENAI_API_KEY"

[render.music]
enabled = true
volume = 0.15
```

### n8n: Node Parameters

The n8n wrapper maps UI fields directly to core options — no config file involved. Credentials are managed by n8n's built-in credential system.

---

## CLI Interface

```
buildstory — Turn your planning artifacts into video history

USAGE:
    buildstory <COMMAND>

COMMANDS:
    scan       Scan repos for GStack/GSD artifacts → timeline.json
    narrate    Generate narrative script from timeline → script.json
    render     Render video from script → output.mp4
    run        Full pipeline: scan → narrate → render
    config     Show/edit configuration
    help       Print help

EXAMPLES:
    buildstory scan ./my-project
    buildstory scan ./repos/* --no-git
    buildstory narrate timeline.json --style pitch --duration 2m
    buildstory render script.json -o demo.mp4
    buildstory run ./my-project -o story.mp4

GLOBAL OPTIONS:
    -v, --verbose    Increase log verbosity
    -q, --quiet      Suppress non-error output
    --config <PATH>  Path to buildstory.toml
```

---

## n8n Node Definitions

### BuildStory Scanner Node

**Parameters:**
- Repo Path (string, required) — local path or git URL
- Use Git History (boolean, default: true)
- Include Patterns (string[], optional override)
- Exclude Patterns (string[], optional additions)
- Max Depth (number, default: 5)

**Output:** JSON array of TimelineEvent objects

### BuildStory Narrator Node

**Parameters:**
- Style (dropdown: technical | overview | retrospective | pitch)
- Target Duration (number, seconds, default: 180)
- Model (string, default: claude-sonnet-4-20250514)

**Credentials:** Anthropic API (or OpenAI API)

**Input:** Timeline JSON from Scanner node (or any JSON matching Timeline type)
**Output:** Script JSON with scenes array

### BuildStory Renderer Node

**Parameters:**
- Resolution (dropdown: 720p | 1080p | 4K)
- TTS Engine (dropdown: piper | openai | elevenlabs)
- Voice (string, engine-specific)
- Background Music (boolean, default: true)
- Music Volume (slider, 0-1, default: 0.15)
- Generate Subtitles (boolean, default: true)

**Credentials:** TTS API credentials

**Input:** Script JSON from Narrator node
**Output:** Binary MP4 + optional SRT as separate output

---

## TypeScript Dependencies

### @buildstory/core

```json
{
  "dependencies": {
    "unified": "^11.0.0",
    "remark-parse": "^11.0.0",
    "remark-gfm": "^4.0.0",
    "simple-git": "^3.27.0",
    "glob": "^11.0.0",
    "sharp": "^0.33.0",
    "fluent-ffmpeg": "^2.1.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.0.0",
    "@types/node": "^22.0.0"
  }
}
```

### buildstory (CLI)

```json
{
  "dependencies": {
    "@buildstory/core": "workspace:*",
    "commander": "^13.0.0",
    "ora": "^8.0.0",
    "smol-toml": "^1.3.0",
    "chalk": "^5.0.0"
  },
  "bin": {
    "buildstory": "./dist/index.js"
  }
}
```

### n8n-nodes-buildstory

```json
{
  "dependencies": {
    "@buildstory/core": "workspace:*"
  },
  "devDependencies": {
    "n8n-workflow": "^1.0.0"
  },
  "n8n": {
    "nodes": [
      "dist/nodes/BuildStoryScanner/BuildStoryScanner.node.js",
      "dist/nodes/BuildStoryNarrator/BuildStoryNarrator.node.js",
      "dist/nodes/BuildStoryRenderer/BuildStoryRenderer.node.js"
    ],
    "credentials": [
      "dist/credentials/AnthropicApi.credentials.js",
      "dist/credentials/TtsApi.credentials.js"
    ]
  }
}
```

---

## Build Phases & Milestones

### Phase 1: Scanner (MVP — start here)
- [ ] Monorepo scaffold with pnpm workspaces
- [ ] `@buildstory/core` types and project structure
- [ ] Filesystem walker with pattern matching
- [ ] Markdown parser extracting headings, dates, content
- [ ] Git history integration (optional enrichment)
- [ ] `scan()` function returning Timeline
- [ ] CLI wrapper: `buildstory scan` command
- [ ] Unit tests with fixture repos
- **Ship criterion:** `buildstory scan .` produces valid timeline JSON from a real GStack/GSD repo

### Phase 2: Narrator
- [ ] LLM client abstraction (Anthropic + OpenAI)
- [ ] System prompt engineering for each narrative style
- [ ] Scene segmentation and visual type assignment
- [ ] `narrate()` function returning Script
- [ ] CLI wrapper: `buildstory narrate` command
- [ ] Duration estimation and pacing control
- **Ship criterion:** `buildstory narrate timeline.json` produces a coherent, scene-segmented script

### Phase 3: Renderer
- [ ] Frame generation for each visual type (node-canvas or sharp)
- [ ] TTS integration (start with OpenAI, abstract for others)
- [ ] FFmpeg assembly pipeline
- [ ] Subtitle generation from narration text
- [ ] Background music mixing
- [ ] `render()` function returning RenderResult
- [ ] CLI wrapper: `buildstory render` command
- **Ship criterion:** `buildstory render script.json` produces a watchable MP4 with narration

### Phase 4: Full Pipeline + n8n
- [ ] `buildstory run` full pipeline CLI command
- [ ] n8n node wrappers for all three phases
- [ ] n8n credential definitions
- [ ] Publish `n8n-nodes-buildstory` to npm
- **Ship criterion:** Three-node n8n workflow produces a video from a repo path

### Phase 5: Polish & Expand
- [ ] Multi-repo scanning and cross-project timelines
- [ ] Custom visual themes/color schemes
- [ ] MCP server wrapper
- [ ] GitHub Action wrapper
- [ ] Interactive script editing (TUI or web)
- [ ] Incremental scanning (diff against previous timeline)

---

## Open Questions

- **MCP integration:** Expose `scan` and `narrate` as MCP tools so Claude can generate project history narratives mid-conversation. Low effort given the core library pattern.
- **Interactive mode:** Should `narrate` allow interactive editing of the script before rendering? TUI with ink (React for CLI) or a quick web preview?
- **Template system:** Should visual types be user-extensible via SVG/HTML templates for custom branding?
- **Multi-project narratives:** How to handle cross-repo timelines when projects reference each other? Merge strategy for overlapping date ranges?
- **Incremental updates:** Should `scan` support diffing against a previous timeline to only narrate new events?
- **Rust renderer:** If frame generation becomes a bottleneck, consider a Rust binary (`tiny-skia`) called from core via child process. The core library pattern makes this a drop-in replacement.

---

## Non-Goals (For Now)

- Web UI or dashboard
- Real-time/streaming video generation
- Collaboration features
- Cloud hosting of generated videos
- Support for non-GStack/GSD planning tools (extensibility comes later)
- Google/Apple/Spotify podcast distribution (but the audio track from render is a free podcast episode)

---

*Generated from a Perplexity conversation on April 5, 2026. Ready for GStack initialization and GSD task breakdown.*
