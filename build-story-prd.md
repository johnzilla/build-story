# DevStory — Product Requirements Document

**Project:** DevStory CLI
**Author:** Generated from conversation, April 5, 2026
**Status:** Draft — Ready for GStack/GSD initialization

---

## Overview

DevStory is a Rust CLI tool that scans GStack and GSD planning artifacts across one or more repositories, reconstructs a chronological development timeline, generates a narrative script via LLM, and renders a narrated video documenting the project's history. The tool turns existing build discipline into automated developer documentaries.

## Problem

Builders who use structured planning tools (GStack, GSD) with Claude Code CLI generate extensive planning files — decisions, roadmaps, task logs, architecture docs — but this rich project history sits unused in markdown files. There is no way to automatically transform this paper trail into a shareable, visual narrative of how a project evolved from idea to shipped product.

## Target User

Solo developers and small teams who build with Claude Code CLI using GStack/GSD workflows. They already have the raw material; they need the tool that assembles it.

## Use Cases

- **Portfolio content:** Generate a video walkthrough of a project's development history for credibility and showcasing.
- **Onboarding:** New collaborators watch a 3-5 minute video to understand why decisions were made.
- **Reflection:** Review a project's arc — pivots, breakthroughs, blockers — as a coherent narrative.
- **Content creation:** Automated B-roll for developer vlogs, podcast supplements, or social media clips.

---

## Architecture

DevStory follows a three-phase hybrid pipeline: Rust handles scanning, parsing, and narrative generation; video rendering uses Rust for frame generation with FFmpeg for assembly.

```
devstory (Rust binary)
├── scan     → filesystem + git → timeline.json
├── narrate  → LLM API call    → script.json
└── render   → tiny-skia + ffmpeg → output.mp4
```

### External Dependencies

| Dependency | Purpose | Required |
|------------|---------|----------|
| FFmpeg | Video/audio stitching | Yes (render phase) |
| LLM API (Claude) | Narrative generation | Yes (narrate phase) |
| TTS engine | Voice narration | Yes (render phase) |
| Git | History extraction | Optional (enhances timeline) |

---

## Phase 1: Scan

**Goal:** Walk one or more repositories, locate GStack/GSD artifacts, extract structured data, and produce a unified timeline.

### Input

```bash
devstory scan ./my-project          # Single repo
devstory scan ./repos/*             # Multiple repos
devstory scan . --config devstory.toml  # Custom config
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

Detection patterns are configurable via `devstory.toml`:

```toml
[scan]
include_patterns = ["PLANNING.md", "DECISIONS.md", "*.gstack"]
exclude_patterns = ["node_modules", "target", ".git"]
max_depth = 5

[scan.custom_artifacts]
patterns = ["SPRINT_*.md", "RETRO.md"]
```

### Data Extraction

For each artifact, extract:

| Field | Source | Notes |
|-------|--------|-------|
| `timestamp` | Git blame, file mtime, inline dates | Prefer git blame for accuracy |
| `artifact_type` | Filename/path pattern match | planning, decision, roadmap, task, session, architecture |
| `title` | First H1/H2 heading | Fallback to filename |
| `content_summary` | Full text (for LLM) | Truncated to configurable max tokens |
| `key_entities` | Extracted names, tools, concepts | Simple keyword extraction |
| `status` | Inline status markers | done, in-progress, blocked, abandoned |
| `relationships` | Cross-references to other files | Link detection via path references |

### Git History Integration (Optional)

When a `.git` directory is present:

- Extract commit messages with timestamps for additional timeline events
- Use `git blame` for per-line dating of planning files
- Identify branch creation/merge events as milestone markers
- Extract tag names as version/release events

### Output: `timeline.json`

```json
{
  "project": {
    "name": "my-project",
    "root": "/path/to/my-project",
    "scan_date": "2026-04-05T10:54:00Z"
  },
  "events": [
    {
      "id": "evt_001",
      "timestamp": "2026-01-15T09:30:00Z",
      "source_file": "PLANNING.md",
      "artifact_type": "planning",
      "title": "Initial project planning",
      "summary": "Defined core architecture as a Rust CLI with three-phase pipeline...",
      "raw_content": "## Project Plan\n\nThe goal is to build...",
      "tags": ["architecture", "rust", "cli"],
      "milestone": false
    },
    {
      "id": "evt_002",
      "timestamp": "2026-01-22T14:15:00Z",
      "source_file": "DECISIONS.md",
      "artifact_type": "decision",
      "title": "Chose Rust over TypeScript for CLI",
      "summary": "Decision to use Rust for performance and single-binary distribution...",
      "raw_content": "### Decision: Language Choice\n\n...",
      "tags": ["decision", "rust", "typescript"],
      "milestone": true
    }
  ],
  "metadata": {
    "total_artifacts": 14,
    "total_events": 47,
    "date_range": {
      "earliest": "2026-01-15T09:30:00Z",
      "latest": "2026-04-01T16:00:00Z"
    },
    "repos_scanned": 1
  }
}
```

---

## Phase 2: Narrate

**Goal:** Transform the structured timeline into a narrative script suitable for video production.

### Input

```bash
devstory narrate timeline.json                    # Default style
devstory narrate timeline.json --style technical  # Technical audience
devstory narrate timeline.json --duration 3m      # Target length
```

### LLM Integration

- Send `timeline.json` events to Claude API (or configurable LLM endpoint)
- System prompt instructs the LLM to act as a technical documentary narrator
- LLM identifies dramatic arc: inception → key decisions → pivots → breakthroughs → current state

### Narrative Styles

| Style | Tone | Audience |
|-------|------|----------|
| `technical` | Detailed, precise, architecture-focused | Developers, engineers |
| `overview` | High-level, accessible, outcome-focused | General/portfolio |
| `retrospective` | Reflective, lessons-learned | Personal review |
| `pitch` | Energetic, value-focused | Stakeholders, investors |

### Output: `script.json`

```json
{
  "title": "Building DevStory: From Idea to CLI",
  "duration_estimate_seconds": 180,
  "style": "technical",
  "scenes": [
    {
      "id": "scene_001",
      "narration": "In mid-January 2026, a simple observation sparked the idea: dozens of planning files were accumulating across projects, each telling a piece of the story — but nobody was reading them.",
      "duration_seconds": 12,
      "visual_type": "text_reveal",
      "visual_data": {
        "primary_text": "The Spark",
        "secondary_text": "January 2026",
        "code_snippet": null,
        "file_references": ["PLANNING.md"]
      },
      "source_events": ["evt_001"]
    },
    {
      "id": "scene_002",
      "narration": "The first decision was language choice. TypeScript was familiar, but Rust offered a single binary with no runtime dependencies — a better fit for a CLI tool meant to run anywhere.",
      "duration_seconds": 15,
      "visual_type": "decision_card",
      "visual_data": {
        "decision": "Rust over TypeScript",
        "reasoning": "Single binary, no runtime, performance",
        "file_references": ["DECISIONS.md"]
      },
      "source_events": ["evt_002"]
    }
  ]
}
```

### Visual Types

| Type | Description | Data Needed |
|------|-------------|-------------|
| `text_reveal` | Animated title + subtitle | primary_text, secondary_text |
| `decision_card` | Decision with rationale | decision, reasoning |
| `timeline_scrub` | Animated timeline advancement | date range, milestone label |
| `code_reveal` | Code appearing line by line | code_snippet, language |
| `architecture_diagram` | Box diagram of system | components, connections |
| `diff_highlight` | Before/after comparison | old_text, new_text |
| `milestone_card` | Achievement/shipping moment | title, date, description |
| `montage` | Rapid sequence of file names/commits | file_list |

---

## Phase 3: Render

**Goal:** Generate video frames from the script and assemble into a final MP4 with narration.

### Input

```bash
devstory render script.json                      # Default output
devstory render script.json -o project-story.mp4 # Custom output
devstory render script.json --resolution 1080p   # Resolution control
devstory render script.json --no-audio            # Visual only
```

### Frame Generation (Rust)

- Use `tiny-skia` for 2D rasterization (text, shapes, backgrounds)
- Use `resvg` for SVG rendering (diagrams, icons)
- Render each scene as a sequence of PNG frames at target FPS (30)
- Scene transitions: crossfade, slide, cut

### TTS Narration

| Engine | Pros | Cons |
|--------|------|------|
| Piper (local) | Free, offline, fast | Lower quality |
| OpenAI TTS | High quality, easy API | Cost per request |
| ElevenLabs | Best quality, voice cloning | Higher cost |

Configurable via `devstory.toml`:

```toml
[render.tts]
engine = "openai"           # piper | openai | elevenlabs
voice = "onyx"              # Engine-specific voice ID
api_key_env = "OPENAI_API_KEY"

[render.output]
resolution = [1920, 1080]
fps = 30
background_music = true     # Subtle ambient track
```

### Assembly (FFmpeg)

- Stitch PNG frame sequences into video stream
- Mix TTS audio with optional background music
- Apply fade transitions between scenes
- Output as MP4 (H.264 + AAC)

### Output

```
project-story.mp4      # Final video
project-story.srt      # Subtitle file (from narration text)
```

---

## Configuration

All settings live in `devstory.toml` at the project root or `~/.config/devstory/config.toml` for global defaults:

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

---

## Rust Crate Dependencies

```toml
[dependencies]
# CLI
clap = { version = "4", features = ["derive"] }

# Filesystem
walkdir = "2"
ignore = "0.4"              # gitignore-aware walking

# Markdown parsing
comrak = "0.31"             # GFM-compatible

# Git
gix = { version = "0.68", features = ["blocking-network-client"] }

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"
toml = "0.8"

# HTTP (LLM + TTS API calls)
reqwest = { version = "0.12", features = ["json", "blocking"] }

# Async runtime
tokio = { version = "1", features = ["full"] }

# 2D rendering
tiny-skia = "0.11"
resvg = "0.44"

# Date/time
chrono = { version = "0.4", features = ["serde"] }

# Error handling
anyhow = "1"
thiserror = "2"

# Logging
tracing = "0.1"
tracing-subscriber = "0.3"
```

---

## CLI Interface

```
devstory — Turn your planning artifacts into video history

USAGE:
    devstory <COMMAND>

COMMANDS:
    scan       Scan repos for GStack/GSD artifacts → timeline.json
    narrate    Generate narrative script from timeline → script.json
    render     Render video from script → output.mp4
    run        Full pipeline: scan → narrate → render
    config     Show/edit configuration
    help       Print help

GLOBAL OPTIONS:
    -v, --verbose    Increase log verbosity
    -q, --quiet      Suppress non-error output
    --config <PATH>  Path to devstory.toml
```

---

## Build Phases & Milestones

### Phase 1: Scanner (MVP — start here)
- [ ] Project scaffold with clap CLI
- [ ] Filesystem walker with pattern matching
- [ ] Markdown parser extracting headings, dates, content
- [ ] Git history integration (optional enrichment)
- [ ] `timeline.json` output
- [ ] Unit tests with fixture repos
- **Ship criterion:** `devstory scan .` produces a valid timeline.json from a real GStack/GSD repo

### Phase 2: Narrator
- [ ] Claude API integration via reqwest
- [ ] System prompt engineering for narrative styles
- [ ] Scene segmentation and visual type assignment
- [ ] `script.json` output
- [ ] Duration estimation and pacing control
- **Ship criterion:** `devstory narrate timeline.json` produces a coherent, scene-segmented script

### Phase 3: Renderer
- [ ] tiny-skia frame generation for each visual type
- [ ] TTS integration (start with OpenAI, abstract for others)
- [ ] FFmpeg assembly pipeline
- [ ] Subtitle generation from narration text
- [ ] Background music mixing
- **Ship criterion:** `devstory render script.json` produces a watchable MP4 with narration

### Phase 4: Polish
- [ ] `devstory run` full pipeline command
- [ ] Multi-repo scanning and cross-project timelines
- [ ] Custom themes/color schemes
- [ ] MCP server mode (expose as tool for Claude)
- [ ] Crates.io packaging

---

## Open Questions

- **MCP integration:** Should this also run as an MCP server so Claude can call `scan` as a tool during conversation? Enables "tell me the history of this project" as a natural language query.
- **Interactive mode:** Should `narrate` allow interactive editing of the script before rendering? (TUI with ratatui?)
- **Template system:** Should visual types be user-extensible via SVG templates?
- **Multi-project narratives:** How to handle cross-repo timelines when projects reference each other?
- **Incremental updates:** Should `scan` support diffing against a previous timeline to only narrate new events?

---

## Non-Goals (For Now)

- Web UI or dashboard
- Real-time/streaming video generation
- Collaboration features
- Cloud hosting of generated videos
- Support for non-GStack/GSD planning tools (extensibility comes later)

---

*Generated from a Perplexity conversation on April 5, 2026. Ready for GStack initialization and GSD task breakdown.*
