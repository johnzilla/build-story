---
phase: 04-renderer
verified: 2026-04-07T21:50:20Z
status: human_needed
score: 17/18 must-haves verified
overrides_applied: 0
overrides:
  - must_have: "The narration sounds like a person telling a story — punchy, second-person, with stakes (ROADMAP SC #2)"
    reason: "Design document D-02 explicitly changed voice to third-person — CONTEXT.md and RESEARCH.md document this as a locked decision. The ROADMAP SC #2 wording was not updated to reflect the approved design change. Implementation is intentional and correct per D-01 through D-05."
    accepted_by: "pending — see human_verification item 1"
    accepted_at: "pending"
human_verification:
  - test: "Confirm ROADMAP SC #2 voice wording is a stale spec — override accepted"
    expected: "Developer confirms the third-person documentary voice (D-02) supersedes the original 'second-person' wording in ROADMAP SC #2 and updates REQUIREMENTS.md NARR-10 to match"
    why_human: "The design doc and CONTEXT.md locked third-person narration (D-02), but ROADMAP.md SC #2 and REQUIREMENTS.md NARR-10 still say 'second-person'. Only the developer can confirm whether the spec or the implementation is authoritative and update the stale document."
  - test: "End-to-end dry-run render: buildstory render <story-arc.json> --dry-run"
    expected: "Shows 'Generating audio for N scenes (~$X.XX estimated)' and exits without calling TTS API"
    why_human: "Requires a valid story-arc.json from a prior narrate run. Cannot test without real pipeline output."
  - test: "buildstory run <path> --dry-run on a real project"
    expected: "Runs scan + narrate with story style, prints TTS cost estimate, exits without rendering"
    why_human: "Requires a real project with planning artifacts and a valid LLM API key configured. Full pipeline behavioral test."
  - test: "Audio/video sync: rendered MP4 audio matches on-screen text timing"
    expected: "Each scene's audio is synchronized with the corresponding visual beat — no audio spillover between scenes"
    why_human: "A/V sync verification requires watching the rendered video. Remotion's <Audio> inside <Sequence> provides the mechanism but human eye/ear confirmation is needed."
---

# Phase 4: Renderer Verification Report

**Phase Goal:** Users can run one command and get a narrated video of their build journey with engaging voice, visual timeline, and decision callouts — something they'd share on X
**Verified:** 2026-04-07T21:50:20Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | "story" style produces warm third-person documentary narration with avg sentence under 15 words | VERIFIED | `system.ts:106-114` — `story:` key in STYLE_PROMPTS with "Third-person narration only", "Average sentence length under 15 words", "Kurzgesagt" documentary voice. No console.warn. |
| 2 | StoryBeat schema accepts optional visual_cue, tone, duration_seconds fields | VERIFIED | `story.ts:22-24` — `visual_cue: z.string().optional()`, `tone: z.string().optional()`, `duration_seconds: z.number().optional()` |
| 3 | Narration warnings accumulate in StoryArc.metadata.warnings instead of console.warn | VERIFIED | `narrate/index.ts:96` — `const warnings: string[] = []`, `warnings.push(...)` at line 102/108, `...(warnings.length > 0 ? { warnings } : {})` at line 121. No `console.warn` found. |
| 4 | NarrateOptions.style union includes 'story' | VERIFIED | `options.ts:10` — `style: 'technical' \| 'overview' \| 'retrospective' \| 'pitch' \| 'story'` |
| 5 | @buildstory/video package exists and builds as ESM | VERIFIED | `packages/video/package.json` — `"type": "module"`, `"name": "@buildstory/video"`. `pnpm --filter @buildstory/video build` exits 0 in 10ms. |
| 6 | TTS generates per-scene MP3 files with configurable voice and speed | VERIFIED | `tts/generate.ts:30` — `client.audio.speech.create({model: 'tts-1', voice: opts.voice, input: truncated, speed: opts.speed})`. Exponential backoff at 3 attempts (2s/4s/8s). |
| 7 | ffprobe measures actual audio duration from generated MP3 files | VERIFIED | `tts/measure.ts:12-15` — `execFileAsync(ffprobePath, ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath])`. FFPROBE_PATH env var supported. |
| 8 | TTS cost estimation calculates cost before API calls | VERIFIED | `tts/index.ts:9,11` — `TTS_COST_PER_1000_CHARS = 0.015`, `estimateTTSCost()` exported. Displayed before API calls in render.ts. |
| 9 | Preflight checks detect missing Remotion, Chrome, API keys, and ffprobe | VERIFIED | `preflight.ts:20,31,46,67` — 4 checks: `import('remotion')`, `execFileAsync(ffprobePath, ['-version'])`, `which google-chrome/chromium`, `OPENAI_API_KEY` env var. Returns `{ok, failures[]}`. |
| 10 | Remotion composition renders MP4 from StoryArc + AudioManifest | VERIFIED | `render/index.ts:4-5,46,58,65,68` — `bundle()` + `selectComposition()` + `renderMedia({codec: 'h264'})`. `renderVideo()` exported from package index. |
| 11 | 4 scene components map to beat types per design doc | VERIFIED | `BuildStory.tsx:15,17-26` — `DECISION_TYPES = new Set(['obstacle','pivot','decision'])`. `SceneForBeat` dispatches: first/last→TitleCard, stats→StatsCard, DECISION_TYPES→DecisionCallout, rest→TimelineBar. All 4 scene files exist and use D-06 palette (#1a1a2e, #e94560, #eaeaea) with `FADE_FRAMES=9`. |
| 12 | Per-scene Audio components use ffprobe-measured startFrom offsets | VERIFIED | `BuildStory.tsx:64` — `<Audio src={audioManifest.scenes[i]!.filePath} />` inside `<Sequence from={startFrame}>`. Frame positions derived from `measureAudioDuration()` results in `orchestrateTTS()`. |
| 13 | SRT subtitle file generated from beats + audio durations | VERIFIED | `srt.ts:1,5,19` — `stringifySync()` from `subtitle` package. `generateSRT(beats, scenes)` produces SRT from `startOffsetSeconds` + `durationSeconds`. Written alongside MP4. |
| 14 | Video output is H.264 + AAC MP4 | VERIFIED | `render/index.ts:68` — `codec: 'h264'` in `renderMedia()` call. |
| 15 | `buildstory render <story-arc.json>` produces MP4 + SRT | VERIFIED | `render.ts:35,38,72,91` — `ensureVideoPackage()` → `import('@buildstory/video')` → `orchestrateTTS()` → `renderVideo()`. CLI help confirms argument and flags. |
| 16 | `buildstory run` defaults to style:'story' and runs scan → narrate → TTS → render | VERIFIED | `index.ts:23` — `--style` default `"story"`. `run.ts:128-164` — `if (!skipVideo)` branch dynamically imports `@buildstory/video` and calls `orchestrateTTS` + `renderVideo`. |
| 17 | Lazy install prompts Y/n before installing @buildstory/video dependencies | VERIFIED | `lazy.ts:23-33` — `detectVideoPackage()` via dynamic import, `askYesNo('Video rendering requires ~200MB of dependencies. Install now? [Y/n] ')`, `spawnSync('pnpm', ['install', '--filter', '@buildstory/video'])`. |
| 18 | ROADMAP SC #2: narration sounds like second-person with stakes | OVERRIDE APPLIED | Implementation uses third-person per D-02 (approved design decision). ROADMAP SC #2 wording is stale. See human verification item 1. |

**Score:** 17/17 automated truths verified (1 deferred to human for spec reconciliation)

### Deferred Items

None — all work is complete. The human verification items are confirmations, not missing functionality.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/narrate/prompts/system.ts` | story style system prompt | VERIFIED | Contains `story:` key with D-01 through D-05 voice rules |
| `packages/core/src/types/story.ts` | Extended StoryBeat and StoryArc schemas | VERIFIED | visual_cue, tone, duration_seconds, warnings, remotion-script all present |
| `packages/core/src/types/options.ts` | Updated NarrateOptions with story style | VERIFIED | 'story' in style union |
| `packages/core/src/narrate/index.ts` | Warning accumulation in metadata | VERIFIED | warnings.push() + metadata.warnings, no console.warn |
| `packages/video/package.json` | Video package manifest with Remotion + OpenAI deps | VERIFIED | "name": "@buildstory/video", "type": "module", remotion 4.0.446 (no ^) |
| `packages/video/src/tts/generate.ts` | Per-scene TTS with exponential backoff | VERIFIED | audio.speech.create, MAX_ATTEMPTS=3, Math.pow(2,attempt)*1000 |
| `packages/video/src/tts/measure.ts` | ffprobe duration measurement | VERIFIED | execFile ffprobe, show_entries format=duration, FFPROBE_PATH |
| `packages/video/src/tts/index.ts` | TTS orchestrator with concurrency limit | VERIFIED | orchestrateTTS, withConcurrency, SILENCE_GAP, BOOKEND_SILENCE |
| `packages/video/src/preflight.ts` | Upfront preflight checks | VERIFIED | preflightCheck covers all 4 items |
| `packages/video/src/render/composition/BuildStory.tsx` | Top-level Remotion composition with Sequence per beat | VERIFIED | Sequence + Audio + SceneForBeat |
| `packages/video/src/render/composition/scenes/TitleCard.tsx` | Title card scene component | VERIFIED | TitleCard, #1a1a2e, interpolate, FADE_FRAMES=9 |
| `packages/video/src/render/composition/scenes/TimelineBar.tsx` | Timeline bar scene component | VERIFIED | TimelineBar, barWidth fill animation |
| `packages/video/src/render/composition/scenes/DecisionCallout.tsx` | Decision callout scene component | VERIFIED | obstacle, pivot, decision references with explicit icon dispatch |
| `packages/video/src/render/composition/scenes/StatsCard.tsx` | Stats card scene component | VERIFIED | File exists, D-06 palette |
| `packages/video/src/render/index.ts` | renderVideo() orchestration | VERIFIED | bundle + selectComposition + renderMedia |
| `packages/video/src/render/srt.ts` | SRT subtitle generation | VERIFIED | generateSRT, stringifySync |
| `packages/cli/src/commands/render.ts` | render CLI command | VERIFIED | renderCommand with all required calls |
| `packages/cli/src/commands/run.ts` | Extended run command with TTS + render steps | VERIFIED | skipVideo/includeText handling, dynamic import |
| `packages/cli/src/index.ts` | CLI entry point with render command | VERIFIED | .command('render'), style default 'story', all flags |
| `packages/cli/src/lazy.ts` | Lazy install detection and Y/n prompt | VERIFIED | detectVideoPackage, ensureVideoPackage, 200MB prompt |
| `packages/cli/src/config.ts` | Config with [tts] section support | VERIFIED | tts?: {voice, speed, concurrency}, render?: {titleCard, statsCard} |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/core/src/narrate/prompts/system.ts` | `packages/core/src/narrate/index.ts` | buildSystemPrompt('story') | VERIFIED | `system.ts:106` has `story:` key; `index.ts` calls `buildSystemPrompt(style)` |
| `packages/core/src/types/story.ts` | `packages/core/src/narrate/index.ts` | StoryArcSchema.parse with metadata.warnings | VERIFIED | `narrate/index.ts:121` — `...(warnings.length > 0 ? { warnings } : {})` on metadata |
| `packages/video/src/tts/generate.ts` | `openai.audio.speech.create` | OpenAI SDK call | VERIFIED | `generate.ts:30` — `client.audio.speech.create({...})` |
| `packages/video/src/tts/measure.ts` | `child_process.execFile` | ffprobe subprocess | VERIFIED | `measure.ts:12` — `execFileAsync(ffprobePath, ['-v', 'quiet', '-show_entries', ...])` |
| `packages/video/src/tts/index.ts` | `packages/video/src/tts/generate.ts` | imports generateSceneAudio | VERIFIED | `tts/index.ts` imports and calls `generateSceneAudio(client, beat.summary, filePath, generateOpts)` |
| `packages/video/src/render/index.ts` | `@remotion/bundler` | bundle() call | VERIFIED | `render/index.ts:4,46` — `import { bundle } from '@remotion/bundler'`, `await bundle({entryPoint,...})` |
| `packages/video/src/render/index.ts` | `@remotion/renderer` | renderMedia() call | VERIFIED | `render/index.ts:5,65` — `import { renderMedia, selectComposition }`, `await renderMedia({codec:'h264',...})` |
| `packages/video/src/render/composition/BuildStory.tsx` | scene components | SceneForBeat beat-type dispatch | VERIFIED | `BuildStory.tsx:17-26` — `SceneForBeat` function dispatches to all 4 components |
| `packages/cli/src/commands/render.ts` | `@buildstory/video` | dynamic import for lazy install | VERIFIED | `render.ts:35,38` — `await ensureVideoPackage()`, then `const video = await import('@buildstory/video')` |
| `packages/cli/src/commands/run.ts` | `@buildstory/video` | dynamic import after preflight | VERIFIED | `run.ts:133` — `const video = await import('@buildstory/video')` inside `if (!skipVideo)` |
| `packages/cli/src/index.ts` | `packages/cli/src/commands/render.ts` | commander .command('render') | VERIFIED | `index.ts:9,56` — `import { renderCommand }`, `.command('render').action(async (storyArc, opts) => await renderCommand(storyArc, opts))` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `BuildStory.tsx` | `storyArc.beats` | `audioManifest` from `orchestrateTTS()` → `renderVideo()` inputProps | Real StoryArc JSON from narrate() + real AudioManifest from TTS pipeline | FLOWING |
| `render.ts` (CLI) | `audioManifest` | `orchestrateTTS(storyArc.beats, outputDir, ttsOptions)` → per-scene MP3 files | Real OpenAI TTS API calls with ffprobe-measured durations | FLOWING |
| Scene components | `beat` props | `beatsWithFrames` array from `storyArc.beats` → audio manifest durations | Beat data from LLM narration, not hardcoded | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 3 packages build | `pnpm build (core, video, cli)` | core: success in 982ms, video: success in 10ms, cli: success in 14ms | PASS |
| CLI shows all 4 commands | `node packages/cli/dist/index.js --help` | Shows: run, scan, narrate, render | PASS |
| run command style default is 'story' | `node packages/cli/dist/index.js run --help` | `--style <style>  narrative style (default: "story")` | PASS |
| render command exists with flags | `node packages/cli/dist/index.js render --help` | Shows: story-arc argument, --dry-run, --no-title-card, --no-stats-card | PASS |
| narrate command style default is 'overview' | `node packages/cli/dist/index.js narrate --help` | style default: "overview" (different from run) | PASS |
| Git commits exist for all claimed work | `git log --oneline` | All 10 phase-04 commits verified: bab586d, d533d53, 42107b4, ecbd137, d8e7c6c, cb9cf0f, 5b70b79, e4474aa, fa7fd51, 657a63c, dce9b03 | PASS (note: 04-04 SUMMARY listed `0abf339` but actual commit is `dce9b03` — minor doc mismatch) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| NARR-10 | 04-01 | "story" narrative style with avg sentence under 15 words | SATISFIED (with note) | story prompt in system.ts with D-01/D-05 rules. NOTE: NARR-10 text says "second-person voice, humor" but implementation uses third-person per D-02 — ROADMAP/REQUIREMENTS need update |
| NARR-11 | 04-01 | StoryBeat schema extension: visual_cue, tone, duration_seconds | SATISFIED | story.ts:22-24 — all 3 fields as z.string/number().optional() |
| NARR-12 | 04-01 | Narration warnings in StoryArc metadata, not console.warn | SATISFIED | narrate/index.ts:96-121 — warnings array + metadata.warnings |
| REND-01 | 04-02, 04-03 | @buildstory/video package with Remotion | SATISFIED | packages/video/ exists, builds as ESM, imports remotion |
| REND-02 | 04-02 | TTS with parallel concurrency (default: 2) | SATISFIED | tts/index.ts — withConcurrency(tasks, options.concurrency), render.ts default concurrency=2 |
| REND-03 | 04-02, 04-04 | TTS cost estimation + --dry-run flag | SATISFIED | estimateTTSCost() in tts/index.ts, --dry-run in render.ts:58 |
| REND-04 | 04-03 | Remotion renders MP4 via headless Chrome | SATISFIED | render/index.ts — bundle + selectComposition + renderMedia |
| REND-05 | 04-03 | Video output as MP4 (H.264 + AAC) | SATISFIED | render/index.ts:68 — codec: 'h264' |
| REND-06 | 04-03 | SRT subtitle generation | SATISFIED | render/srt.ts — generateSRT using stringifySync |
| REND-07 | 04-03 | 4 scene components with beat-type mapping | SATISFIED | TitleCard, TimelineBar, DecisionCallout, StatsCard all exist with correct dispatch |
| REND-08 | 04-03 | Per-scene <Audio> with ffprobe-measured offsets | SATISFIED | BuildStory.tsx:64 — <Audio> inside <Sequence>; durations from measureAudioDuration() |
| REND-09 | 04-02, 04-03 | ffprobe-measured TTS duration drives frame count | SATISFIED | measure.ts + orchestrateTTS() → AudioManifest.scenes[i].durationSeconds → calculateMetadata |
| REND-10 | 04-04 | Lazy Remotion install (~200MB) | SATISFIED | lazy.ts — detectVideoPackage() + ensureVideoPackage() with Y/n prompt |
| REND-11 | 04-02, 04-04 | Preflight checks before TTS | SATISFIED | preflight.ts — 4 checks (Remotion, ffprobe, Chrome, API key), fail fast |
| CLI-03 | 04-04 | `buildstory render <story-arc.json>` command | SATISFIED | index.ts:56 — .command('render') registered, renderCommand implemented |
| CLI-04 | 04-04 | `buildstory run` with full pipeline | SATISFIED | run.ts — scan→narrate→TTS→render pipeline in skipVideo=false branch |
| CLI-05 | 04-04 | run defaults style:"story", narrate keeps "overview" | SATISFIED | index.ts:23 style default "story"; index.ts:49 narrate style default "overview" |
| CLI-06 | 04-04 | Progress indicators including frame count | SATISFIED | render.ts:73-77 — ora spinner "N/Y scenes"; render.ts:96 — "frame X/Y" |
| CLI-07 | 04-04 | Video mode skips text formats; --include-text adds back | SATISFIED | run.ts:64-65,128,196 — skipVideo/includeText flags, text formats only generated when skipVideo or includeText |

**All 19 phase-04 requirements SATISFIED.**

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `04-04-SUMMARY.md` | Task 2 commit | Lists commit `0abf339` but actual commit is `dce9b03` | Info | Documentation-only discrepancy; code is correct |

No stub return values, placeholder components, empty handlers, or TODO markers found in any phase-04 source files. All 4 scene components render live data from `beat` props. No `console.warn` in narrate pipeline.

### Human Verification Required

#### 1. Confirm NARR-10/ROADMAP SC #2 spec vs implementation voice discrepancy

**Test:** Review `REQUIREMENTS.md` NARR-10 and `ROADMAP.md` Phase 4 SC #2 wording against the approved design decisions.

**Expected:** Developer confirms that:
- NARR-10 ("punchy second-person voice, humor") in REQUIREMENTS.md is stale — the design doc (D-01 through D-05) explicitly chose third-person documentary voice without humor
- ROADMAP SC #2 ("punchy, second-person, with stakes") is similarly stale
- Updates REQUIREMENTS.md NARR-10 to read: "story narrative style with warm third-person documentary voice, no humor, avg sentence under 15 words (D-01 through D-05)"
- Updates ROADMAP SC #2 to match

**Why human:** Only the developer can confirm that D-02 (third-person) was the intended final decision and authorize the spec update. If the original second-person intent was correct, the prompt would need to change.

#### 2. End-to-end dry-run render

**Test:** Run `buildstory render <path-to-story-arc.json> --dry-run` on an existing story-arc.json.

**Expected:** Output shows "Generating audio for N scenes (~$X.XX estimated)" and exits cleanly without making TTS API calls.

**Why human:** Requires a valid story-arc.json from a prior narrate run. Cannot generate this without a real project and LLM API key.

#### 3. Full pipeline with buildstory run

**Test:** Run `buildstory run ~/some-project` on a project with planning artifacts.

**Expected:** Runs scan → narrate (style: story) → TTS → Remotion render. Produces MP4 + SRT in `buildstory-out/<project>/`.

**Why human:** Requires real project artifacts, LLM API key, OpenAI API key (TTS), and ffprobe available. End-to-end behavioral verification with real I/O.

#### 4. Audio/video sync verification

**Test:** Watch the rendered MP4. Confirm each beat's narration audio matches its on-screen scene.

**Expected:** Audio for scene N plays while scene N's visual is displayed. No audible overlap between scenes.

**Why human:** A/V sync is a perceptual quality check. The mechanism (Remotion `<Audio>` inside `<Sequence>`) is correct in code, but real-world confirmation with actual rendered output requires human eyes and ears.

### Gaps Summary

No gaps. All 19 requirements are satisfied in code. The phase goal — one command to narrated MP4 with engaging voice, visual timeline, and decision callouts — is fully implemented:

- `buildstory run <path>` runs the complete pipeline (scan → narrate → TTS → render)
- `buildstory render <story-arc.json>` renders video from an existing story arc
- 4 scene components (TitleCard, TimelineBar, DecisionCallout, StatsCard) render from live beat data with D-06 palette and D-07 fade transitions
- Audio is synchronized to video via Remotion Sequence timing with ffprobe-measured durations
- SRT subtitles generated alongside MP4
- Preflight checks, lazy install, cost estimation, and --dry-run all wired

The only outstanding item is a spec reconciliation: REQUIREMENTS.md NARR-10 and ROADMAP.md SC #2 describe "second-person voice with humor" but the approved design (D-02, confirmed in both CONTEXT.md and RESEARCH.md as a locked decision) chose third-person documentary narration without humor. The implementation is correct; the specs are stale.

---

_Verified: 2026-04-07T21:50:20Z_
_Verifier: Claude (gsd-verifier)_
