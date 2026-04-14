# Pitfalls Research

**Domain:** TypeScript monorepo — markdown/git artifact scanning, LLM narration, FFmpeg video rendering + HeyGen avatar renderer integration
**Researched:** 2026-04-05 (original) / 2026-04-14 (HeyGen milestone addendum)
**Confidence:** HIGH (monorepo/FFmpeg), MEDIUM (LLM integration patterns), HIGH (node-canvas memory), MEDIUM (HeyGen API — undocumented limits, community-sourced)

---

## Critical Pitfalls

### Pitfall 1: fluent-ffmpeg Is Archived — Do Not Use It

**What goes wrong:**
`fluent-ffmpeg` was archived on May 22, 2025 and is deprecated. Projects built on it inherit an unmaintained wrapper around an inherently unstable CLI interface. When FFmpeg releases update argument names or behavior, the wrapper breaks silently or produces wrong output. There is no path to fixes.

**Why it happens:**
It was the obvious search result for "Node.js FFmpeg" for years. Developers reach for it without checking maintenance status.

**How to avoid:**
Use `child_process.spawn` directly to shell out to the FFmpeg binary. Construct the argument arrays explicitly. This is less ergonomic but eliminates the abstraction layer that was doing very little besides building a command string. Wrap the spawn call in a thin typed helper in `@buildstory/core` — a `runFFmpeg(args: string[]): Promise<void>` function is all that's needed.

**Warning signs:**
- `fluent-ffmpeg` appears in `package.json`
- Any `fluent-ffmpeg` import in `@buildstory/core`

**Phase to address:**
Render phase scaffold — establish the FFmpeg invocation pattern before any video assembly code is written.

---

### Pitfall 2: Core Library Absorbs CLI/Config Concerns

**What goes wrong:**
`@buildstory/core` starts importing config files, reading `buildstory.toml`, or processing CLI flags. Once this happens, the n8n node and future MCP wrapper must either duplicate config handling or pull in config-parsing dependencies they don't need. The clean `scan()/narrate()/render()` API gets buried under config glue.

**Why it happens:**
It's faster to "just read the config right here" during early development. The boundary violation is invisible until a second consumer (n8n node) tries to use the core and finds it pulls in the file system and TOML parser as side effects.

**How to avoid:**
`@buildstory/core` accepts only plain typed inputs. Config parsing, env var reading, and CLI argument processing live exclusively in the `buildstory` CLI package. The CLI is responsible for translating config/args into the typed inputs that core expects. Enforce this with an ESLint rule banning imports of `fs`, `process`, and any config library from within `packages/core/src/`.

**Warning signs:**
- `import { readFileSync } from 'fs'` in any `packages/core/src/` file
- `process.env` references in core
- Any TOML/YAML parser in `@buildstory/core`'s `package.json`

**Phase to address:**
Monorepo scaffold — establish and document the boundary rule before any business logic is written.

---

### Pitfall 3: LLM Cost Runaway with No Budget Guard

**What goes wrong:**
A bug causes a loop (e.g., iterating all commits instead of a subset, or retrying indefinitely on soft errors) that fires hundreds of LLM calls. Without a hard spend limit, a single run can generate a bill orders of magnitude larger than expected. This is especially dangerous in the narrate phase where the input is proportional to git history size.

**Why it happens:**
Developers set up API keys and start building without configuring spend limits. The behavior is invisible until the billing email arrives.

**How to avoid:**
- Set hard monthly spend limits on both Anthropic Console and OpenAI billing dashboard before first API call
- In `@buildstory/core`, add a configurable `maxTokenBudget` parameter to `narrate()` — count estimated input tokens before calling the API and reject if over threshold
- Default the CLI config to a conservative `max_input_tokens = 100000` that the user must explicitly raise

**Warning signs:**
- No spend limit set in provider dashboards
- `narrate()` accepting an unbounded timeline JSON without token estimation
- Missing `maxTokens` / `max_tokens` in LLM call configuration

**Phase to address:**
LLM narrator implementation — add the budget guard before the first real API call reaches production.

---

### Pitfall 4: node-canvas Memory Leaks Under Frame Generation Volume

**What goes wrong:**
`node-canvas` (backed by Cairo/libvips) accumulates memory when generating many frames without explicit cleanup. A 60-second video at 24fps means 1,440 canvas allocations. Without calling `canvas.toBuffer()` and then releasing the canvas reference, memory grows until the process crashes or the system thrashes.

**Why it happens:**
The browser Canvas API has no explicit `destroy()` — garbage collection handles it in browsers. Node.js environments running native bindings require manual memory management that doesn't exist in the browser spec. Developers port the familiar canvas usage pattern without the GC workaround.

**How to avoid:**
Process frames in batches. After each frame buffer is written to disk (or piped to FFmpeg stdin), explicitly null out canvas references and run `global.gc()` if available (Node `--expose-gc`) or use a fixed-size work pool. Alternatively, use `sharp` for static frame compositing (lower-level, no retained tree) and reserve `node-canvas` only for frames that need programmatic drawing.

**Warning signs:**
- `new Canvas()` inside a loop with no explicit cleanup
- Resident memory grows monotonically during `render()`
- Process OOM on videos longer than ~30 seconds in CI

**Phase to address:**
Frame generation implementation — establish the batch-and-release pattern from the first frame generation loop.

---

### Pitfall 5: Audio Duration Unknowable Until TTS Returns — Breaking Scene Pacing

**What goes wrong:**
Scene durations are assigned during script generation (before TTS runs), then the actual TTS audio comes back 10–30% shorter or longer than the estimated duration. The rendered video has scenes that end before the narrator finishes, or silent gaps between scenes. Manually aligning audio duration to frame count is fragile and breaks silently.

**Why it happens:**
The narrate phase produces a script with estimated `durationSeconds` per scene based on word count heuristics. TTS models have their own pacing. The render phase trusts the estimate instead of measuring the actual audio file.

**How to avoid:**
The render phase must measure the actual duration of each TTS audio file (using `ffprobe` before assembly) and use that measured duration to set the frame count for each scene. Never trust the script's estimated duration for video assembly. Expose `measuredDurationSeconds` on the rendered scene object so downstream consumers can see actual vs. estimated.

**Warning signs:**
- Scene `durationSeconds` from the script JSON used directly as FFmpeg `-t` argument
- No `ffprobe` call anywhere in the render pipeline
- Audio and video timelines manually calculated from word count

**Phase to address:**
TTS integration and FFmpeg assembly — establish the measure-then-assemble pattern before multi-scene concatenation.

---

### Pitfall 6: LLM Output Schema Drift — Zod Validation Absent

**What goes wrong:**
The LLM narrator returns a JSON script. Without strict schema validation (Zod), a model update or prompt regression returns a response where field names drift (e.g., `narration` becomes `narrationText`, `scenes` becomes `segments`). Downstream render code fails with cryptic `undefined` errors instead of a clear schema error.

**Why it happens:**
Developers call the LLM, `JSON.parse()` the response, and trust the result matches their TypeScript interface. TypeScript interfaces don't validate at runtime — they're erased. The `as ScriptOutput` cast hides the problem.

**How to avoid:**
Define the expected LLM output schema with Zod and parse every LLM response through it. Use `schema.parse()` (throws on mismatch) rather than `schema.safeParse()` for the narrate output, since a malformed script should be a hard error. Use OpenAI's Structured Outputs or Anthropic's tool-use with JSON schema to constrain the model at generation time — this is more reliable than post-hoc validation.

**Warning signs:**
- `JSON.parse(response.content)` without a Zod `.parse()` call immediately after
- TypeScript `as ScriptOutput` cast on LLM response
- Any test that mocks LLM output with a hardcoded object instead of validating the schema

**Phase to address:**
LLM narrator implementation — add Zod schema before the first real narrate call is wired up.

---

### Pitfall 7: pnpm Phantom Dependency Access Breaking Consumer Packages

**What goes wrong:**
`packages/cli` imports a library that is only declared in `packages/core/package.json`, not in its own. pnpm's strict hoisting means the import works locally (where the package happens to be in the store) but fails for consumers who install only `buildstory` CLI from npm, because they don't transitively get the core's dev dependency.

**Why it happens:**
pnpm's content-addressable store makes packages available on disk even when not declared. Developers import and it "just works" — until it doesn't for an end user or in CI with a clean cache.

**How to avoid:**
Each package's `package.json` must explicitly declare every package it imports, using `workspace:*` protocol for internal deps. Use `pnpm ls --depth=0` or `eslint-plugin-import` to catch undeclared imports. Run `pnpm install --frozen-lockfile` in CI to catch phantom dependencies early.

**Warning signs:**
- `import X from 'some-lib'` in `packages/cli` where `some-lib` is not in `packages/cli/package.json`
- CI works but fresh installs fail for external users
- `pnpm install --frozen-lockfile` fails in CI

**Phase to address:**
Monorepo scaffold — enforce from the start, before packages accumulate shared dependencies organically.

---

### Pitfall 8: Markdown Parser Treating GSD/GStack Artifacts as Generic Markdown

**What goes wrong:**
GSD planning artifacts use structured patterns (`## Requirements`, checkbox lists, TOML-like blocks, status markers) that have semantic meaning beyond generic markdown. A generic remark/unified pipeline extracts headings and text but discards the structured status, requirement states, and cross-references that make the timeline meaningful. The resulting timeline events have no metadata — just "heading changed."

**Why it happens:**
Developers reach for a markdown-to-AST parser and walk the AST generically. They don't write artifact-aware extraction rules that understand GSD/GStack document conventions.

**How to avoid:**
Write an artifact-aware extraction layer on top of the mdast AST. Define recognition patterns for:
- GSD planning files by filename pattern (`PROJECT.md`, `MILESTONES.md`, `.planning/`)
- GStack skill invocations (heading + structured content blocks)
- Requirement checkboxes and their status (`[ ]` vs `[x]`)
- Cross-references between planning docs

The remark/unified pipeline produces the AST; the artifact layer applies semantic rules on top. Keep them separate so the AST parsing is swappable.

**Warning signs:**
- Timeline JSON events with no `type`, `status`, or `source` fields — just raw text
- All events have the same `type: "markdown-heading"` regardless of document structure
- No test fixtures using actual GSD planning files

**Phase to address:**
Scanner and timeline extraction — define artifact types and recognition patterns before writing the timeline output format.

---

## HeyGen Integration Pitfalls

*Added 2026-04-14 for v1.1 HeyGen renderer milestone. These pitfalls are specific to adding HeyGen as a pluggable renderer alongside the existing Remotion pipeline.*

---

### Pitfall 9: StoryArc Beat Format Mismatches HeyGen's Scene Model — Silent Degradation

**What goes wrong:**
The current `StoryArc` is a sequence of `StoryBeat` objects with typed narrative roles (`idea`, `obstacle`, `pivot`, `result`, etc.), `visual_cue` text, and optional `duration_seconds`. HeyGen's API organizes video as scenes where each scene is an avatar speaking a single block of text with optional background and text overlays. The semantic gap is significant: a beat's `visual_cue` field has no rendering path in HeyGen (there is no programmatic API to switch background images or trigger code-diff overlays mid-avatar video). Without an explicit mapping layer, beat metadata is silently discarded and the output becomes a talking head reading all beat summaries back-to-back with no visual differentiation.

**Why it happens:**
The Remotion renderer was designed around `visual_cue` and beat type — it renders different visual compositions per beat type (timeline advancing, architecture diagram, code diff). HeyGen has none of these hooks in its API: you send text, it returns an avatar speaking. Developers reuse the existing `StoryArc` as input to the HeyGen renderer without accounting for the missing visual layer.

**How to avoid:**
Define a `HeyGenSceneInput` intermediate type that maps `StoryBeat` fields to what HeyGen actually accepts:
- `text`: the beat's `summary` (respecting the 1,500 character per-scene practical limit — see Pitfall 11)
- `avatarId`, `voiceId`: from config
- Optional: a background image URL (static per run, not per-beat)

Acknowledge in code comments which `StoryBeat` fields have no HeyGen equivalent (`visual_cue`, `tone`, `type`). Add a `heygen` format preset to the `format()` step that rewrites beat summaries for avatar delivery style (shorter sentences, fewer technical terms, no code references) rather than piping Remotion-optimized summaries directly to HeyGen.

**Warning signs:**
- HeyGen renderer takes `StoryArc` and maps `beat.summary` directly to HeyGen scene text with no transformation
- `visual_cue` field is present in input but never referenced in HeyGen renderer code
- No `heygen` format preset in the narrate/format pipeline

**Phase to address:**
HeyGen renderer scaffold — establish the mapping layer before wiring the API call.

---

### Pitfall 10: Polling Without Exponential Backoff — Hangs or Gets Throttled

**What goes wrong:**
HeyGen video generation is asynchronous: the API returns a `video_id` immediately, and the actual video takes minutes to generate (roughly 10 minutes per 1 minute of output, or longer if not within priority quota). Developers implement a naive polling loop — checking status every 5 seconds until completion — which works for short videos but causes one of two failure modes: (a) tight polling triggers HeyGen's undocumented rate limit and returns throttling errors, or (b) the loop runs for 30+ minutes on long videos and the CLI process is killed by the user or a CI timeout.

**Why it happens:**
HeyGen's Quick Start guide shows polling as the simplest integration path. Developers copy the pattern without adding backoff or timeout handling. HeyGen also supports webhooks, but webhooks require a public endpoint — impractical for a local CLI tool.

**How to avoid:**
Since BuildStory is a local CLI tool (no public URL for webhooks), polling is the correct approach. Implement it correctly:
- Start with a 15-second initial delay (video is never ready instantly)
- Use exponential backoff: 15s, 30s, 60s, 120s, then cap at 120s and continue
- Set a configurable `maxWaitMinutes` (default: 30) that fails fast with a clear error explaining how to retrieve the video later using `video_id`
- Log the `video_id` to stdout at submission time so the user can retrieve the video manually if polling times out
- Handle the known stuck-at-33%/97% failure mode: if status has not changed for 10+ minutes, treat as a failed generation, log the `video_id`, and exit with a non-zero code

**Warning signs:**
- Polling interval is constant (not exponential)
- No `maxWaitMinutes` or equivalent timeout parameter
- `video_id` is not logged to stdout before polling begins
- Status unchanged detection is absent from the polling loop

**Phase to address:**
HeyGen video completion polling implementation.

---

### Pitfall 11: Script Character Limit Causes Silent Truncation or API Error

**What goes wrong:**
HeyGen enforces a 1,500-character practical limit per scene (the documented max is 5,000 characters for a full video script, but single-scene inputs are limited to ~1,500 characters in practice; Avatar IV enforces a hard 180-second per scene limit). Beat summaries generated for Remotion are often 200–500 characters, but `story` and `pitch` style beats can be longer. Multi-beat scenes assembled into a single HeyGen scene text block will breach the limit and return a 400 error or produce a truncated video that the API reports as completed.

**Why it happens:**
The character limit is not prominently documented in the API reference. Developers test with short beats and only discover the limit when longer narration styles are used in production. The HeyGen API may return a 200 response with a video that silently stops speaking mid-sentence.

**How to avoid:**
- Implement a `splitBeatForHeyGen(beat: StoryBeat): string[]` function that chunks beat text into segments under 1,400 characters (leaving a 100-character safety margin) at sentence boundaries
- Map each chunk to a separate HeyGen scene in a multi-scene video request
- Add a pre-flight check that logs a warning when any beat summary exceeds 1,000 characters before submitting to the API
- Use the v2 Studio API (multi-scene endpoint) rather than the v1 single-scene endpoint for all HeyGen video generation

**Warning signs:**
- Beat text is concatenated into a single HeyGen scene without length checking
- Single-scene v1 endpoint used instead of multi-scene Studio v2 endpoint
- No pre-flight character count validation before API submission

**Phase to address:**
HeyGen scene mapping layer — implement before any API call is wired up.

---

### Pitfall 12: Cost Surprises from Avatar IV Pricing (6x Credit Multiplier)

**What goes wrong:**
Standard HeyGen avatar generation costs 1 credit per 1 minute of video. Avatar IV — the high-quality model with full-body motion and micro-expressions — costs 1 credit per 10 seconds, or approximately 6x more. A 5-minute build story video that costs 5 credits on the standard avatar costs 30 credits with Avatar IV. The API's default avatar selection may silently use Avatar IV depending on the `avatar_id` chosen, making the cost opaque until the billing statement arrives.

**Why it happens:**
HeyGen's pricing documentation distinguishes Avatar IV on a separate "Generative Credits" track that is not the same credit pool as standard API credits. Developers testing with a free or trial account may use Avatar IV in the UI without realizing the API billing model is different.

**How to avoid:**
- Before submission, log the estimated credit cost: derive it from `totalDurationSeconds` and whether Avatar IV is configured
- Add a `heygen.avatarTier` config option (`standard` | `avatar-iv`) with `standard` as the default
- Add a `--dry-run` flag that prints estimated cost without submitting the API request
- Document the credit multiplier prominently in the HeyGen renderer README and `buildstory.toml` schema comments
- Use the `GET /v2/remaining-quota` endpoint to check available credits before submitting, and fail early with a clear message if insufficient

**Warning signs:**
- No pre-submission credit estimate logged to stdout
- No distinction between `standard` and `avatar-iv` tier in config
- Missing `--dry-run` cost-estimate mode
- No quota check before video submission

**Phase to address:**
HeyGen cost estimation and pre-flight checks — implement before any credits are consumed in development.

---

### Pitfall 13: Daily Rate Limit Exceeds Without Warning — Opaque Error

**What goes wrong:**
HeyGen enforces a daily rate limit (error code `400140`, message "Exceed rate limit", detail "Daily rate limit exceeded"). This limit is not documented with specific numbers. When hit, the API returns a 400 with this error code and the video is not queued. Developers treating it as a retryable error (5xx-style) will loop indefinitely against a 400 that will not resolve for 24 hours.

**Why it happens:**
The rate limit resets daily. During development with rapid iteration, it is easy to hit the limit while testing the polling loop. The error code `400140` looks like a generic bad-request error without reading the detail field, leading to misclassification as a transient error.

**How to avoid:**
- Explicitly check for error code `400140` in the API error response body (not just HTTP status)
- On `400140`, exit immediately with a clear message: "HeyGen daily rate limit reached. Video ID not created. Wait 24 hours or upgrade your plan."
- Do not retry `400140` — it is a hard stop, not a transient condition
- During development, use a staging/test API key with a lower spend cap to discover limits before hitting them in production runs

**Warning signs:**
- Error handling treats all 4xx responses with the same retry logic
- No explicit check for error code `400140` in the error handler
- Polling starts after a 400 error (impossible — no `video_id` was returned)

**Phase to address:**
HeyGen API error handling — implement as the first thing in the HeyGen renderer before the happy path.

---

### Pitfall 14: Download URL Expiry — Video Lost If Not Saved Immediately

**What goes wrong:**
The HeyGen video status endpoint returns a `video_url` that is a presigned S3 URL with an expiration time. If the polling loop retrieves the URL and the CLI crashes, or the user does not download within the expiry window, the URL becomes invalid. Calling the status endpoint again regenerates a new URL, but developers who cache the URL (e.g., in a progress object or file) may serve an expired URL to the user.

**Why it happens:**
Presigned S3 URLs are standard for cloud storage but unfamiliar to developers who expect a permanent URL. HeyGen's documentation notes that "every time you call the video status endpoint, the expiration time is regenerated," which implies the URL should be fetched fresh each time — but this behavior is easy to miss.

**How to avoid:**
- Download the video to a local file immediately when the status transitions to `completed` — do not store the URL for later use
- Never cache the `video_url` across polling iterations; always use the URL from the most recent status call
- If download fails after URL retrieval, call the status endpoint again to get a fresh URL before retrying the download
- Log the `video_id` prominently so the user can retrieve a fresh URL manually if anything goes wrong

**Warning signs:**
- `video_url` stored in a variable across multiple polling iterations without refresh
- Download retry logic uses a cached URL instead of fetching a new one from the status endpoint
- No logging of `video_id` before the download step begins

**Phase to address:**
Video download implementation — after polling completes, before saving to disk.

---

### Pitfall 15: Avatar + Voice Mismatch Produces Uncanny Valley Output

**What goes wrong:**
HeyGen avatar voices are not universally compatible. Using a voice ID that was not trained with a specific avatar produces accent mismatches (documented case: Asian accent on a Caucasian avatar), gender mismatches, or the API error "streaming avatar not support this voice." The error is not always thrown — sometimes the API accepts the combination and produces a video where the voice sounds disconnected from the avatar's visual style.

**Why it happens:**
Developers grab an avatar ID and a voice ID from separate API list endpoints and combine them without verifying compatibility. The HeyGen UI enforces recommended pairings; the API does not.

**How to avoid:**
- Use `GET /v2/avatars` to list avatars; each avatar entry includes a `default_voice_id` field — use this as the default voice for that avatar
- Expose `heygen.avatarId` and `heygen.voiceId` as separate config options; when `voiceId` is not set, fetch and use the avatar's `default_voice_id` at runtime
- Log the resolved `avatarId` and `voiceId` pair before submission so the user can verify
- Document in config schema comments that custom `voiceId` should be from the same language/gender as the avatar to avoid uncanny valley results

**Warning signs:**
- `voiceId` hardcoded or set independently of `avatarId` without a compatibility check
- No fallback to `default_voice_id` when voice is not explicitly configured
- No pre-submission log of the avatar + voice pair being used

**Phase to address:**
HeyGen avatar and voice selection implementation.

---

### Pitfall 16: Existing Remotion Pipeline Assumptions Leak Into HeyGen Renderer

**What goes wrong:**
The existing `renderVideo()` function in `packages/video` takes a `StoryArc` and `AudioManifest`. The `AudioManifest` contains pre-generated TTS audio file paths with measured durations that Remotion uses to sync frames. A HeyGen renderer does not need — and must not receive — an `AudioManifest`, because HeyGen performs TTS internally as part of video generation. If the renderer interface is naively extended to include `AudioManifest` as an optional parameter, callers may pass stale audio data, or the HeyGen renderer may attempt to reference local audio files that are irrelevant.

Similarly, the Remotion renderer generates frames using `canvas` + `sharp` + FFmpeg. If the HeyGen renderer module is placed in `packages/video` without a clean interface boundary, the HeyGen package will transitively import Remotion, `canvas`, `sharp`, and `ffmpeg-static` — none of which are needed for the HeyGen path.

**Why it happens:**
The natural reflex is to extend the existing renderer to "also do HeyGen" by adding a flag. Without an explicit renderer interface (pluggable provider pattern), the two renderers share types that don't apply to both.

**How to avoid:**
- Define a `VideoRenderer` interface in `@buildstory/core` that takes only what is universal: `StoryArc`, renderer-specific options typed as `Record<string, unknown>` or a discriminated union
- The HeyGen renderer lives in its own package (`packages/heygen-renderer` or `packages/video-heygen`) with no imports from `packages/video`
- The CLI selects the renderer at runtime based on `--renderer=heygen` and imports only that renderer's package
- The TTS phase is skipped entirely when `--renderer=heygen` is active (HeyGen does its own TTS)

**Warning signs:**
- `AudioManifest` appears in the HeyGen renderer's function signature
- HeyGen renderer imports anything from `packages/video`
- `canvas`, `sharp`, or `@remotion/*` appear in the HeyGen renderer's `package.json`
- TTS generation runs before invoking the HeyGen renderer

**Phase to address:**
HeyGen renderer package setup — establish the interface boundary before writing any API integration code.

---

### Pitfall 17: Long Processing Times Exceed CLI User Expectations — No Progress Feedback

**What goes wrong:**
HeyGen video generation takes 10 minutes per 1 minute of output under normal conditions. Videos outside the monthly priority quota can take 2–36 hours. A BuildStory run for a typical project (5–10 beat story arc, 3–6 minutes of avatar video) will sit in `waiting...` for 10–60 minutes. Without meaningful progress output, users will assume the CLI has hung and kill the process — losing the `video_id` and wasting the credit.

**Why it happens:**
The existing Remotion render phase shows frame-level progress (Remotion provides `onProgress` callbacks). HeyGen provides no equivalent — the status endpoint returns only `pending`, `processing`, or `completed`. Developers who port the progress pattern from Remotion to HeyGen find there is nothing to report.

**How to avoid:**
- Log the `video_id` immediately after submission with a message like: "HeyGen video submitted. ID: [id]. Polling for completion..."
- Emit a heartbeat log line on each polling interval showing elapsed time: "Still processing... (4m 30s elapsed)"
- At submission time, estimate the wait time based on video duration and log it: "Estimated wait: 10–20 minutes based on [N] seconds of video"
- Emit the HeyGen status page URL (`https://status.heygen.com`) in the output so users know where to look if the service appears degraded

**Warning signs:**
- No log output between submission and completion
- `video_id` is not logged before the polling loop begins
- No elapsed time in polling heartbeat messages

**Phase to address:**
HeyGen polling and UX implementation.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode OpenAI as sole LLM provider | Ships faster, no abstraction needed | Can't add Anthropic without rewrite; provider-specific error codes leak everywhere | Never — the PRD requires both providers |
| Use `fluent-ffmpeg` for familiarity | Less FFmpeg argument knowledge needed | Unmaintained, breaks on FFmpeg version updates, adds dead dependency | Never — archived May 2025 |
| Estimated TTS duration instead of measured | Simpler pipeline | Audio/video desync on any video longer than ~10 seconds | Never in video assembly |
| Single `tsconfig.json` at root | Easier to set up | Types bleed across packages, no incremental build, IDE confusion about which package owns a file | MVP only, must be fixed before publishing packages |
| `JSON.parse()` without Zod on LLM output | Less code | Silent failures when model response schema drifts | Never — runtime type safety on LLM output is mandatory |
| Write all packages to `packages/core` during early dev | Avoids monorepo plumbing friction | Package boundaries become impossible to enforce retroactively | Prototype/spike only, resolve before v1 |
| Reuse Remotion `StoryArc` input directly in HeyGen renderer | No new types needed | Beat metadata with no HeyGen equivalent is silently discarded; avatar output is degraded talking-head with no visual structure | Never — define a `HeyGenSceneInput` mapping layer |
| Extend `AudioManifest` type to HeyGen renderer | Uniform interface across renderers | HeyGen does its own TTS; passing an `AudioManifest` introduces dead parameters and potential confusion | Never — HeyGen renderer must not accept `AudioManifest` |
| Place HeyGen renderer in `packages/video` | Less package overhead | Transitively imports Remotion, canvas, sharp, ffmpeg-static into every HeyGen-only consumer | Never — isolate in its own package |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Anthropic SDK streaming | Treating streaming errors the same as non-streaming errors — streaming can return HTTP 200 then error mid-stream | Handle both `stream.on('error')` and check for error events in the SSE stream separately from HTTP status |
| OpenAI TTS | Assuming `mp3` output has a predictable duration from text length | Always run `ffprobe` on the output file to get actual duration before using it in video assembly |
| FFmpeg `concat` demuxer | Using it when frames have different pixel formats or resolutions | Use `filter_complex` concat with explicit `scale` and `format` filters; or normalize all frames to the same spec during generation |
| FFmpeg `spawn` | Forgetting to consume stdout/stderr — Node.js buffers fill, the process hangs | Always attach listeners to `proc.stdout` and `proc.stderr` even if only draining them to `/dev/null` |
| `simple-git` | Calling `git log` with default `maxBuffer` on a large repository — `execOptions` defaults cap at 1MB | Pass `maxBuffer: 50 * 1024 * 1024` and set a realistic `--max-count` limit; never do unbounded git log traversal |
| pnpm `workspace:*` vs semver range | Using `"@buildstory/core": "^1.0.0"` — pnpm resolves this from the registry, not the workspace | Always use `workspace:*` for internal package dependencies during development |
| OpenAI Structured Outputs | Omitting `additionalProperties: false` in the JSON schema — model hallucinates extra fields | Every object in the schema must include `"additionalProperties": false`; use Zod's `.strict()` to generate it |
| HeyGen video status endpoint | Using cached `video_url` from a prior polling iteration for the download | Always use the URL from the most recent status call — presigned S3 URLs expire and are regenerated on each status fetch |
| HeyGen error code `400140` | Treating "Daily rate limit exceeded" as a retryable transient error | Immediately exit with clear message and do not retry; the limit resets after 24 hours |
| HeyGen avatar + voice selection | Choosing `avatarId` and `voiceId` independently from different list endpoints | Fetch `default_voice_id` from the avatar record and use it as the fallback voice for that avatar |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Generating all video frames before piping any to FFmpeg | Peak memory = (frame count × frame size); OOM on longer videos | Pipe frames to FFmpeg stdin as a stream, or write to a temp dir and use the concat demuxer with file list | ~100 frames (~4 seconds at 24fps) on a 512MB process limit |
| Calling `narrate()` with full raw markdown content instead of extracted timeline | Context window overflow (128K–200K token limits hit), cost spike | Summarize and chunk content in the scanner phase; pass structured timeline events to narrator, not raw file contents | Projects with >50 planning documents |
| Sequential TTS generation (one scene at a time) | Render phase takes minutes waiting on API round trips | Parallelize TTS calls with `Promise.all()` across scenes; TTS has no ordering dependency | Videos with >5 scenes |
| Re-running full git log on every `scan()` call | Slow on repos with thousands of commits | Cache the timeline JSON with a content hash of relevant file paths + latest commit SHA as the cache key | Repos with >5,000 commits |
| Tight HeyGen polling interval (< 15 seconds) | Rate limit errors from HeyGen before video is ready; wasted API quota | Start polling at 15s, use exponential backoff capped at 120s; video is never ready in under 30s | Any HeyGen video generation run |
| Submitting all beats as one large HeyGen scene | 400 error or silent mid-sentence truncation when text > 1,400 chars | Split at sentence boundaries into chunks under 1,400 chars; map each chunk to a separate HeyGen scene | Beat summaries from `story` or `pitch` style presets on complex projects |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing Anthropic/OpenAI API keys in `buildstory.toml` (checked into git) | Key exposure in public repos | Read API keys only from environment variables; document in CLI help that keys must not go in config files; add `*.toml` to `.gitignore` example only if it would contain secrets — better to make the config file key-free by design |
| Scanning arbitrary paths without validation | Path traversal — a malicious `buildstory.toml` could point the scanner at `/etc/` | Validate all scan root paths are within the declared project directory; reject absolute paths outside the working dir |
| Passing unsanitized git commit message content directly into FFmpeg subtitle filters | FFmpeg filter injection via specially crafted commit messages | Escape all user-supplied text before embedding in FFmpeg filter arguments; use `-metadata` flags rather than inline filter strings where possible |
| Storing `HEYGEN_API_KEY` in `buildstory.toml` | Key exposure in public repos — same risk as LLM keys | Read `HEYGEN_API_KEY` from environment variable only; add explicit validation at startup that rejects key-in-config patterns |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent failure when FFmpeg is not installed | `render()` fails with a cryptic spawn error at the end of a long scan+narrate run | Check for FFmpeg at startup with `which ffmpeg` / `ffmpeg -version`; exit early with a clear install message before any expensive API calls |
| No progress output during long operations | User can't tell if the tool is working or hung — narrate and render can each take 30–120 seconds | Emit progress events (`scan:complete`, `narrate:scene:N`, `render:frame:N`) from core so CLI can display them; never have a silent multi-second wait |
| Emitting generated video to cwd without warning | Unexpected large file (100–500MB) written to the project directory | Default output to a `./buildstory-out/` subdirectory; make the path configurable; warn about estimated file size before writing |
| Overwriting previous output without asking | User loses a carefully generated video by re-running | Append timestamp to output filename by default, or check for existence and prompt before overwrite |
| HeyGen polling with no elapsed time feedback | User sees no output for 10–60 minutes and kills the process, losing the `video_id` and wasting credits | Log `video_id` immediately at submission; emit a heartbeat line every polling interval showing elapsed time and estimated remaining wait |
| HeyGen cost opaque until billing statement | Unexpected credit spend when Avatar IV tier is selected without cost warning | Add `--dry-run` flag showing estimated credit cost before any API submission; log credits-per-minute rate at job start |

---

## "Looks Done But Isn't" Checklist

- [ ] **FFmpeg availability check:** The render phase spawns FFmpeg — verify there is an explicit pre-flight check that fails fast with a human-readable error if `ffmpeg` is not on PATH
- [ ] **TTS duration measurement:** The first multi-scene video looks synced — verify `ffprobe` is called on each TTS audio file and the measured duration (not the estimated one) drives frame count
- [ ] **Core package isolation:** The core library compiles cleanly — verify `packages/core/package.json` has zero runtime dependencies on `fs`, config parsers, or CLI libraries
- [ ] **LLM schema validation:** The narrator returns valid JSON — verify every LLM response goes through `z.parse()` before being typed as `ScriptOutput`; check what happens when the model returns a refusal
- [ ] **Temp file cleanup:** A render completes — verify the tmp directory of individual frames and audio files is deleted on both success and error paths (use `try/finally`)
- [ ] **Git history boundary:** `scan()` runs on a large repo — verify `--max-count` or equivalent is applied so the scanner doesn't process an unbounded commit history
- [ ] **Monorepo phantom deps:** All packages build — verify `pnpm install --frozen-lockfile` passes in a fresh Docker container with no pre-existing store
- [ ] **HeyGen video_id logged before polling:** A HeyGen run starts — verify the `video_id` is written to stdout before polling begins so recovery is possible if the process is killed
- [ ] **HeyGen beat-to-scene mapping:** A `StoryArc` is submitted to HeyGen — verify no beat summary exceeds 1,400 characters and each chunk maps to a separate scene
- [ ] **HeyGen AudioManifest absent:** The HeyGen renderer is invoked — verify TTS generation is skipped and no `AudioManifest` is produced or consumed in the HeyGen path
- [ ] **HeyGen 400140 error handling:** Rate limit is simulated — verify the error exits immediately without retry and logs a clear 24-hour wait message
- [ ] **HeyGen download uses fresh URL:** Video completes — verify the download uses the URL from the final status call, not a URL cached from an earlier polling iteration

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Core library has absorbed config/CLI concerns | HIGH | Extract all config-touching code into the CLI package; audit every import in `packages/core/` against a banned-import list; this is a refactor, not a patch |
| fluent-ffmpeg is already in use | MEDIUM | Replace with direct `child_process.spawn` calls; the spawn wrapper is ~50 lines; write the replacement in one sitting before the render phase grows larger |
| LLM cost runaway incident | LOW (code) / potentially HIGH (cost) | Rotate API key immediately; add spend limits to provider dashboards; add token estimation before API calls; review billing alert settings |
| Audio/video desync discovered after render | MEDIUM | Retrofit `ffprobe` duration measurement into the render pipeline; rewrite the frame count calculation to use measured duration; regenerate affected videos |
| node-canvas OOM on long video | MEDIUM | Refactor frame generation to process in batches of N frames; write each batch to disk and clear references before the next batch |
| HeyGen renderer imports from `packages/video` | MEDIUM | Extract HeyGen renderer into its own package with no `packages/video` dependency; update CLI to import from new package |
| HeyGen credits exhausted mid-development | LOW (code) / MEDIUM (cost) | Credit runs are non-refundable; add `--dry-run` before any future API submissions; set a credit spend alert in HeyGen billing dashboard |
| Beat summaries silently truncated by HeyGen | MEDIUM | Add pre-flight character count validation; implement `splitBeatForHeyGen()` chunker; regenerate affected videos with corrected scene mapping |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| fluent-ffmpeg dependency | Render phase scaffold | `grep -r "fluent-ffmpeg" packages/` returns nothing |
| Core library boundary violation | Monorepo scaffold | ESLint rule in `packages/core/.eslintrc` banning `fs`, `process`, config libs |
| LLM cost runaway | LLM narrator implementation | `narrate()` has a `maxInputTokens` parameter with a default; spend limits set in provider dashboards |
| node-canvas memory leak | Frame generation implementation | Render a 120-second test video without RSS memory growth exceeding 2× per-frame allocation |
| Audio/video desync | TTS integration + FFmpeg assembly | `ffprobe` call exists in render pipeline; scene duration from measured audio, not script estimate |
| LLM output schema drift | LLM narrator implementation | All LLM responses pass through `z.parse(ScriptOutputSchema)` before use |
| Phantom dependencies | Monorepo scaffold | `pnpm install --frozen-lockfile` in clean Docker container passes |
| Generic markdown parsing (missing artifact semantics) | Scanner implementation | Timeline JSON events include `type`, `status`, and `source` fields with artifact-specific values |
| FFmpeg process stdout/stderr not consumed | Render phase scaffold | All `spawn()` calls have attached stderr/stdout listeners |
| TTS duration estimation (not measured) | Render phase assembly | No reference to script `durationSeconds` in the frame count calculation |
| StoryArc-to-HeyGen mapping gap | HeyGen renderer scaffold | `HeyGenSceneInput` type defined; `visual_cue` has no HeyGen equivalent noted in code comments |
| HeyGen polling without backoff | HeyGen polling implementation | Polling uses exponential backoff; `maxWaitMinutes` config exists; `video_id` logged before loop |
| HeyGen script character limit | HeyGen scene mapping layer | Pre-flight character count check; `splitBeatForHeyGen()` exists; no beat exceeds 1,400 chars |
| HeyGen Avatar IV cost surprise | HeyGen pre-flight checks | `--dry-run` flag shows credit estimate; `heygen.avatarTier` config option exists |
| HeyGen daily rate limit mishandled | HeyGen API error handling | Error code `400140` exits immediately without retry |
| HeyGen download URL expiry | Video download implementation | Download uses URL from final status call; `video_id` logged before download starts |
| Avatar/voice mismatch | HeyGen avatar + voice selection | `default_voice_id` fetched from avatar record when `voiceId` not configured |
| Remotion pipeline assumptions in HeyGen | HeyGen package setup | HeyGen renderer in separate package; no imports from `packages/video`; TTS phase skipped |
| Long processing with no user feedback | HeyGen polling and UX | Heartbeat log line every polling interval; estimated wait logged at submission; `video_id` in stdout |

---

## Sources

- fluent-ffmpeg archived: https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/issues/1324
- Anthropic streaming errors: https://github.com/anthropics/anthropic-sdk-typescript/issues/842 and https://docs.anthropic.com/en/api/errors
- pnpm phantom dependencies: https://pnpm.io/workspaces and https://dev.to/silverstream/pnpm-workspaces-in-production-what-actually-matters-16p7
- TypeScript project references cache staleness: https://github.com/microsoft/TypeScript/issues/57647
- LLM structured output pitfalls: https://dev.to/pockit_tools/llm-structured-output-in-2026-stop-parsing-json-with-regex-and-do-it-right-34pk
- LLM cost runaway patterns: https://toolshelf.tech/blog/why-your-llm-api-costs-are-through-the-roof/
- node-canvas memory issues: https://github.com/Automattic/node-canvas/issues/763 and https://www.joshbeckman.org/blog/memory-leaks-using-canvas-in-node
- FFmpeg concat pitfalls: https://cloudinary.com/guides/video-effects/ffmpeg-concat and https://www.mux.com/articles/stitch-multiple-videos-together-with-ffmpeg
- FFmpeg Node.js frame rendering: https://leanylabs.com/blog/node-videos-konva/
- pnpm publishConfig/exports: https://colinhacks.com/essays/live-types-typescript-monorepo
- LLM budget enforcement: https://opensourceaihub.ai/docs/llm-budget-enforcement
- HeyGen video processing times: https://help.heygen.com/en/articles/9655503-heygen-video-processing-times
- HeyGen rate limits discussion: https://docs.heygen.com/discuss/67996983694dc40044f3a658
- HeyGen daily rate limit error: https://docs.heygen.com/discuss/673412b7a6e2b6003dae4dec
- HeyGen error responses: https://docs.heygen.com/reference/errors
- HeyGen throttling community report: https://community.zapier.com/troubleshooting-99/heygen-throttling-https-api-heygen-com-v2-video-generate-60-49019
- HeyGen create video API docs: https://docs.heygen.com/docs/create-video
- HeyGen Avatar IV guide: https://help.heygen.com/en/articles/11269603-heygen-avatar-iv-complete-guide
- HeyGen video status endpoint: https://docs.heygen.com/reference/video-status
- HeyGen webhooks guide: https://docs.heygen.com/docs/using-heygens-webhook-events
- HeyGen API pricing: https://www.heygen.com/api-pricing
- HeyGen dynamic limits: https://help.heygen.com/en/articles/12095329-how-dynamic-non-dynamic-limits-work-at-heygen
- HeyGen video avatar error codes: https://help.heygen.com/en/articles/9824740-video-avatar-creation-error-codes
- HeyGen video stuck at 33%: https://community.heygen.com/public/forum/boards/feedback-and-requests-3gx/posts/why-is-the-generation-process-is-stalling-at-33-jq8gepp1ce
- HeyGen voice mismatch SDK error: https://docs.heygen.com/discuss/6769a90a989b50010bd437ae
- HeyGen remaining quota v2 API: https://docs.heygen.com/reference/get-remaining-quota-v2

---
*Pitfalls research for: TypeScript monorepo — artifact scanning, LLM narration, FFmpeg video rendering + HeyGen avatar renderer integration*
*Original research: 2026-04-05 | HeyGen addendum: 2026-04-14*
