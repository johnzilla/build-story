# BuildStory

Turn planning artifacts into publishable content. BuildStory scans your GStack/GSD planning files, extracts the decision arc via LLM, and generates ready-to-post narratives: X threads, blog drafts, story outlines, and video scripts.

## Quick Start

```bash
# Install
pnpm install

# Build
pnpm build

# Scan your project's planning artifacts
buildstory scan . -o timeline.json

# Generate all narrative formats
ANTHROPIC_API_KEY=sk-... buildstory narrate timeline.json

# Or run the full pipeline
ANTHROPIC_API_KEY=sk-... buildstory run .
```

Output goes to `./buildstory-out/` by default:
- `story-arc.json` -- structured narrative beats
- `outline.md` -- full narrative essay (800-1500 words)
- `thread.md` -- X/LinkedIn thread (8-15 posts, <280 chars each)
- `blog.md` -- blog post with headings, code blocks, blockquotes
- `video-script.md` -- narrated script with scene markers

## CLI

```
buildstory scan [paths...]     Scan planning artifacts into timeline.json
buildstory narrate <timeline>  Generate narrative from a timeline
buildstory run [paths...]      Full pipeline: scan -> narrate -> format
```

### Options

**scan**
- `-o, --output <path>` -- Output file path (default: stdout as JSON)
- `--config <path>` -- Path to buildstory.toml

**narrate**
- `-f, --format <format>` -- Single format: outline, thread, blog, video-script (default: all)
- `--provider <provider>` -- LLM provider: anthropic or openai (default: anthropic)
- `--style <style>` -- Narrative style: technical, overview, retrospective, pitch (default: overview)
- `-o, --output <path>` -- Output directory (default: ./buildstory-out)

**run**
- Combines scan + narrate options

### Configuration

Create `buildstory.toml` in your project root:

```toml
provider = "anthropic"
style = "technical"
outputDir = "./buildstory-out"

[scan]
patterns = [".planning/**/*.md", "docs/**/*.md"]
excludes = ["node_modules/**", ".git/**"]
maxDepth = 5
```

Global defaults at `~/.config/buildstory/config.toml` (project config overrides global).

API keys are always read from environment variables:
- `ANTHROPIC_API_KEY` for Claude
- `OPENAI_API_KEY` for GPT

## What It Scans

BuildStory detects planning artifacts automatically:

| Type | Files |
|------|-------|
| GStack | PLANNING.md, ARCHITECTURE.md, DECISIONS.md, ROADMAP.md, STATUS.md, CHANGELOG.md |
| GSD | TASKS.md, TODO.md, SESSION_LOG.md, BLOCKERS.md, .planning/**/*.md |
| Generic | ADR/, docs/, README.md |

Custom patterns are configurable via `buildstory.toml` or CLI flags.

## Narrative Styles

- **technical** -- Implementation-focused. How it was built, what broke, what worked.
- **overview** -- High-level project summary. Good for stakeholder updates.
- **retrospective** -- Lessons learned. What went well, what didn't, what changed.
- **pitch** -- Outcome-focused. Why this matters, what it enables.

## Architecture

```
@buildstory/core          Pure library (no CLI, no config, no filesystem writes)
  scan(source, options)     Timeline from planning artifacts
  narrate(timeline, opts)   StoryArc with classified beats via LLM
  format(arc, type, llm)    Text output per format via LLM
  createProvider(opts)      LLM provider factory (Anthropic or OpenAI)

buildstory CLI            Thin wrapper
  scan, narrate, run        Commands mapping to core functions
  config.ts                 TOML config loader
  adapters/                 ArtifactSource (fs + redaction), GitSource (simple-git)
```

Core never imports `fs`, `process`, or config libraries. All filesystem access goes through an injected `ArtifactSource` interface. Secret redaction happens in the adapter before content reaches core or the LLM.

## Packages

| Package | Description |
|---------|-------------|
| `@buildstory/core` | Core library with scan, narrate, format functions |
| `buildstory` | CLI wrapper |

## Development

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm lint             # ESLint
pnpm format           # Prettier
```

Requires Node.js 22+ and pnpm 10+.

## License

MIT
