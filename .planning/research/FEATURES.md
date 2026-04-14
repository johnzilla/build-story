# Feature Research

**Domain:** Developer artifact scanning + narrative video generation toolkit
**Researched:** 2026-04-05 (initial) | Updated 2026-04-14 (HeyGen renderer milestone)
**Confidence:** MEDIUM-HIGH (ecosystem research; some claims WebSearch-verified, core pipeline features confirmed via multiple sources)

---

## SECTION 1: Core Pipeline Features (v1.0 — Previously Researched)

*This section covers the original BuildStory pipeline. Retained as reference.*

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Git history ingestion | Every similar tool (Gource, git-story, GitStory) reads git log; users assume any "build story" tool does this | LOW | `git log --follow`, commit metadata, tags, branch/merge events |
| Structured JSON output | Dev tools always expose machine-readable output; users pipe output to other tools | LOW | Timeline JSON and script JSON; enables downstream consumers (n8n, MCP, CI) |
| CLI interface with composable subcommands | Solo devs running in terminal expect `scan`, `narrate`, `render` as discrete steps they can chain | LOW | `buildstory scan | buildstory narrate | buildstory render` pipeline feel |
| Configurable artifact patterns | Repos differ; users expect include/exclude glob patterns, not hardcoded paths | LOW | `buildstory.toml` project + global config |
| LLM provider choice | Anthropic vs OpenAI is a solved problem; users expect at least two providers | MEDIUM | Abstracted provider interface; API key from env |
| TTS voice narration | All comparable narrated-video tools generate audio; silent video is a downgrade | MEDIUM | OpenAI TTS v1 default; abstracted for Piper/ElevenLabs |
| Subtitle/caption output | Narakeet, Descript, Whisper pipelines all generate SRT; users need captions for accessibility and SEO | MEDIUM | SRT generated during FFmpeg assembly |
| Video file output (MP4) | Users sharing to YouTube, personal sites, social expect a single .mp4 deliverable | HIGH | FFmpeg assembly: frames + audio + transitions + subtitles |
| Deterministic, reproducible output | Dev tools must be scriptable; running twice on same input must produce equivalent output | MEDIUM | Seed-stable LLM prompts, deterministic frame generation |
| Error messages that name the missing dependency | FFmpeg, LLM API keys, TTS API keys are external; missing one must fail fast with actionable message | LOW | Preflight checks before pipeline stages |

### Differentiators (v1.0)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| GStack/GSD planning artifact awareness | No competitor reads `.planning/` dirs, milestone docs, ADRs, or GSD phase files | MEDIUM | Filesystem walker with GStack/GSD pattern matching |
| Narrative style presets (technical / overview / retrospective / pitch) | Planning-artifact level narrative vs commit-level paraphrases | MEDIUM | Four LLM prompt templates |
| Source event links in script JSON | Every scene links back to the specific planning artifact that generated it | LOW | `scene.source_events[]` in script JSON |
| Scene segmentation with visual type assignments | Semantic visual types (timeline view, code diff, milestone card, quote pull) per scene | HIGH | Visual type taxonomy drives frame generation |
| Modular core library (`@buildstory/core`) with thin wrappers | Typed TypeScript API; enables n8n nodes, MCP server, GitHub Actions without duplicating logic | MEDIUM | Clean `scan()` / `narrate()` / `render()` public API |

### Anti-Features (v1.0)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Interactive script editor (TUI/web) | Expands scope; kills CLI composability | Export script JSON; user edits directly |
| Real-time / streaming video output | FFmpeg requires all frames before assembly | Render to file |
| Cloud hosting / video storage | Turns toolkit into SaaS | Output MP4 locally |
| AI-generated visual imagery (Midjourney, Stable Diffusion) | Adds image gen API costs, latency, consistency problems | node-canvas / sharp deterministic frames |
| Multi-project cross-repo narratives | Complex timeline merge strategy | Single repo per run in v1 |

---

## SECTION 2: HeyGen Renderer Features (v1.1 Milestone — New Research)

**Research focus:** What does HeyGen's API offer as a video renderer, mapped against the existing BuildStory story arc format and pipeline.

**Sources:** HeyGen official docs (docs.heygen.com), HeyGen developer portal (developers.heygen.com), WebSearch-verified claims. No WebFetch access available; claims marked with confidence levels.

---

### How HeyGen Works: API Workflow

*Confidence: MEDIUM — assembled from search result excerpts referencing official docs.*

The HeyGen video generation API is asynchronous. The workflow is:

1. **POST** `https://api.heygen.com/v2/video/generate` with `video_inputs[]` (avatar + voice + background per scene) and `dimension` — returns a `video_id`
2. **GET** `https://api.heygen.com/v1/video_status.get?video_id={id}` — poll until `status` is `completed`, `failed`, or `pending`/`processing`
3. On `completed`, response includes `video_url` — a temporary URL to the rendered MP4
4. Download MP4 from `video_url`

Concrete status values: `pending` (queued), `processing` (rendering), `completed`, `failed`.

Processing time: approximately 10 minutes per 1 minute of generated video under typical load; varies significantly under high platform load. The API design assumes polling, not webhooks, for most integrations.

---

### Avatar Types

*Confidence: MEDIUM-HIGH — multiple sources corroborate the three-tier model.*

| Avatar Type | Description | API Access | Cost Implication |
|-------------|-------------|------------|-----------------|
| **Stock avatars** | 500+ pre-built avatars included in all paid plans | Available via `avatar_id` from `GET /v2/avatars` | No extra cost per minute; included in credit cost |
| **Photo avatar (Talking Photo)** | Single still image animated with lip sync + facial expressions (Avatar IV engine) | Available via `avatar_id` (user-uploaded image) | Requires creator plan; Avatar IV costs ~6 credits/min |
| **Digital twin (Video Avatar)** | Trained from real video footage; speaks any script post-training | Enterprise API only for creation; existing twin usable via `avatar_id` | Training requires Business ($149/mo) or enterprise; usage costs credits |
| **Generated avatar** | Created from text prompt, no real person | Available | Less relevant for BuildStory use case |

**For BuildStory v1.1:** Stock avatars are the right default. They require only an API key and credits — no custom training, no account tier prerequisite. Photo avatar is a useful upgrade path for users who want their own face. Digital twin is enterprise-tier and out of scope.

---

### Voice Options

*Confidence: MEDIUM — search results consistent with docs structure.*

| Option | Description | How Specified |
|--------|-------------|---------------|
| **HeyGen TTS voices** | 1,000+ AI voices in 40+ languages (some sources say 175+ language lip sync support via Avatar IV) | `voice_id` string from `GET /v2/voices` |
| **Pre-generated audio file** | Upload an audio file (WAV/MP3) via asset upload API; set voice `type: "audio"` with `audio_asset_id` or `audio_url` | Asset upload endpoint returns `audio_asset_id` |
| **Voice clone** | Clone a specific voice from uploaded audio | Enterprise/Business tier feature; not in scope for v1.1 |

**Critical for BuildStory:** The audio file input path (`type: "audio"`) is the key integration point. BuildStory already generates OpenAI TTS audio via `orchestrateTTS()`. The HeyGen renderer can upload those pre-generated audio files as assets and pass them to HeyGen rather than using HeyGen's own TTS — giving users BuildStory's existing voice without paying for a second TTS pass. This is the preferred integration strategy.

Alternatively, bypass BuildStory TTS entirely and use a HeyGen `voice_id` — simpler but loses the existing `AudioManifest` timing data that the SRT generator depends on.

---

### Input Format

*Confidence: MEDIUM-HIGH — corroborated by multiple search results citing official docs.*

HeyGen's `POST /v2/video/generate` accepts a JSON body structured as:

```json
{
  "video_inputs": [
    {
      "character": {
        "type": "avatar",
        "avatar_id": "<string>",
        "avatar_style": "normal"
      },
      "voice": {
        "type": "text",
        "input_text": "<narration text — plain or SSML>",
        "voice_id": "<string>",
        "speed": 1.0
      },
      "background": {
        "type": "color",
        "value": "#1a1a2e"
      }
    }
  ],
  "dimension": {
    "width": 1280,
    "height": 720
  }
}
```

**Text format options:**
- `type: "text"` with `input_text` — plain text or SSML (controlled by a `text_type` field: `"plain"` or `"ssml"`)
- `type: "audio"` with `audio_asset_id` or `audio_url` — pre-generated audio file (either uploaded asset ID or public URL)

**Scene structure:** `video_inputs` is an array; each element is a scene. API limit: 10 scenes per video call (MEDIUM confidence — reported consistently but not found in primary docs). Character limit per `input_text`: 1,500–5,000 characters (conflicting reports; official docs say 5,000, users report 1,500 errors — treat 1,500 as the safe limit).

**What this means for the StoryArc format:** The existing `StoryArc.beats[]` maps cleanly to `video_inputs[]`. Each `StoryBeat` has `summary` (narration text) and `visual_cue` (usable to set background). The 10-scene API limit is a constraint: long StoryArcs (10+ beats) need to be chunked into multiple API calls and stitched downstream.

---

### Output Format

*Confidence: MEDIUM-HIGH.*

- Output: MP4 video accessible via temporary `video_url` in the status response
- Resolution: 1080p max on standard API plan; 4K requires enterprise
- Typical dimensions: 1280×720 (16:9) or 1920×1080; portrait (9:16) supported but v4 API may have issues with fully-portrait output (reported bug)
- Download: HTTP GET on the `video_url`; URL is time-limited (exact TTL not specified in search results)
- No SRT/subtitle output from HeyGen — subtitles would need to be generated separately (BuildStory's existing SRT generator can still handle this if audio timing is available)

---

### Table Stakes for the HeyGen Renderer Feature Set

Features the HeyGen renderer integration must have to be considered complete and usable.

| Feature | Why Expected | Complexity | Dependencies on Existing Pipeline |
|---------|--------------|------------|----------------------------------|
| `HEYGEN_API_KEY` env var + config option | API key management is the first thing any user expects | LOW | Existing `buildstory.toml` config loading in CLI; add `heygen.api_key` key |
| `--renderer=heygen` CLI flag | User must be able to select the renderer per-run; Remotion stays default | LOW | Existing `render` command in CLI; add `--renderer` option |
| Stock avatar selection via config | User must specify which avatar to use; no sensible default exists | LOW | New `heygen.avatar_id` in `buildstory.toml`; `GET /v2/avatars` to enumerate |
| HeyGen voice selection via config | User must specify voice; HeyGen has 1,000+ options | LOW | New `heygen.voice_id` in config; `GET /v2/voices` to enumerate |
| `StoryArc` → `video_inputs[]` mapping | Core transform from existing data model to HeyGen API format | MEDIUM | Reads existing `StoryArc.beats[]`; maps `beat.summary` → `input_text`, `beat.visual_cue` → background hint |
| Async polling loop with progress display | Video takes minutes; user needs feedback; polling is mandatory | MEDIUM | No existing polling infrastructure; new code required |
| Download and save MP4 | Final output artifact | LOW | Existing output directory conventions from render command |
| Preflight check for `HEYGEN_API_KEY` | Fail fast with clear message; consistent with existing preflight pattern | LOW | Existing `preflightCheck()` in `@buildstory/video`; extend or create parallel for HeyGen renderer |
| Cost estimation before submit | Existing render command shows TTS cost estimate; HeyGen has credit cost | MEDIUM | Credit cost: ~1 credit/min standard; ~6 credits/min for Avatar IV. Must estimate video duration from beat `duration_seconds` fields |
| Graceful error for missing key | Actionable message, no stack trace | LOW | CLI error handling pattern already established |

---

### Differentiators for the HeyGen Renderer

Features that make the HeyGen renderer more valuable than a minimal integration.

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|-------------|
| Pre-generated audio passthrough (use BuildStory TTS audio in HeyGen) | Reuse existing OpenAI TTS audio instead of paying for a second TTS pass; preserves audio timing for SRT generation | HIGH | Requires asset upload API call per scene; `type: "audio"` voice config; existing `AudioManifest` from `orchestrateTTS()` |
| Scene chunking for long StoryArcs | StoryArcs with >10 beats need multiple API calls; chunking is invisible to the user | MEDIUM | New chunker logic in HeyGen renderer; merge/concatenate output videos via ffmpeg or return multiple files |
| Avatar and voice discovery CLI command (`buildstory heygen list-avatars`, `buildstory heygen list-voices`) | Users cannot guess avatar_id or voice_id values; discovery is required for usability | MEDIUM | New subcommands hitting `GET /v2/avatars` and `GET /v2/voices`; tabular output |
| Background color from `visual_cue` | StoryBeat.`visual_cue` carries scene context; map known beat types to a color palette for visual variety | LOW | Existing `BeatType` enum (`idea`, `goal`, `attempt`, `obstacle`, `pivot`, etc.); map to hex colors |
| Dry-run mode showing credit estimate | Consistent with existing `--dry-run` in render command; prevents surprise costs | LOW | Credit cost formula: `sum(beat.duration_seconds) / 60 * credits_per_min`; credits_per_min from avatar tier |
| SRT generation from existing audio timing | HeyGen produces no SRT; if using BuildStory TTS audio, timing is available from `AudioManifest` | LOW | Existing `generateSRT()` function — already works if `AudioManifest` is populated |

---

### Anti-Features for the HeyGen Renderer

Features to explicitly not build in v1.1.

| Anti-Feature | Why Requested | Why Avoid | Alternative |
|--------------|---------------|-----------|-------------|
| Digital twin training via CLI | Users want their own likeness | Enterprise API only; requires business account tier; training pipeline is a product of its own | Document that users can create a twin in HeyGen Studio and reference the resulting `avatar_id` in config |
| HeyGen template-based video generation | Templates offer pre-designed layouts | Template API is a different workflow (variable substitution, not scene-by-scene generation); mixing the two approaches adds complexity for marginal gain | Stick to `v2/video/generate` programmatic API |
| Interactive avatar / Streaming Avatar SDK | Real-time avatar for chat-style video | Streaming Avatar is for live interactive use cases (kiosks, customer service bots); unrelated to batch video generation from planning artifacts | Not applicable |
| Multi-language translation via HeyGen | HeyGen offers video translation API | Adds a separate async pipeline; out of scope for v1.1 exploration | Future milestone if HeyGen proves valuable |
| Avatar IV (photo avatar) as default | Higher quality, more realistic | Costs ~6x more credits per minute; requires user to upload a photo; appropriate as an opt-in `heygen.avatar_tier: "avatar_iv"` config option | Stock avatar is the zero-setup default |
| Hybrid composite mode (HeyGen + Remotion in one video) | Best of both renderers | Requires merging two video streams; complex timing synchronization; out of scope per PROJECT.md | Explore standalone first; defer hybrid |
| Voice cloning | User's own voice | Enterprise/Business tier; out of scope | Use HeyGen TTS voices or BuildStory's existing OpenAI TTS audio passthrough |

---

### Feature Dependencies (HeyGen Renderer)

```
[HeyGen renderer module]
    └──requires──> [HEYGEN_API_KEY config/env]
    └──requires──> [StoryArc → video_inputs[] mapping]
                       └──reads──> [StoryArc.beats[] (existing)]
                       └──reads──> [StoryBeat.summary → input_text]
                       └──reads──> [StoryBeat.duration_seconds → pacing]
                       └──reads──> [StoryBeat.type → background color]
    └──requires──> [Async polling loop]
    └──requires──> [MP4 download + save]

[Pre-generated audio passthrough]
    └──requires──> [HeyGen asset upload API]
    └──requires──> [AudioManifest from orchestrateTTS() (existing)]
    └──enables──> [SRT generation from existing generateSRT() (existing)]

[Scene chunking]
    └──requires──> [StoryArc.beats[] length > 10]
    └──requires──> [Multiple video_generate calls]
    └──requires──> [FFmpeg concat or multi-file output]

[Avatar/voice discovery commands]
    └──requires──> [HeyGen list avatars API (GET /v2/avatars)]
    └──requires──> [HeyGen list voices API (GET /v2/voices)]

[Cost estimation]
    └──requires──> [StoryBeat.duration_seconds (existing, optional field)]
    └──requires──> [Credits-per-minute formula (avatar tier dependent)]

[--renderer=heygen CLI flag]
    └──requires──> [Renderer interface / pluggable provider pattern]
    └──requires──> [HeyGen renderer module]
    └──alternatives──> [Remotion renderer (existing)]
```

**Key dependency: `StoryBeat.duration_seconds` is optional in the current schema.** The HeyGen renderer needs duration to estimate credits and to properly pace scenes. If absent, it must fall back to a word-count-based estimate (words / 150 = approximate seconds). This is the primary adaptation needed to the existing story arc format.

**Key dependency: `@buildstory/video` package boundary.** The current video package couples TTS + Remotion rendering. The HeyGen renderer should either live in `@buildstory/video` as an alternative render path, or in a new `@buildstory/heygen` package. Given the milestone goal is exploration, placing it in the CLI package initially (or a thin `@buildstory/heygen` package) avoids polluting the Remotion video package with HeyGen-specific async/polling code.

---

### Complexity and Cost Realities

*These facts should inform roadmap phase sizing.*

**API cost model (MEDIUM confidence):**
- Standard avatar generation: ~1 credit/minute of output video
- Avatar IV (photo avatar): ~6 credits/minute
- Minimum top-up: $5 (pays for ~5 minutes of standard avatar video or ~50 seconds of Avatar IV)
- No free API credits as of February 2026
- Concurrent video limit: 3 videos processing simultaneously on standard API plan
- Video length limit: 30 minutes max per video (enterprise has higher limits)

**Processing time reality:** 10 min processing per 1 min of video is the official estimate. A 5-minute build story video could take 50+ minutes to complete. The polling loop must handle long waits gracefully — with progress updates, timeout handling, and the ability to resume by `video_id` if the process is interrupted.

**Character limit ambiguity:** Official docs say 5,000 chars per `input_text`; user reports suggest 1,500 char errors in practice. Safe limit: assume 1,500. A typical `StoryBeat.summary` is 100–400 characters, so this is not a bottleneck in practice.

**No official Node.js/TypeScript SDK for batch video generation.** `@heygen/streaming-avatar` is for interactive real-time avatars (browser-side). `@teamduality/heygen-typescript-sdk` is a community SDK (not official). For BuildStory, a direct REST client with `fetch` or `axios` is the correct approach — the API surface needed (generate, poll, download, list avatars, list voices, upload asset) is small enough to implement directly without an SDK dependency.

---

## Feature Prioritization Matrix (HeyGen Renderer — v1.1)

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `HEYGEN_API_KEY` env + config | HIGH | LOW | P1 |
| `--renderer=heygen` CLI flag | HIGH | LOW | P1 |
| Avatar selection via config | HIGH | LOW | P1 |
| Voice selection via config | HIGH | LOW | P1 |
| StoryArc → video_inputs mapping | HIGH | MEDIUM | P1 |
| Async polling with progress | HIGH | MEDIUM | P1 |
| MP4 download + save | HIGH | LOW | P1 |
| Preflight check for API key | MEDIUM | LOW | P1 |
| Dry-run credit estimate | MEDIUM | LOW | P1 |
| Graceful error handling | MEDIUM | LOW | P1 |
| Avatar/voice discovery commands | HIGH | MEDIUM | P2 |
| Pre-generated audio passthrough | MEDIUM | HIGH | P2 |
| Scene chunking (>10 beats) | MEDIUM | MEDIUM | P2 |
| Background color from beat type | LOW | LOW | P2 |
| SRT from audio timing | MEDIUM | LOW | P2 (if audio passthrough is P2) |
| Digital twin support | LOW | HIGH | P3 (enterprise-only prerequisite) |
| Multi-language translation | LOW | HIGH | P3 |
| Hybrid Remotion+HeyGen mode | LOW | HIGH | P3 |

---

## Sources

**v1.0 sources (original research):**
- [Gource](https://gource.io/), [git-story](https://initialcommit.com/blog/git-story), [GitStory](https://www.funblocks.net/aitools/reviews/gitstory-2), [Narakeet](https://www.narakeet.com/docs/script/)

**v1.1 HeyGen sources:**
- [HeyGen API Documentation](https://docs.heygen.com/) — primary reference
- [HeyGen Developers Portal](https://developers.heygen.com) — SDK and quick-start
- [Create Videos with Photo Avatars Using HeyGen API](https://docs.heygen.com/docs/create-videos-with-avatars) — avatar types
- [Generate Studio Video (Create Avatar Video V2)](https://docs.heygen.com/docs/create-video) — request structure
- [Using Audio Files as Voice in HeyGen Avatar Videos](https://docs.heygen.com/docs/using-audio-source-as-voice) — audio passthrough
- [Get Video Status/Details](https://docs.heygen.com/reference/video-status) — polling workflow
- [List Available Voices V2](https://docs.heygen.com/reference/list-voices-v2) — voice enumeration
- [List All Avatars](https://docs.heygen.com/reference/list-avatars-v2) — avatar enumeration
- [Upload Asset API](https://docs.heygen.com/reference/upload-asset) — audio asset upload
- [HeyGen API Pricing Explained](https://help.heygen.com/en/articles/10060327-heygen-api-pricing-explained) — credit model
- [HeyGen Video Processing Times](https://help.heygen.com/en/articles/9655503-heygen-video-processing-times) — processing time benchmarks
- [HeyGen Avatar IV Complete Guide 2026](https://wavespeed.ai/blog/posts/heygen-avatar-iv-complete-guide-2026/) — Avatar IV capabilities
- [teamduality/heygen-typescript-sdk](https://github.com/teamduality/heygen-typescript-sdk) — community TypeScript SDK reference
- [n8n HeyGen workflow](https://n8n.io/workflows/8622-generate-ai-avatar-videos-from-text-with-heygen-and-upload-to-youtube/) — integration patterns

---
*Feature research for: BuildStory — HeyGen renderer milestone (v1.1)*
*Researched: 2026-04-14*
