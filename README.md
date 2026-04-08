# BuildStory

Turn planning artifacts into narrated video documentaries. BuildStory scans your GStack/GSD planning files, extracts the decision arc via LLM, generates narration audio, and renders an MP4 video with visual timeline, decision callouts, and TTS voice-over.

**[Watch an example: BuildStory narrating its own build journey](https://youtu.be/OtYFP66iI9s)**

Also produces text formats: X threads, blog drafts, story outlines, and video scripts.

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
buildstory scan [paths...]      Scan planning artifacts into timeline.json
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
- `--dry-run` -- Show TTS cost estimate without calling APIs
- `--no-title-card` -- Disable auto-inserted title card
- `--no-stats-card` -- Disable auto-inserted stats card
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

[tts]
voice = "nova"         # OpenAI TTS voice: nova, alloy, echo, fable, onyx, shimmer
speed = 1.0            # Playback speed (0.25 - 4.0)
concurrency = 2        # Parallel TTS requests
```

Global defaults at `~/.config/buildstory/config.toml` (project config overrides global).

API keys via `.env` file (recommended) or environment variables:
- `ANTHROPIC_API_KEY` -- for Claude (narration)
- `OPENAI_API_KEY` -- for GPT (narration) and TTS (audio generation)

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

BuildStory detects planning artifacts automatically:

| Type | Files |
|------|-------|
| GStack | PLANNING.md, ARCHITECTURE.md, DECISIONS.md, ROADMAP.md, STATUS.md, CHANGELOG.md |
| GSD | TASKS.md, TODO.md, SESSION_LOG.md, BLOCKERS.md, .planning/**/*.md |
| Generic | ADR/, docs/, README.md |

Custom patterns are configurable via `buildstory.toml` or CLI flags.

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
  scan(source, options)     Timeline from planning artifacts
  narrate(timeline, opts)   StoryArc with classified beats via LLM
  format(arc, type, llm)    Text output per format via LLM
  createProvider(opts)      LLM provider factory (Anthropic or OpenAI)

@buildstory/video         Video rendering + TTS (optional, lazy-installed)
  orchestrateTTS(...)       Per-scene audio via OpenAI TTS
  renderVideo(...)          Remotion composition → MP4
  preflightCheck(...)       Verify all dependencies before rendering
  estimateTTSCost(...)      Cost estimation before API calls

buildstory CLI            Thin wrapper
  run, scan, narrate, render  Commands mapping to core/video functions
  config.ts                   TOML config loader
  lazy.ts                     Lazy @buildstory/video install
  adapters/                   ArtifactSource (fs + redaction), GitSource
```

Core never imports `fs`, `process`, or config libraries. All filesystem access goes through an injected `ArtifactSource` interface. TTS and video rendering live in `@buildstory/video` to keep core pure.

## Packages

| Package | Description |
|---------|-------------|
| `@buildstory/core` | Core library: scan, narrate, format |
| `@buildstory/video` | Video rendering: TTS, Remotion composition, ffprobe |
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
- **TTS audio**: ~$0.05-0.15 (OpenAI TTS HD, ~$0.03/1000 chars)
- **Total**: ~$0.10-0.35 per video

Use `--dry-run` to see cost estimates before any API calls.

## License

MIT
