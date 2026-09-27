# BuildStory

[![CI](https://github.com/johnzilla/build-story/actions/workflows/ci.yml/badge.svg)](https://github.com/johnzilla/build-story/actions/workflows/ci.yml)

Turn your development history into narrated video documentaries. BuildStory reconstructs a chronological timeline from your **git commits** (and any planning artifacts you keep), extracts the decision arc via LLM, generates narration audio, and renders video — either programmatic Remotion compositions or avatar-narrated HeyGen videos.

Point it at any repo — no framework, no planning docs required. Commit history is the backbone; planning files, when present, enrich the story.

**[Watch an example: BuildStory narrating its own build journey](https://youtu.be/OtYFP66iI9s)**

Also produces text formats: X threads, blog drafts, story outlines, and video scripts.

**Two renderers:**

- **Remotion** (default) — programmatic React video with timeline bars, decision callouts, and stats cards
- **HeyGen** (`--renderer=heygen`) — AI avatar narrates your build story with beat-type colored backgrounds

## Quick Start

Start from a clone of this repository. Use **Node.js 22+** and the pnpm version
pinned in `package.json`. Remotion video also requires installed FFmpeg, FFprobe,
and Chrome/Chromium; see [Requirements](#requirements).

```bash
# Install and build the workspace
pnpm install && pnpm build

# Add your API keys to .env (already in .gitignore)
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env
echo 'OPENAI_API_KEY=sk-proj-...' >> .env

# Inspect the narration payload before making paid calls
node packages/cli/dist/index.js run ~/my-project --preview-payload ./narration-preview.json

# Run the full pipeline: scan -> narrate -> TTS -> render video
node packages/cli/dist/index.js run ~/my-project

# Or text-only (only the selected narration provider's key is needed)
node packages/cli/dist/index.js run ~/my-project --skip-video
```

The examples below use `buildstory` as shorthand for
`node /absolute/path/to/build-story/packages/cli/dist/index.js`. The intended npm
package name is **`@buildstory/cli`**, which installs that command. Avoid
`npx buildstory`: the bare package name is unrelated to this project.

With no output setting, `run ~/my-project` writes to
`~/my-project/buildstory-out/my-project/`. `--output` and `outputDir` can change
the base directory; see [Configuration](#configuration).

- `story-arc.json` — structured narrative beats and local source review, saved before rendering
- `source-review.md` — evidence matches, source references, chronology and coverage notes
- `<project>.mp4` — narrated video
- `<project>.srt` — separate subtitle file, **Remotion only**

With `--skip-video` or `--include-text`, you also get:

- `outline.md` — narrative essay (prompt target: 800–1,500 words)
- `thread.md` — X thread (prompt target: 8–15 posts, under 280 characters each)
- `blog.md` -- blog post with headings, code blocks, blockquotes
- `video-script.md` -- narrated script with scene markers

Text lengths are prompt instructions, not enforced limits. Review drafts before
publishing. Video narration comes from each story beat’s `summary`; editing
`video-script.md` does not change a rendered video.

## CLI

```
buildstory run [path]           Full pipeline: scan -> narrate -> TTS -> render
buildstory scan [path]          Scan git history + planning artifacts into timeline JSON
buildstory narrate <timeline>   Generate narrative from a timeline
buildstory render <story-arc>   Render video from an existing story arc
```

`run` and `scan` take a single project path (default: current directory).
`scan` writes JSON to stdout unless `--output <file>` is supplied.

For a staged workflow with a stable output location:

```bash
buildstory scan ~/my-project --output ./timeline.json
buildstory narrate ./timeline.json --config ~/my-project/buildstory.toml --output ./buildstory-out
# Review/edit the generated story-arc.json before paying for video.
buildstory render ./buildstory-out/my-project/story-arc.json --config ~/my-project/buildstory.toml --output ./buildstory-out
```

Create the config file first, or omit `--config` to use automatic discovery.
An explicitly named config file must exist. Rerendering an existing story arc
avoids paying for narration again.

### Options

Defaults below apply when no flag or configuration value overrides them.

All four commands accept `-c, --config <file>` for an exact TOML file.
`run`, `narrate`, and `render` also accept `--preview-payload <new-file>`; see
[Preview outbound content](#preview-outbound-content).

**run** (full pipeline)

- `--provider <provider>` -- LLM provider: anthropic or openai (default: anthropic)
- `--style <style>` -- Narrative style (default: story)
- `--skip-video` -- Text-only output, no TTS or video rendering
- `--include-text` -- Include text formats alongside video
- `--dry-run` -- Show cost estimates without calling APIs
- `--max-cost <usd>` — Check each paid request against a shared estimate-based budget; completed output files are kept. Available on `run` only.
- `--renderer <renderer>` — remotion or heygen (default: remotion)
- `--no-title-card` — Use normal scenes for first/last beats (Remotion only)
- `--no-stats-card` — Use a normal scene for the penultimate beat (Remotion only)
- `-o, --output <path>` -- Output base directory (overrides `outputDir`; see [Configuration](#configuration))

**scan**

- `-o, --output <file>` -- Output file path (default: stdout as JSON)

**narrate**

- `-f, --format <format>` -- Single format: outline, thread, blog, video-script (default: all)
- `--provider <provider>` -- LLM provider: anthropic or openai (default: anthropic)
- `--style <style>` -- Narrative style (default: story)
- `-o, --output <path>` -- Output base directory (overrides `outputDir`; see [Configuration](#configuration))

**render**

- `--renderer <renderer>` -- Video renderer: remotion or heygen (default: remotion)
- `--dry-run` -- Show cost estimate without calling APIs
- `--no-title-card` — Use normal scenes for first/last beats (Remotion only)
- `--no-stats-card` — Use a normal scene for the penultimate beat (Remotion only)
- `-o, --output <path>` -- Output base directory (overrides `outputDir`; see [Configuration](#configuration))

HeyGen processing time depends on the service and story length. BuildStory polls
for up to ten minutes per job by default. If that deadline expires, rerun
`render` with the same arc, settings, and output directory to resume the saved
job. See [Operation deadlines](#operation-deadlines).

### Preview outbound content

Use `--preview-payload <new-file>` to inspect sanitized content before paying
for generation. These commands make no API calls and need no API keys:

```bash
buildstory run ~/my-project --preview-payload ./narration-preview.json
buildstory narrate ./timeline.json --preview-payload ./import-preview.json
buildstory render ./story-arc.json --preview-payload ./speech-preview.json
buildstory render ./story-arc.json --renderer heygen --preview-payload ./heygen-preview.json
```

The file must not already exist. Previews are created with owner-only
permissions. Narration previews contain the extraction prompts for each chunk;
synthesis, text formats, and speech depend on the generated story and are not
included at that stage. Render previews show speech or HeyGen generation
bodies without authentication. Missing HeyGen IDs use placeholders.

Credentials and recognizable local paths are scrubbed at outbound boundaries,
including for imported JSON. Review the preview: pattern matching cannot detect
every secret or private detail. See [SECURITY.md](SECURITY.md).

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
# since = "2026-01-01" # passed to git log --since (a date, not a revision)
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
speed = 1.0            # Remotion TTS speed (0.25–4.0); not used by HeyGen
concurrency = 2        # Parallel TTS requests (integer, 1–64)
model = "tts-1-hd"     # OpenAI TTS model: "tts-1-hd" (default) or "tts-1" (cheaper)

[render]
titleCard = true       # Use title-card layout for first/last beats (Remotion)
statsCard = true       # Use summary-card layout for penultimate beat (Remotion)

[video]
renderer = "remotion"  # "remotion" (default) or "heygen"

[heygen]
avatarId = "your_avatar_id"   # Required for HeyGen renderer
voiceId = "your_voice_id"     # Required for HeyGen renderer
```

Global defaults live at `~/.config/buildstory/config.toml`. Project settings override
them field by field, and command-line flags take precedence over both.

- `run <directory>` and `scan <directory>` discover `buildstory.toml` inside that
  target directory (the current directory when omitted).
- `narrate <timeline.json>` and `render <story-arc.json>` discover configuration
  beside the input JSON. Use `--config /path/to/custom.toml` to select a project
  config explicitly.
- `--config` reads that exact file, replaces automatic project-config discovery,
  and still inherits global defaults. It does not change the scan target.
- Relative `outputDir` and transcript-store paths resolve beside the config file
  that defines them; `~/` expands to your home directory. Scan patterns remain
  relative to the target repository.
- `run`, `narrate`, and `render` write into a project-named subfolder of the
  configured `outputDir`. An explicit `--output` overrides that base directory
  and resolves relative to the current working directory. Without either setting,
  the base is `buildstory-out` inside the target repository or beside the input
  JSON. `scan --output` continues to name a single JSON file.

`scan.patterns` replaces the built-in include patterns; `scan.excludes` adds to
the built-in exclusions. The sample above therefore scans only `.planning/` and
`docs/` for files. Omit `patterns` to use the full default set.

Malformed TOML, unknown fields, incorrect types, invalid enum values, and
out-of-range numbers stop the command before API calls. Transcript dates must be
quoted date strings, with `since` no later than `until`.

Normal runs check required API-key presence, output-directory writeability, and
the selected renderer before narration. Remotion checks FFmpeg, FFprobe, and the
selected Chrome executable; HeyGen checks FFmpeg, avatar/voice settings, and
remote API-key verification. Unavailable HeyGen verification blocks paid work.
LLM key presence checks do not authenticate those keys remotely. Payload previews
and dry runs remain offline and require no API keys or rendering tools.

API keys via `.env` file (recommended) or environment variables:

- `ANTHROPIC_API_KEY` -- for Claude (narration)
- `OPENAI_API_KEY` -- for GPT (narration) and TTS (audio generation)
- `HEYGEN_API_KEY` -- for HeyGen avatar video rendering

The CLI automatically loads `.env` from the current working directory.

## Requirements

- **Node.js 22+** (enforced via `engines`)
- **pnpm 10** — pinned via the `packageManager` field; run `corepack enable` to use the exact version
- **ffmpeg _and_ ffprobe** -- for Remotion’s current preflight requirements. FFmpeg decodes and assembles audio; PCM durations are now derived directly from validated WAV data. HeyGen requires FFmpeg for multi-job assembly. Override the binaries with `FFMPEG_PATH` / `FFPROBE_PATH`. Both `run` and `render` check their renderer's requirements before paid work.
- **Headless Chrome** -- for Remotion video rendering

Both renderer packages (`@buildstory/video`, `@buildstory/heygen`) install with the CLI via `pnpm install` — there is no separate install step. Remotion rendering requires an installed Chrome/Chromium; HeyGen does not. Automatic browser downloads are disabled to avoid archive-extraction risks. Install a browser ahead of time from a trusted source, or point `PUPPETEER_EXECUTABLE_PATH` / `CHROME_PATH` at an existing binary.

## Narrative Styles

The default style is **story** for both `run` and `narrate`. Override per run with `--style` or set `style` in `buildstory.toml`.

- **story** (default) -- Warm documentary voice. Third-person narration, punchy short sentences, stakes and tension. Like someone telling the story of how you built it.
- **overview** -- High-level project summary. Good for stakeholder updates.
- **technical** -- Implementation-focused. How it was built, what broke, what worked.
- **retrospective** -- Lessons learned. What went well, what didn't, what changed.
- **pitch** -- Outcome-focused. Why this matters, what it enables.

## What It Scans

BuildStory builds its timeline from pluggable event sources, merged and sorted chronologically:

| Source | What it contributes | Default |
|--------|--------------------|---------|
| **git commits** | One event per commit: message, body, changed files, and +/- stats (from `git log --numstat`). The universal backbone — works on any repo regardless of workflow. | On (when the directory is a git repo) |
| **git tags** | Tagged milestones (tags need not be releases). | On when git is available, independently of `commits.enabled` |
| **agent transcripts** | The decision trail from coding-agent sessions — what you asked for, in order — distilled from the session logs (Claude Code and pi today). Secrets are redacted. | Off (opt-in) |
| **planning files** | Markdown artifacts, when present (see below). Enriches the story; not required. | On |

Planning-file detection (when those files exist):

| Type | Files |
|------|-------|
| GStack | PLANNING.md, PLAN.md, ARCHITECTURE.md, DECISIONS.md, ROADMAP.md, STATUS.md, CHANGELOG.md, `*.gstack`, `.gstack/**/*.md` |
| GSD/agent files | TASKS.md, TODO.md, SESSION_LOG.md, BLOCKERS.md, `*.gsd`, `.gsd/**/*.md`, `.planning/**/*.md`, `.claude/**/*.md` |
| Generic | `ADR/**/*.md`, `adr/**/*.md`, `docs/**/*.md`, README.md |

Custom file patterns and commit options live in `buildstory.toml`. The default
commit scan includes up to 500 commits reachable from HEAD and excludes merges.
Shallow clones and that limit can omit earlier history. File scans use current
contents; a file's date comes from git history when available, otherwise its
modification time. They do not reconstruct every historical version.

For commit/tag history only, set `scan.includeFiles = false` and leave
transcripts disabled. Transcript adapters for Claude Code and pi are opt-in.
When enabled, timestamp correlation attaches up to three nearby human prompts
to each matching commit, looking back at most 24 hours and no earlier than the
previous commit. This is a heuristic: proximity does not prove why a change was
made. Disable it with `transcripts.correlate = false`.

### Decision evidence

Timeline events now include an optional `excerpts` array with up to six passages
about problems, alternatives, decisions, and outcomes. Each passage contains at
most 400 Unicode characters after secret/path redaction, plus a bounded section
label where available. Selection uses English keywords and section headings;
it can miss implicit or non-English reasoning and does not verify claims.

- **Files:** paragraph and list-item prose, alongside the existing heading
  summary. Fenced code, HTML blocks, and frontmatter are excluded from excerpts.
- **Commits:** selected passages from the normalized subject/body, including
  rationale beyond the short summary's body cutoff.
- **Transcripts:** attributed human and agent message passages, including later
  turns. Private thinking, tool calls/results, and plan records are excluded.
  Transcripts remain opt-in.

Excerpts retain line ranges in scanned content or a 1-based normalized transcript
turn index and speaker. Redaction can shift source line numbers; these references
are not revision-pinned permalinks. Truncated passages are marked explicitly.
An agent's statement records what it said, not proof that the action succeeded.

Excerpts appear in narration requests and `--preview-payload` output; full
`rawContent` still stays local. They can contain private project details even
after redaction, and they add input tokens. Review the preview before generation.
The narrator is instructed to use them for reasons and tradeoffs while retaining
parent event IDs. Local source and chronology checks are described below.
Existing timeline JSON without excerpts remains accepted; rescan to add them.

### Reviewing claims and chronology

`run` and `narrate` save `source-review.md` beside `story-arc.json`, before text
formatting or rendering. The CLI prints a note when the review has warnings.
The JSON retains the same review under `metadata.review` and notes under
`metadata.warnings`.

- Beats carry a model-supplied `claimBasis`: `documented` or `inference`. Prompts
  ask the narrator to express uncertainty in the spoken summary itself.
- Local checks remove unknown source IDs and flag missing citations, missing
  evidence, and evidence that cannot be matched to the cited summaries/excerpts.
  Matching normalizes whitespace and surrounding double quotes; it requires at
  least 12 characters and rejects redaction placeholders. Paraphrases and short
  references can be valid but require manual review.
- The report retains source IDs, available paths/commit hashes, excerpt line or
  turn references, source dates, and their meaning. `source-matched` means the
  quoted text was found; it does **not** prove that the source is true or that
  every claim in the beat follows from it. `needs-review` and `inference` identify
  beats needing closer attention. These statuses are recomputed locally after
  narration, not accepted from the model.
- Chronology checks flag beats whose precise commit/tag dates fall wholly before
  the preceding dated beat. Beats are not automatically reordered. File update
  times and session starts do not establish decision times; the report flags
  that uncertainty. Invalid dates are excluded from date ranges, and valid
  dates are sorted by their actual instant, including timezone offsets.
- Coverage notes disclose disabled/unavailable commit history, merge exclusions,
  date/path filters, reached caps, shallow repositories, and failed history reads.
  The CLI reads the current HEAD ancestry; reaching a cap means older history
  **may** be omitted. Older timelines and custom sources without coverage details
  are reported as unknown.

These checks require no additional model calls. They do not block video generation
or independently fact-check formatted prose or speech. Read the report and edit
claims before publishing. After manual edits, the saved report can be stale;
re-narrate the timeline for a fresh review, or use the core `reviewStoryArc` helper
with your edited arc and its original timeline. Old version-1 JSON remains accepted.

### Editorial controls

Choose a question to organize the story, emphasize particular sources, and set a
spoken runtime target. These controls guide narration and synthesis; they do not
rewrite the scanned evidence or guarantee that a model follows every instruction.

```toml
[editorial]
centralQuestion = "Why did the project move to offline storage?"
targetRuntimeSeconds = 90  # whole story, 10–3600 seconds
# pivotalEventIds = ["commit-..."]  # use actual IDs from timeline.json; at most 20
compressRoutine = true    # group minor updates into brief transitions
preserveOpenLoops = true  # retain documented unresolved questions
```

`run` and `narrate` also accept `--question`, `--target-runtime`, and
`--pivotal-events` (one or more event IDs). Flags override the corresponding config
fields; other editorial settings remain in effect. Compression and open-loop
preservation default to true when an editorial brief is supplied. Without a brief,
existing narration behavior is unchanged.

```sh
buildstory scan ~/my-project --output ./timeline.json
# Inspect event IDs in timeline.json, then substitute the sources you want to emphasize.
buildstory narrate ./timeline.json --question "Why did storage change?" \
  --target-runtime 90 --pivotal-events commit-ACTUAL_ID commit-ANOTHER_ID \
  --preview-payload ./editorial-preview.json
# Remove --preview-payload and its file argument to generate the story.
```

Unknown pivotal IDs fail before any model call. Use `pivotalEventIds = []` to
clear inherited selections in project config. Pivotal sources need not be
proven decisions: narration must still distinguish documented statements from
inference. A central question is a focus, not evidence that its premise is true.

The brief appears in offline previews and is saved in `story-arc.json` under
`metadata.editorial`, along with spoken word count and estimated runtime. It also
appears in `source-review.md`. Runtime uses a rough **130 words/minute** estimate
from beat summaries. A deviation exceeding 20% (at least five seconds) or an
omitted pivotal source adds a review warning. The pipeline continues, preserving
the full narration; it does not cut speech or make another paid revision request.
Actual runtime depends on voice, language, speech speed, and rendering. Review
outputs before rendering when precise duration matters. The video-script text
format also receives the runtime target; other text formats keep their own lengths.

The model is asked to preserve unresolved questions and compress routine work;
these semantic choices require human review. Turning off open-loop preservation
allows omission for focus, never invented closure. As with other narration input,
the brief is redacted before outbound use, but may still contain private project
context. Estimates describe the generated arc and can become stale after edits.

## Video Output

Both renderers speak the sanitized `summary` of each story beat. Remotion uses
four layouts; card settings select layouts for existing beats, without adding
new narration or calculating project statistics.

| Remotion layout | Selected beats | Visible content |
| --- | --- | --- |
| Title Card | First/last, when enabled | Beat title and summary, with fades |
| Timeline Bar | All other beats except the cases below | Beat title, summary, and progress bar |
| Decision Callout | obstacle, pivot, decision | Beat title, summary, and an icon/accent bar |
| Stats Card | Penultimate, when enabled and not already a title card | Beat type, title, and summary; no computed counts |

The default palette is dark navy (#1a1a2e), warm red (#e94560), and off-white
(#eaeaea). Evidence quotes, code diffs, and source links are not currently shown.
Long summaries can overflow the layouts; review the video before sharing it.

Remotion writes a separate SRT with one cue per beat, aligned to its spoken
audio. Captions are not burned into the MP4 or split into sentences. HeyGen uses
avatar scenes with beat-type background colors and does not produce a local SRT.
Remotion card toggles and `[tts]` settings do not apply to HeyGen.

## Architecture

```
@buildstory/core          Library (no CLI/config or direct filesystem access)
  scan(source, opts, git)   Timeline from git commits + planning artifacts
  narrate(timeline, opts)   StoryArc with classified beats via LLM
  format(arc, type, llm)    Text output per format via LLM
  createProvider(opts)      LLM provider factory (Anthropic or OpenAI)

@buildstory/video         Remotion rendering + TTS (loaded on demand at render time)
  orchestrateTTS(...)       Per-scene audio via OpenAI TTS (content-keyed resume manifest)
  renderVideo(...)          Remotion composition → MP4 (honors card toggles + browser path)
  preflightCheck(...)       Verify ffmpeg, ffprobe, Chrome, API key before rendering
  estimateTTSCost(...)      Cost estimation, priced at the configured model
  @buildstory/video/pricing Standalone TTS price table (imported by the CLI dry-run)

@buildstory/heygen        HeyGen avatar rendering (loaded on demand at render time)
  adaptStoryArc(...)        StoryArc → HeyGen video_inputs with beat-type colors
  renderWithHeyGen(...)     Submit, poll, download, concat chunks → MP4
                            (per-request timeouts, status retries, paid job recovery)
  preflightHeyGenCheck(...) Validate API key, avatar, voice config
  estimateHeyGenCost(...)   Credit/USD cost estimation

buildstory CLI            Thin wrapper
  run, scan, narrate, render  Commands mapping to core/video/heygen functions
  config.ts                   TOML config loader
  adapters/                   ArtifactSource (fs + redaction), GitSource,
                              transcript sources (Claude Code, pi)
```

`@buildstory/video` and `@buildstory/heygen` are ordinary workspace dependencies of the CLI (always installed); the commands `import()` them only at render time so `scan`, `narrate`, and `--skip-video` never load Remotion. Core has no direct filesystem or config access. Filesystem access goes through an injected `ArtifactSource` interface, git access through an injected `GitSource`, and agent-session access through an injected `TranscriptSource` — so source access stays injectable. Built-in narration providers in core make network calls through the Anthropic and OpenAI SDKs. TTS and local video rendering live in `@buildstory/video`.

## Packages

| Package | Description |
|---------|-------------|
| `@buildstory/core` | Core library: scan, narrate, format |
| `@buildstory/video` | Remotion rendering: TTS, composition, ffprobe |
| `@buildstory/heygen` | HeyGen rendering: adapter, API client, polling, concat |
| `@buildstory/cli` | CLI wrapper (provides the `buildstory` command) |

## Development

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm typecheck        # tsc --noEmit across all packages
pnpm lint             # ESLint
pnpm format           # Prettier
```

## Cost

Costs depend on input size, generated narration, cache reuse, and renderer.
The code uses these local rate assumptions (not live billing quotes):

| Service/model | Rate used by the code |
| --- | --- |
| Claude `claude-sonnet-4-5` | $3 input / $15 output per million tokens |
| OpenAI `gpt-4o` | $2.50 input / $10 output per million tokens |
| OpenAI `tts-1` / `tts-1-hd` | $0.015 / $0.03 per 1,000 speech characters |
| HeyGen | $0.99 per credit, assuming one credit per video minute |

`run --dry-run` estimates from event count before narration. `render --dry-run`
uses an existing arc and estimates only rendering. Neither subtracts cached
work. HeyGen's dry-run estimate rounds total minutes, while budget reservations
round each submitted job separately, so those figures can differ.

Pass `--max-cost <usd>` to `run` to check each paid request against a shared
budget. This includes every narration chunk, synthesis, text format, TTS request,
and new HeyGen submission. LLM reservations include the serialized prompt/schema
and bounded output (16,384 tokens for story arcs, 4,096 for text formats).
Concurrent TTS calls reserve funds before starting. Completed output files remain
available when the next request is blocked.

The spend report separates LLM costs calculated from reported token usage,
TTS/HeyGen estimates, uncertain request reservations, and cached audio or existing
jobs reused for no new charge. Reservations for lost responses stay accounted
for; automatic SDK retries are disabled. Explicit TTS rate-limit retries are
checked individually. Estimates use only the speech text actually submitted.

This is a **per-run budget at configured rates**, not a guaranteed provider invoice
ceiling. Input tokens are conservatively estimated before sending, HeyGen pricing
is estimated per chunk, and provider rates, discounts, and final charges can
differ. Use provider account limits for an external billing ceiling. Existing
jobs may have been charged in an earlier run; their old costs are not counted as
new spend. The report also prints when a paid stage fails.

### Resuming a failed render

Use `render` with the **same story arc, settings, and output base** to recover
rendering work. Running `run` again repeats the paid narration stage and may
produce different beats.

- **TTS (Remotion):** scenes use content-based filenames under `audio/`, keyed
  by the exact outbound narration, voice, speed, model, and encoding version.
  Reordering or duplicating beats reuses the same audio. Each cached WAV is
  checked for a complete PCM structure and, when recorded, its SHA-256 checksum.
  Duration is derived from the validated PCM data rather than trusted metadata.
  The manifest is replaced atomically after each completed scene; failures to
  save it stop the run and leave completed audio available for retry.
  Validated chunks inside long scenes are retained under `audio/chunks/`, so a
  later request or assembly failure does not discard earlier chunks. Intact
  files can be recovered when metadata is missing; without a saved checksum,
  only structural validation is possible. Compatible legacy scene files are
  migrated automatically, including after reordering; older potentially
  truncated long-scene files are regenerated.
- **HeyGen:** job IDs and completed chunks remain in `<project>.mp4.parts/` after
  interruption. Reruns resume saved jobs and downloads. Submission POSTs are
  never retried automatically; uncertain outcomes require checking the account
  and recovering the ID. Successful assembly removes the parts directory, so a
  later successful rerender starts new paid jobs. See
  [paid job recovery](packages/heygen/README.md#recovering-a-paid-job).

Keep the `audio/` directory to preserve TTS recovery; removing it requires new
speech requests. Scene and chunk caches both consume disk space and are not
pruned automatically. Avoid simultaneous renders into the same output directory;
request sharing applies within one invocation. An interrupted request or decode
that has not yet produced a validated, saved chunk may need to be paid for again.

### Operation deadlines

Deadlines include response-body reads, not just the wait for headers:

| Operation | Deadline |
| --- | --- |
| Each narration request | 10 minutes |
| Each speech request | 2 minutes |
| HeyGen submit or status request | 30 seconds |
| Each HeyGen download | 5 minutes |
| Each FFmpeg audio conversion or final assembly | 5 minutes |
| Audio duration probe | 30 seconds |

HeyGen polling defaults to 10 minutes per saved job; waits, retry delays, and
status reads all share that deadline. Library callers may set `timeoutSeconds`
from 0 to 86,400. It does not include submission or downloading. Local browser
rendering is separate from the FFmpeg assembly deadline.

A timed-out download removes its partial file and preserves the paid job ID.
Failed or timed-out assembly preserves completed chunks and the previous final
video; a successful assembly replaces the final video atomically. FFmpeg handles
paths with spaces and apostrophes, drains diagnostics, and honors `FFMPEG_PATH`.
Timed-out paid submissions are never automatically retried because the provider
may already have accepted them.

## Data safety

- **Local dumps hold everything.** `timeline.json` (and other scan dumps) embed
  `rawContent` — the full text of scanned files and commit bodies — plus the
  absolute `rootDir` path. Common dump names are ignored in this repository; other names and target repositories may not ignore them. Don't commit or share
  them without reviewing. **`rawContent` is never sent to the LLM** — only event
  summaries/metadata are.
- **Secrets are redacted at ingress** across files, git commit/tag messages, and
  transcripts, on a best-effort basis. Review outputs before publishing.
- **Transcripts are opt-in** and can contain secrets and dead-ends — enable
  `[transcripts]` deliberately.

See [SECURITY.md](./SECURITY.md) for the full threat model (including
prompt-injection handling) and how to report a vulnerability.

## Roadmap

The prioritized work list is [IMPROVEMENTS.md](IMPROVEMENTS.md). Items 1–13 are
complete; items 14–17 cover
video quality. Historical plans are not descriptions of implemented features.


- **More agent-transcript adapters** — Claude Code and pi ship today (enable `[transcripts]`, see [Configuration](#configuration)); goose and other harnesses are next. Each is a thin adapter behind the harness-neutral `TranscriptSource` interface, so one shape covers every agent, and enabling several reads them all into one timeline. A future "capture mode" (recording sessions live via ACP) would drop the per-harness log parsing entirely.
- **Sharper correlation** — commit ↔ transcript linking ships today (timestamp windows). Next: use the touched files and commit message, not just time, to pick the reasoning — and walk pi's active branch rather than all turns.

## License

[MIT](LICENSE)
