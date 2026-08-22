# BuildStory

Turn your development history into narrated video documentaries. BuildStory reconstructs a chronological timeline from your **git commits** (and any planning artifacts you keep), extracts the decision arc via LLM, generates narration audio, and renders video — either programmatic Remotion compositions or avatar-narrated HeyGen videos.

Point it at any repo — no framework, no planning docs required. Commit history is the backbone; planning files, when present, enrich the story.

**[Watch an example: BuildStory narrating its own build journey](https://youtu.be/OtYFP66iI9s)**

Also produces text formats: X threads, blog drafts, story outlines, and video scripts.

**Two renderers:**
- **Remotion** (default) — programmatic React video with timeline bars, decision callouts, and stats cards
- **HeyGen** (`--renderer=heygen`) — AI avatar narrates your build story with beat-type colored backgrounds

## Quick Start

```bash
# Install and build
pnpm install && pnpm build

# Add your API keys to .env (already in .gitignore)
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env
echo 'OPENAI_API_KEY=sk-proj-...' >> .env

# Run the full pipeline: scan -> narrate -> TTS -> render video
npx buildstory run ~/my-project

# Or text-only (no video, no OpenAI key needed)
npx buildstory run ~/my-project --skip-video
```

Output goes to `./buildstory-out/<project-name>/`:
- `<project>.mp4` -- narrated video with visual timeline
- `<project>.srt` -- subtitles
- `story-arc.json` -- structured narrative beats

With `--skip-video` or `--include-text`, you also get:
- `outline.md` -- full narrative essay (800-1500 words)
- `thread.md` -- X/LinkedIn thread (8-15 posts, <280 chars each)
- `blog.md` -- blog post with headings, code blocks, blockquotes
- `video-script.md` -- narrated script with scene markers

## CLI

```
buildstory run [paths...]       Full pipeline: scan -> narrate -> TTS -> render
buildstory scan [paths...]      Scan git history + planning artifacts into timeline.json
buildstory narrate <timeline>   Generate narrative from a timeline
buildstory render <story-arc>   Render video from an existing story arc
```

### Options

**run** (full pipeline)
- `--provider <provider>` -- LLM provider: anthropic or openai (default: anthropic)
- `--style <style>` -- Narrative style (default: story)
- `--skip-video` -- Text-only output, no TTS or video rendering
- `--include-text` -- Include text formats alongside video
- `--dry-run` -- Show cost estimates without calling APIs
- `--no-title-card` -- Disable auto-inserted title card
- `--no-stats-card` -- Disable auto-inserted stats card
- `-o, --output <path>` -- Output directory (default: ./buildstory-out)
- `-c, --config <path>` -- Path to buildstory.toml

**scan**
- `-o, --output <file>` -- Output file path (default: stdout as JSON)
- `-c, --config <path>` -- Path to buildstory.toml

**narrate**
- `-f, --format <format>` -- Single format: outline, thread, blog, video-script (default: all)
- `--provider <provider>` -- LLM provider: anthropic or openai (default: anthropic)
- `--style <style>` -- Narrative style (default: overview)
- `-o, --output <path>` -- Output directory (default: ./buildstory-out)

**render**
- `--renderer <renderer>` -- Video renderer: remotion or heygen (default: remotion)
- `--dry-run` -- Show cost estimate without calling APIs
- `--no-title-card` -- Disable auto-inserted title card (Remotion only)
- `--no-stats-card` -- Disable auto-inserted stats card (Remotion only)
- `-o, --output <path>` -- Output directory (default: ./buildstory-out)

### Configuration

Create `buildstory.toml` in your project root:

```toml
provider = "anthropic"
style = "story"
outputDir = "./buildstory-out"

[scan]
patterns = [".planning/**/*.md", "docs/**/*.md"]
excludes = ["node_modules/**", ".git/**"]
maxDepth = 5
includeFiles = true    # false = commit-only timeline (ignore planning files)

[commits]
enabled = true         # scan git commits as timeline events (default: true)
max = 500              # cap on commits pulled, most recent first
# since = "2026-01-01" # only commits newer than this git-understood date/revision
includeMerges = false  # merge commits are usually narration noise
# paths = ["src/**"]   # restrict to commits touching these pathspecs

[transcripts]
enabled = false        # opt-in: distill coding-agent sessions into events
# harnesses = ["claude-code", "pi"]     # which agents to read (default: all known)
# claudeCodePath = "~/.claude/projects" # override Claude Code's session store
# piPath = "~/.pi/agent/sessions"       # override pi's session store
# since = "2026-01-01"         # only sessions started at/after this ISO date
# until = "2026-12-31"         # only sessions started at/before this ISO date
# correlate = true             # attach each commit's "why" from session reasoning (default: true)

[tts]
voice = "nova"         # OpenAI TTS voice: nova, alloy, echo, fable, onyx, shimmer
speed = 1.0            # Playback speed (0.25 - 4.0)
concurrency = 2        # Parallel TTS requests

[video]
renderer = "remotion"  # "remotion" (default) or "heygen"

[heygen]
avatarId = "your_avatar_id"   # Required for HeyGen renderer
voiceId = "your_voice_id"     # Required for HeyGen renderer
```

Global defaults at `~/.config/buildstory/config.toml` (project config overrides global).

API keys via `.env` file (recommended) or environment variables:
- `ANTHROPIC_API_KEY` -- for Claude (narration)
- `OPENAI_API_KEY` -- for GPT (narration) and TTS (audio generation)
- `HEYGEN_API_KEY` -- for HeyGen avatar video rendering

The CLI automatically loads `.env` from the current working directory.

## Requirements

- **Node.js 22+**
- **pnpm 10+**
- **ffmpeg/ffprobe** -- for audio processing (usually pre-installed on Linux/macOS)
- **Headless Chrome** -- for Remotion video rendering (auto-downloaded on first render)

Video rendering dependencies (~200MB) are installed on first `buildstory render` or `buildstory run` -- you'll be prompted before installation.

## Narrative Styles

- **story** (default for `run`) -- Warm documentary voice. Third-person narration, punchy short sentences, stakes and tension. Like someone telling the story of how you built it.
- **overview** (default for `narrate`) -- High-level project summary. Good for stakeholder updates.
- **technical** -- Implementation-focused. How it was built, what broke, what worked.
- **retrospective** -- Lessons learned. What went well, what didn't, what changed.
- **pitch** -- Outcome-focused. Why this matters, what it enables.

## What It Scans

BuildStory builds its timeline from pluggable event sources, merged and sorted chronologically:

| Source | What it contributes | Default |
|--------|--------------------|---------|
| **git commits** | One event per commit: message, body, changed files, and +/- stats (from `git log --numstat`). The universal backbone — works on any repo regardless of workflow. | On (when the directory is a git repo) |
| **git tags** | Release milestones. | On |
| **agent transcripts** | The decision trail from coding-agent sessions — what you asked for, in order — distilled from the session logs (Claude Code and pi today). Secrets are redacted. | Off (opt-in) |
| **planning files** | Markdown artifacts, when present (see below). Enriches the story; not required. | On |

Planning-file detection (when those files exist):

| Type | Files |
|------|-------|
| GStack | PLANNING.md, ARCHITECTURE.md, DECISIONS.md, ROADMAP.md, STATUS.md, CHANGELOG.md |
| GSD | TASKS.md, TODO.md, SESSION_LOG.md, BLOCKERS.md, .planning/**/*.md |
| Generic | ADR/, docs/, README.md |

Custom file patterns and commit options are configured in `buildstory.toml` (see [Configuration](#configuration)). To narrate purely from commit history, set `scan.includeFiles = false`; commits themselves are scanned by default whenever the target is a git repo. Agent-session transcripts are **opt-in** — enable `[transcripts]` in `buildstory.toml`. They can contain secrets, which BuildStory redacts on a best-effort basis before they enter the timeline. When both commits and transcripts are present, each commit is annotated with the session reasoning that led to it (the human asks in the window before it) — so the narrator gets each change's "why" explicitly.

## Video Output

The renderer produces an MP4 with 4 scene types mapped to narrative beat types:

| Scene | Beat Types | Visual |
|-------|-----------|--------|
| Title Card | First/last beat | Project name, date range, fade in/out |
| Timeline Bar | idea, goal, attempt, result, side_quest | Horizontal bar filling L→R with beat text |
| Decision Callout | obstacle, pivot, decision | Styled callout box with planning artifact quote |
| Stats Card | Second-to-last | Event count, phase count, timeline span |

Default palette: dark navy (#1a1a2e) + warm red (#e94560) + off-white text (#eaeaea).

## Architecture

```
@buildstory/core          Pure library (no CLI, no config, no filesystem writes)
  scan(source, opts, git)   Timeline from git commits + planning artifacts
  narrate(timeline, opts)   StoryArc with classified beats via LLM
  format(arc, type, llm)    Text output per format via LLM
  createProvider(opts)      LLM provider factory (Anthropic or OpenAI)

@buildstory/video         Remotion rendering + TTS (optional, lazy-installed)
  orchestrateTTS(...)       Per-scene audio via OpenAI TTS
  renderVideo(...)          Remotion composition → MP4
  preflightCheck(...)       Verify all dependencies before rendering
  estimateTTSCost(...)      Cost estimation before API calls

@buildstory/heygen        HeyGen avatar rendering (optional, lazy-installed)
  adaptStoryArc(...)        StoryArc → HeyGen video_inputs with beat-type colors
  renderWithHeyGen(...)     Submit, poll, download, concat chunks → MP4
  preflightHeyGenCheck(...) Validate API key, avatar, voice config
  estimateHeyGenCost(...)   Credit/USD cost estimation

buildstory CLI            Thin wrapper
  run, scan, narrate, render  Commands mapping to core/video/heygen functions
  config.ts                   TOML config loader
  lazy.ts                     Lazy @buildstory/video and @buildstory/heygen install
  adapters/                   ArtifactSource (fs + redaction), GitSource
```

Core never imports `fs`, `process`, or config libraries. Filesystem access goes through an injected `ArtifactSource` interface and git access through an injected `GitSource` — so core stays free of I/O and vendor specifics. TTS and video rendering live in `@buildstory/video` to keep core pure.

## Packages

| Package | Description |
|---------|-------------|
| `@buildstory/core` | Core library: scan, narrate, format |
| `@buildstory/video` | Remotion rendering: TTS, composition, ffprobe |
| `@buildstory/heygen` | HeyGen rendering: adapter, API client, polling, concat |
| `buildstory` | CLI wrapper |

## Development

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm lint             # ESLint
pnpm format           # Prettier
```

## Cost

Typical run on a project with 50-200 events:
- **LLM narration**: ~$0.05-0.20 (Claude Sonnet) or ~$0.02-0.10 (GPT-4o)
- **TTS audio** (Remotion): ~$0.05-0.15 (OpenAI TTS HD, ~$0.03/1000 chars)
- **HeyGen rendering**: ~$0.99/credit/minute of video (~$5-15 per project)
- **Total (Remotion)**: ~$0.10-0.35 per video
- **Total (HeyGen)**: ~$5-15 per video (avatar rendering is the main cost)

Use `--dry-run` to see cost estimates before any API calls.

## Roadmap

- **More agent-transcript adapters** — Claude Code and pi ship today (enable `[transcripts]`, see [Configuration](#configuration)); goose and other harnesses are next. Each is a thin adapter behind the harness-neutral `TranscriptSource` interface, so one shape covers every agent, and enabling several reads them all into one timeline. A future "capture mode" (recording sessions live via ACP) would drop the per-harness log parsing entirely.
- **Sharper correlation** — commit ↔ transcript linking ships today (timestamp windows). Next: use the touched files and commit message, not just time, to pick the reasoning — and walk pi's active branch rather than all turns.

## License

[MIT](LICENSE)
