# Phase 4: Renderer - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a one-command video pipeline: `buildstory run` scans artifacts, narrates with a new "story" style, generates TTS audio via OpenAI, and renders an MP4 with Remotion. New `@buildstory/video` package owns TTS and rendering. Core gets a new "story" narrative style and StoryBeat schema extensions (visual_cue, tone, duration_seconds). CLI gets `buildstory render` command and updated `buildstory run` for full pipeline.

</domain>

<decisions>
## Implementation Decisions

### Narrative Voice
- **D-01:** Warm documentary tone — friendly and informative, not trying to be funny. Stakes and tension carry interest, not jokes. Think Kurzgesagt, not Fireship.
- **D-02:** Third-person narration, NOT second-person "you" — the narrator tells the story about the builder, not to the builder. "BuildStory began as a simple idea" for project-level, "John decided to rip out the ORM" for specific decisions.
- **D-03:** Mix project-as-protagonist and developer-name — project name for big-picture moments, git author name for specific decisions. Falls back to project name if no git author data.
- **D-04:** Minimal humor — warmth and personality yes, but no jokes or sarcasm. The content's stakes carry the interest. No wry observations, no pop culture references.
- **D-05:** Average sentence length under 15 words. One idea per beat. Punchy but not breathless.

### Visual Style & Scene Design
- **D-06:** Ship with dark navy (#1a1a2e) + warm red (#e94560) palette from design doc. Text: #eaeaea (off-white). Iterate after seeing real output.
- **D-07:** Minimal motion in v1 — fade in/out between scenes, timeline bar fills left-to-right, no fancy transitions. ~300ms ease-in-out. Ship fast, polish later.
- **D-08:** TitleCard and StatsCard are auto-inserted by default but configurable — `--no-title-card` and `--no-stats-card` CLI flags to disable. Power user escape hatch.
- **D-09:** 4 scene components as specified in design doc: TitleCard, TimelineBar, DecisionCallout, StatsCard with beat-type mapping. Unmapped beat types fall back to TimelineBar.

### Lazy Install & Preflight UX
- **D-10:** Prompt Y/n for `@buildstory/video` lazy install on first `buildstory render` — "Video rendering requires ~200MB of dependencies. Install now? [Y/n]". Power users who only want text output never need to install.
- **D-11:** Headless Chrome missing → error with install guide: "Headless Chrome not found. Install: npx puppeteer browsers install chrome". No auto-install.
- **D-12:** All preflight checks upfront before any API calls — Remotion installed, Chrome available, API keys present (OPENAI_API_KEY for TTS), ffprobe available. Single report listing all missing items. Fail fast, no partial work.

### TTS Voice & Pacing
- **D-13:** OpenAI `nova` voice at 1.15x speed as default. Configurable via `buildstory.toml` (`[tts] voice = "nova"`, `[tts] speed = 1.15`).
- **D-14:** Global speed only — same speed for all scenes. No per-beat-type pacing variations in v1.
- **D-15:** 0.3s silence gaps between scenes + 1s bookend silence (1s before first scene, 1s after last scene). Feels polished, not abrupt.
- **D-16:** TTS cost estimate printed before API calls: "Generating audio for N scenes (~$X.XX estimated)". `--dry-run` flag to preview costs without calling APIs.

### From Design Doc (locked)
- **D-17:** New `@buildstory/video` package in `packages/video/`. Owns Remotion, TTS, and all rendering I/O. Core stays pure.
- **D-18:** `buildstory run` defaults to style:"story"; `buildstory narrate` keeps style:"overview" as default.
- **D-19:** Video output as MP4 (H.264 + AAC) + SRT subtitle file. Output to `./buildstory-out/<project-name>/`.
- **D-20:** Remotion renders via headless Chrome. `npx remotion render` under the hood.
- **D-21:** Per-scene `<Audio>` components in Remotion with ffprobe-measured `startFrom` offsets. No pre-merge audio step.
- **D-22:** ffprobe-measured TTS duration drives frame count (never estimated duration).
- **D-23:** TTS rate limit handling: retry with exponential backoff (3 attempts, 2s/4s/8s).
- **D-24:** StoryBeat schema extension: optional `visual_cue`, `tone`, `duration_seconds` fields.
- **D-25:** Remotion `onProgress` callback wired to ora spinner showing frame count: `[6/6] Rendering video... 45% (frame 270/600)`.
- **D-26:** `--skip-video` flag on `buildstory run` for text-only output (current behavior). Video mode skips text format generation; `--include-text` flag to add them back.

### Claude's Discretion
- Exact system prompt wording for the "story" narrative style
- Font choice (Inter or system sans-serif — design doc suggests both)
- Remotion project structure within `packages/video/`
- How to wire lazy install detection (check for package.json, node_modules, or import attempt)
- ffprobe/ffmpeg-static integration approach
- TTS chunking strategy (4096 char limit per OpenAI TTS request)
- Error message wording for preflight failures
- Exact Remotion composition structure (Sequence nesting, timing math)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design doc (primary)
- `~/.gstack/projects/johnzilla-build-story/john-main-design-20260406-213135.md` — APPROVED design doc (8/10). Defines all three workstreams, scene components, CLI integration, and resolved decisions. The authoritative source for Phase 4 scope.

### Requirements
- `.planning/REQUIREMENTS.md` — NARR-10 through NARR-12, REND-01 through REND-11, CLI-03 through CLI-07

### Type contracts (extend these)
- `packages/core/src/types/story.ts` — StoryBeat/StoryArc Zod schemas. Add optional visual_cue, tone, duration_seconds fields per D-24.
- `packages/core/src/types/options.ts` — NarrateOptions. Add 'story' to style union per D-18.
- `packages/core/src/narrate/prompts/system.ts` — Existing prompt system. Add "story" style prompt per D-01 through D-05.

### Existing pipeline (integrate with)
- `packages/core/src/narrate/index.ts` — narrate() function. The story style flows through existing architecture.
- `packages/core/src/format/index.ts` — format() function. Add "remotion-script" format type.
- `packages/cli/src/commands/run.ts` — Existing run pipeline. Extend with TTS + render steps.
- `packages/cli/src/index.ts` — CLI entry point. Add `render` command.

### Prior phase context
- `.planning/phases/01-scaffold/01-CONTEXT.md` — API keys via env only, Zod schemas from start, ESLint boundary
- `.planning/phases/03-narrator/03-CONTEXT.md` — Provider-agnostic client, chunk by phase boundaries, single LLM call pattern

### Stack
- `CLAUDE.md` — Technology stack with Remotion, ffmpeg-static, OpenAI TTS SDK versions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `narrate()` in `packages/core/src/narrate/index.ts` — Full narration pipeline with chunking, token guard, provider-agnostic. The "story" style adds a new system prompt, not a new code path.
- `createProvider()` in `packages/core/src/narrate/index.ts` — Factory for LLM providers. CLI creates once, passes to narrate() and format().
- `format()` in `packages/core/src/format/index.ts` — Format pipeline. Add "remotion-script" format type here.
- `buildSystemPrompt()` in `packages/core/src/narrate/prompts/system.ts` — Style-keyed prompt builder. Add "story" style case.
- `ora` spinner pattern in `packages/cli/src/commands/run.ts` — Step-by-step progress with timing. Extend for TTS and render steps.
- `loadConfig()` in `packages/cli/src/config.ts` — Reads buildstory.toml. Add `[tts]` section parsing.

### Established Patterns
- ESLint boundary: core cannot import fs/process/config. TTS and rendering MUST live in `@buildstory/video`, not core.
- Zod schemas at pipeline boundaries — LLM output, story arc, format output all validated.
- Provider-agnostic interface pattern — LLMProvider interface in `packages/core/src/narrate/providers/interface.ts`.
- CLI delegates to core — CLI parses args, loads config, creates providers, calls core functions.

### Integration Points
- `packages/video/` — New package. Imports types from `@buildstory/core`. Core never imports from video.
- `packages/cli/src/commands/render.ts` — New CLI command. Loads story-arc.json, calls video package functions.
- `packages/cli/src/commands/run.ts` — Extend existing pipeline: scan → narrate (story) → TTS → render.
- `buildstory.toml` — Add `[tts]` section for voice/speed config, `[render]` for output settings.

</code_context>

<specifics>
## Specific Ideas

- Design doc specifies 4 scene components with exact beat-type mapping: TitleCard (first/last), TimelineBar (idea, goal, attempt, result, side_quest), DecisionCallout (obstacle, pivot, decision), StatsCard (last before closing title)
- Visual starting point: background #1a1a2e, accent #e94560, text #eaeaea, Inter or system sans-serif
- TTS: `audio.speech.create()` returns readable stream → write to temp files → ffprobe for duration
- ffprobe via `ffmpeg-static@5.3.0` bundled binary, `FFPROBE_PATH` env var override
- Cost visibility: ~$0.015/1000 chars for tts-1 model
- Remotion render: `npx remotion render src/index.ts CompositionName out.mp4`

</specifics>

<deferred>
## Deferred Ideas

- Per-beat-type TTS pacing (slower for obstacles, faster for results) — v2 polish
- Background music mixing — v2 (ADV-07)
- Custom visual themes/color schemes — v2 (ADV-05)
- Live Build Radio (real-time narrated audio) — v2 (ADV-08)
- GitHub Wrapped / Build Wrapped HTML page — v2 (ADV-09)
- Remotion cloud rendering via Lambda — v2 (ADV-10)
- ElevenLabs and Piper TTS engines — v2 (TTS-01, TTS-02)

</deferred>

---

*Phase: 04-renderer*
*Context gathered: 2026-04-07*
