# BuildStory

Turn planning artifacts into publishable content. BuildStory scans your GStack/GSD planning files, extracts the decision arc via LLM, and generates ready-to-post narratives: X threads, blog drafts, story outlines, and video scripts.

## Quick Start

```bash
# Install and build
pnpm install && pnpm build

# Add your API key to .env (already in .gitignore)
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env

# Scan your project's planning artifacts
npx buildstory scan ~/my-project -o timeline.json

# Generate all narrative formats
npx buildstory narrate timeline.json

# Or run the full pipeline (scan + narrate + format)
npx buildstory run ~/my-project
```

Output goes to `./buildstory-out/<project-name>/` by default:
- `story-arc.json` -- structured narrative beats
- `outline.md` -- full narrative essay (800-1500 words)
- `thread.md` -- X/LinkedIn thread (8-15 posts, <280 chars each)
- `blog.md` -- blog post with headings, code blocks, blockquotes
- `video-script.md` -- narrated script with scene markers

Example output:
```
  BuildStory Narrate

✔ Loaded timeline: honeyprompt — 116 events
  Provider: anthropic | Style: overview

✔ [1/5] Story arc extracted — 30 beats (2m 37s)
✔ [2/5] outline.md (1m 30s)
✔ [3/5] thread.md (24s)
✔ [4/5] blog.md (1m 11s)
✔ [5/5] video-script.md (33s)

  Done in 6m 15s

  Project:    honeyprompt
  Timeline:   3/29/2026 → 4/1/2026
  Events:     116 scanned
  Artifacts:  110 gsd, 1 gstack, 4 git-tag, 1 generic
  Beats:      30 narrative beats
  API calls:  5 (anthropic)
  Tokens:     77.8k in / 14.5k out (92.3k total)
  Output:     ./buildstory-out/honeyprompt
  Files:      story-arc.json, outline.md, thread.md, blog.md, video-script.md
```

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

API keys via `.env` file (recommended) or environment variables:
- `ANTHROPIC_API_KEY` for Claude
- `OPENAI_API_KEY` for GPT

The CLI automatically loads `.env` from the current working directory.

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
