# Feature Research

**Domain:** Developer artifact scanning + narrative video generation toolkit
**Researched:** 2026-04-05
**Confidence:** MEDIUM-HIGH (ecosystem research; some claims WebSearch-verified, core pipeline features confirmed via multiple sources)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Git history ingestion | Every similar tool (Gource, git-story, GitStory) reads git log; users assume any "build story" tool does this | LOW | `git log --follow`, commit metadata, tags, branch/merge events |
| Structured JSON output | Dev tools always expose machine-readable output; users pipe output to other tools | LOW | Timeline JSON and script JSON; enables downstream consumers (n8n, MCP, CI) |
| CLI interface with composable subcommands | Solo devs running in terminal expect `scan`, `narrate`, `render` as discrete steps they can chain | LOW | `buildstory scan | buildstory narrate | buildstory render` pipeline feel |
| Configurable artifact patterns | Repos differ; users expect include/exclude glob patterns, not hardcoded paths | LOW | `buildstory.toml` project + global config |
| LLM provider choice | Anthropic vs OpenAI is a solved problem; users expect at least two providers | MEDIUM | Abstracted provider interface; API key from env |
| TTS voice narration | All comparable narrated-video tools (Narakeet, Script2Screen, n8n storytelling pipelines) generate audio; silent video is a downgrade | MEDIUM | OpenAI TTS v1 default; abstracted for Piper/ElevenLabs |
| Subtitle/caption output | Narakeet, Descript, Whisper pipelines all generate SRT; users uploading to YouTube/LinkedIn need captions for accessibility and SEO | MEDIUM | SRT generated during FFmpeg assembly; burned-in option |
| Video file output (MP4) | Users sharing to YouTube, personal sites, social expect a single .mp4 deliverable | HIGH | FFmpeg assembly: frames + audio + transitions + subtitles |
| Deterministic, reproducible output | Dev tools must be scriptable; running twice on same input must produce equivalent output | MEDIUM | Seed-stable LLM prompts, deterministic frame generation |
| Error messages that name the missing dependency | FFmpeg, LLM API keys, TTS API keys are external; missing one must fail fast with actionable message | LOW | Preflight checks before pipeline stages |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| GStack/GSD planning artifact awareness | No competitor reads `.planning/` dirs, milestone docs, ADRs, or GSD phase files — this is the unique source material that separates BuildStory from git-only tools | MEDIUM | Filesystem walker with GStack/GSD pattern matching plus generic docs (ADR, CHANGELOG, README, docs/) |
| Narrative style presets (technical / overview / retrospective / pitch) | GitStory offers commit-level styles; BuildStory operates at planning-artifact level with full project arc awareness — producing actually useful narratives, not just "committed X files" paraphrases | MEDIUM | Four LLM prompt templates with distinct tone, audience, and structure; switchable per run |
| Source event links in script JSON | Every narration scene links back to the specific planning artifact and timeline event that generated it — unique audit trail no competitor offers | LOW | `scene.source_events[]` in script JSON; enables debugging and regeneration |
| Scene segmentation with visual type assignments | Most tools dump TTS over a static image; BuildStory assigns semantic visual types (timeline view, code diff, milestone card, quote pull) to each scene | HIGH | Visual type taxonomy drives frame generation; node-canvas renders type-appropriate frames |
| Modular core library (`@buildstory/core`) with thin wrappers | No comparable tool exposes a typed TypeScript API; all existing tools are CLI-only or web-only; this enables n8n nodes, MCP server, GitHub Actions without duplicating logic | MEDIUM | Clean `scan()` / `narrate()` / `render()` public API; zero CLI/config imports in core |
| Planning-artifact timeline (not just commit timeline) | Gource and git-story only show file-level git events; BuildStory reconstructs the decision and planning arc (why things were built, not just what changed) | MEDIUM | Merges git events with document events; cross-references between artifacts |
| Configurable pacing (duration per scene) | Narakeet supports per-scene voice/timing; BuildStory applies similar control derived from event significance (milestone = longer, minor commit = shorter) | MEDIUM | Pacing algorithm in scene segmentation; override available in config |
| Multiple TTS engines with local/free option | Most pipelines lock to ElevenLabs or OpenAI; Piper (local, free, offline) is a strong differentiator for users who won't pay per-character or need offline generation | HIGH | TTS abstraction layer; OpenAI default, Piper + ElevenLabs as pluggable backends |
| n8n node wrapper (post-v1) | No other planning-narrative tool integrates with n8n; opens automation workflows (weekly auto-generated project updates, CI-triggered release videos) | MEDIUM | Thin wrapper calling `@buildstory/core`; deferred to post-CLI milestone |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Interactive script editor (TUI/web) | Users want to tweak narration before rendering | Requires a UI framework, session state, and a feedback loop that duplicates LLM work; massively expands scope; kills the "composable CLI tool" positioning | Export script JSON → user edits JSON directly → pass edited JSON to `render`; clean separation of concerns |
| Real-time / streaming video output | "Stream the render as it generates" sounds impressive | FFmpeg requires all frames before assembly; streaming implies a different architecture entirely (HLS, fragmented MP4); zero user demand for this use case | Render to file; fast enough for offline personal use |
| Cloud hosting / video storage | Users want a shareable link | Turns a developer toolkit into a SaaS product with auth, storage costs, CDN, and ToS; out of scope | Output MP4 locally; users upload to YouTube, Vimeo, personal sites themselves |
| AI-generated visual imagery (Midjourney, Stable Diffusion, Veo) | Makes the video "prettier" | Adds image generation API costs, prompt engineering complexity, visual consistency problems across scenes, and latency; distracts from the core artifact-to-narrative value | node-canvas / sharp rendering of data-driven frames (timeline charts, milestone cards, text overlays) — deterministic and fast |
| Multi-project cross-repo narratives | "Tell the story of my whole company" | Resolving cross-repo timelines requires merge strategies, conflict resolution, identity deduplication across git histories, and a fundamentally more complex data model | Scope to single repo per run in v1; multi-project is a v2 feature with clear prerequisites |
| Real-time incremental scanning (watch mode) | "Update the timeline as I commit" | Incremental diff against previous timeline requires state persistence, invalidation logic, and partial re-render of downstream stages; adds significant complexity for marginal value in v1 | On-demand `buildstory run` is the right model; CI can trigger it on push |
| Web UI / dashboard | "I want a visual editor" | Duplicates the CLI; requires frontend stack, auth, session management; destroys CLI composability; no demand from the solo-dev/small-team target users | JSON output is the "API"; users integrate into their own tooling if needed |
| Automatic social media publishing | "Post to YouTube/LinkedIn directly" | Requires OAuth flows for each platform, ToS compliance, platform API maintenance; n8n already solves this and BuildStory has an n8n wrapper planned | BuildStory outputs MP4; n8n workflow handles publishing; clean separation |

## Feature Dependencies

```
[GStack/GSD artifact detection]
    └──requires──> [Filesystem walker]
                       └──requires──> [Configurable include/exclude patterns]

[Timeline JSON]
    └──requires──> [Git history ingestion]
    └──requires──> [Markdown parser (headings, dates, status, cross-refs)]
    └──requires──> [GStack/GSD artifact detection]

[Script JSON]
    └──requires──> [Timeline JSON]
    └──requires──> [LLM narrator (Anthropic / OpenAI)]
    └──requires──> [Narrative style presets]
    └──enhances──> [Scene segmentation + visual type assignments]
    └──enhances──> [Source event links]

[Video output (MP4)]
    └──requires──> [Script JSON]
    └──requires──> [Frame generation (node-canvas / sharp)]
    └──requires──> [TTS audio generation]
    └──requires──> [FFmpeg assembly]

[Subtitle/SRT output]
    └──requires──> [TTS audio generation] (timing data)
    └──requires──> [FFmpeg assembly]

[TTS audio generation]
    └──requires──> [Script JSON]
    └──requires──> [TTS provider abstraction]
                       └──enhances──> [Local TTS (Piper)]
                       └──enhances──> [ElevenLabs TTS]

[n8n node wrapper]
    └──requires──> [@buildstory/core public API] (scan / narrate / render)
    └──requires──> [CLI milestone complete + API stable]

[Configurable pacing]
    └──requires──> [Scene segmentation]
    └──enhances──> [TTS audio generation]

[Source event links in script JSON]
    └──requires──> [Timeline JSON events have stable IDs]
```

### Dependency Notes

- **Video output requires Frame generation:** node-canvas or sharp renders each scene frame before FFmpeg stitches them; frame generation is the blocking work inside the render phase
- **Script JSON requires Timeline JSON:** `narrate()` is a pure transform of timeline data; without a stable timeline schema, the narrator has no structured input
- **Subtitle output requires TTS timing data:** SRT timestamps must align with audio; timing comes from TTS response metadata, not from a post-render transcription step
- **n8n nodes require stable core API:** Wrappers must be written after `@buildstory/core` API is locked; any breaking change to `scan()` / `narrate()` / `render()` breaks all downstream consumers simultaneously
- **Narrative style presets enhance Scene segmentation:** Different styles (pitch vs technical) produce different scene counts and visual type distributions; the segmentation algorithm must be style-aware

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] Filesystem walker with GStack/GSD + generic planning artifact detection — the unique data source that differentiates BuildStory
- [ ] Git history ingestion (commits, tags, branches, blame dating) — table stakes for any build timeline
- [ ] Markdown parser (headings, dates, status, cross-refs) — extracts signal from planning docs
- [ ] Timeline JSON output with stable event IDs — foundational data structure for all downstream stages
- [ ] LLM narrator (Anthropic + OpenAI) with four narrative style presets — the "magic" that turns raw events into a script
- [ ] Scene segmentation with visual type assignments and duration pacing — makes the script renderable
- [ ] Script JSON with source event links — audit trail + enables re-render without re-narrating
- [ ] Frame generation (node-canvas / sharp) for each visual type — turns script into visual frames
- [ ] OpenAI TTS audio generation — narrated output is the core product promise
- [ ] FFmpeg assembly with transitions and subtitle generation — delivers the MP4 users share
- [ ] CLI: `buildstory scan`, `buildstory narrate`, `buildstory render`, `buildstory run` — composable pipeline
- [ ] `buildstory.toml` configuration (project + global) — required for usable defaults and custom patterns
- [ ] Preflight checks with actionable error messages for missing FFmpeg / API keys

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] n8n node wrapper — trigger: core API stable; enables automation workflows
- [ ] Piper TTS (local/free) — trigger: user demand for offline/free generation; TTS abstraction already in place
- [ ] ElevenLabs TTS (premium) — trigger: user demand for higher-quality voices
- [ ] MCP server wrapper — trigger: after CLI and n8n proven; same core API
- [ ] GitHub Actions wrapper — trigger: after CLI proven; CI-triggered release videos

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Multi-project cross-repo narratives — defer: requires complex timeline merge strategy; solve single-repo first
- [ ] Incremental scanning (diff against previous timeline) — defer: requires state persistence; on-demand is sufficient for v1
- [ ] Interactive script editor (TUI or web) — defer: JSON editing works for power users; validate demand before building UI

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| GStack/GSD artifact detection | HIGH | MEDIUM | P1 |
| Git history ingestion | HIGH | LOW | P1 |
| Markdown parser | HIGH | LOW | P1 |
| Timeline JSON output | HIGH | LOW | P1 |
| LLM narrator + style presets | HIGH | MEDIUM | P1 |
| Scene segmentation + visual types | HIGH | MEDIUM | P1 |
| Script JSON + source event links | HIGH | LOW | P1 |
| Frame generation (node-canvas/sharp) | HIGH | MEDIUM | P1 |
| TTS audio generation (OpenAI) | HIGH | LOW | P1 |
| FFmpeg assembly + subtitles | HIGH | MEDIUM | P1 |
| CLI subcommands | HIGH | LOW | P1 |
| `buildstory.toml` config | MEDIUM | LOW | P1 |
| Preflight dependency checks | MEDIUM | LOW | P1 |
| n8n node wrapper | HIGH | LOW | P2 |
| Piper TTS (local) | MEDIUM | MEDIUM | P2 |
| ElevenLabs TTS | MEDIUM | LOW | P2 |
| MCP server wrapper | MEDIUM | LOW | P2 |
| GitHub Actions wrapper | MEDIUM | LOW | P2 |
| Multi-repo narratives | MEDIUM | HIGH | P3 |
| Incremental scanning | LOW | HIGH | P3 |
| Interactive script editor | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Gource | git-story / GitStory | Narakeet | BuildStory |
|---------|--------|----------------------|----------|------------|
| Planning artifact ingestion | No | No | No | YES — unique differentiator |
| Git history ingestion | YES | YES | No | YES |
| LLM-generated narrative | No | YES (commit-level) | No | YES (project-arc level) |
| Multiple narrative styles | No | YES (6 styles, commit-level) | No | YES (4 styles, planning-level) |
| TTS audio narration | No | Limited | YES (900+ voices) | YES (OpenAI default; pluggable) |
| Subtitle/SRT generation | No | No | YES | YES |
| Structured JSON output | No (custom log only) | No | No | YES — enables n8n/MCP/CI |
| Local rendering (no cloud) | YES | YES | No (cloud-based) | YES |
| CLI composability | YES | YES | No | YES |
| n8n / automation integration | No | No | API only | YES (planned node wrapper) |
| Source event audit trail | No | No | No | YES (scene.source_events[]) |
| Scene visual type assignments | No | No | Slide-based | YES (timeline/diff/card/quote) |
| Configurable artifact patterns | No | No | No | YES |

**Key gap in market:** No tool combines planning artifact ingestion with LLM narrative generation, TTS, and structured JSON output in a locally-runnable CLI. Gource and git-story are commit-visualization tools with no narrative layer. GitStory is commit-level and cloud-based. Narakeet requires the user to write the script; it does not generate it.

## Sources

- [Gource - software version control visualization](https://gource.io/) — commit visualization feature set
- [git-story: Create mp4 Video Animations of Your Git Commit History](https://initialcommit.com/blog/git-story) — git-to-video feature set
- [GitStory Review: Turning Your GitHub Commits into a Cinematic Journey](https://www.funblocks.net/aitools/reviews/gitstory-2) — narrative style features, target users
- [Narakeet: From Markdown to Video](https://www.narakeet.com/docs/script/) — markdown-driven narrated video features
- [Narakeet Formatting Reference](https://www.narakeet.com/docs/format/) — voice/scene/timing controls
- [Generate AI videos from scripts with DeepSeek, TTS, and Together.ai — n8n workflow](https://n8n.io/workflows/6777-generate-ai-videos-from-scripts-with-deepseek-tts-and-togetherai/) — pipeline stage patterns
- [Automate Your Entire Video Pipeline: n8n Storytelling Workflow](https://medium.com/deep-tech-insights/automate-your-entire-video-pipeline-a-technical-deep-dive-into-a-custom-n8n-storytelling-workflow-4286201382db) — end-to-end pipeline feature patterns
- [GitStory Devpost](https://devpost.com/software/gitstory) — commit-to-narrative feature set
- [Gitlogue: Turning Your Commit History into a Cinematic Terminal Experience](https://dev.to/githubopensource/gitlogue-turning-your-commit-history-into-a-cinematic-terminal-experience-3592) — animated commit history features
- [SmartNote: LLM-Powered Release Notes Generator](https://arxiv.org/html/2505.17977v1) — structured LLM script generation patterns
- [CLI subtitle workflow: generate, convert, and burn | Transloadit](https://transloadit.com/devtips/cli-subtitle-workflow-generate-convert-and-burn/) — subtitle/SRT pipeline patterns
- [7 best software documentation tools in 2026 — Mintlify](https://www.mintlify.com/library/7-best-software-documentation-tools-in-2026) — doc-gen tool feature baselines
- [6 Best AI Tools for Coding Documentation in 2026](https://www.index.dev/blog/best-ai-tools-for-coding-documentation) — AI doc generation feature expectations

---
*Feature research for: developer artifact scanning and narrative video generation toolkit (BuildStory)*
*Researched: 2026-04-05*
