# Phase 4: Renderer - Research

**Researched:** 2026-04-07
**Domain:** Remotion video rendering, OpenAI TTS, ffprobe audio measurement, SRT generation, `@buildstory/video` package scaffold
**Confidence:** HIGH (verified against npm registry, Remotion docs, and existing codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Warm documentary tone — friendly and informative, not trying to be funny. Stakes and tension carry interest, not jokes. Think Kurzgesagt, not Fireship.
- **D-02:** Third-person narration, NOT second-person "you" — the narrator tells the story about the builder, not to the builder. "BuildStory began as a simple idea" for project-level, "John decided to rip out the ORM" for specific decisions.
- **D-03:** Mix project-as-protagonist and developer-name — project name for big-picture moments, git author name for specific decisions. Falls back to project name if no git author data.
- **D-04:** Minimal humor — warmth and personality yes, but no jokes or sarcasm. The content's stakes carry the interest. No wry observations, no pop culture references.
- **D-05:** Average sentence length under 15 words. One idea per beat. Punchy but not breathless.
- **D-06:** Ship with dark navy (#1a1a2e) + warm red (#e94560) palette from design doc. Text: #eaeaea (off-white). Iterate after seeing real output.
- **D-07:** Minimal motion in v1 — fade in/out between scenes, timeline bar fills left-to-right, no fancy transitions. ~300ms ease-in-out. Ship fast, polish later.
- **D-08:** TitleCard and StatsCard are auto-inserted by default but configurable — `--no-title-card` and `--no-stats-card` CLI flags to disable.
- **D-09:** 4 scene components: TitleCard, TimelineBar, DecisionCallout, StatsCard with beat-type mapping. Unmapped beat types fall back to TimelineBar.
- **D-10:** Prompt Y/n for `@buildstory/video` lazy install on first `buildstory render` — "Video rendering requires ~200MB of dependencies. Install now? [Y/n]". Power users who only want text output never need to install.
- **D-11:** Headless Chrome missing → error with install guide: "Headless Chrome not found. Install: npx puppeteer browsers install chrome". No auto-install.
- **D-12:** All preflight checks upfront before any API calls — Remotion installed, Chrome available, API keys present (OPENAI_API_KEY for TTS), ffprobe available. Single report listing all missing items. Fail fast, no partial work.
- **D-13:** OpenAI `nova` voice at 1.15x speed as default. Configurable via `buildstory.toml` (`[tts] voice = "nova"`, `[tts] speed = 1.15`).
- **D-14:** Global speed only — same speed for all scenes. No per-beat-type pacing variations in v1.
- **D-15:** 0.3s silence gaps between scenes + 1s bookend silence (1s before first scene, 1s after last scene). Feels polished, not abrupt.
- **D-16:** TTS cost estimate printed before API calls: "Generating audio for N scenes (~$X.XX estimated)". `--dry-run` flag to preview costs without calling APIs.
- **D-17:** New `@buildstory/video` package in `packages/video/`. Owns Remotion, TTS, and all rendering I/O. Core stays pure.
- **D-18:** `buildstory run` defaults to style:"story"; `buildstory narrate` keeps style:"overview" as default.
- **D-19:** Video output as MP4 (H.264 + AAC) + SRT subtitle file. Output to `./buildstory-out/<project-name>/`.
- **D-20:** Remotion renders via headless Chrome. `npx remotion render` under the hood (or programmatic `renderMedia()`).
- **D-21:** Per-scene `<Audio>` components in Remotion with ffprobe-measured `startFrom` offsets. No pre-merge audio step.
- **D-22:** ffprobe-measured TTS duration drives frame count (never estimated duration).
- **D-23:** TTS rate limit handling: retry with exponential backoff (3 attempts, 2s/4s/8s).
- **D-24:** StoryBeat schema extension: optional `visual_cue`, `tone`, `duration_seconds` fields.
- **D-25:** Remotion `onProgress` callback wired to ora spinner showing frame count: `[6/6] Rendering video... 45% (frame 270/600)`.
- **D-26:** `--skip-video` flag on `buildstory run` for text-only output. Video mode skips text format generation; `--include-text` flag to add them back.

### Claude's Discretion

- Exact system prompt wording for the "story" narrative style
- Font choice (Inter or system sans-serif)
- Remotion project structure within `packages/video/`
- How to wire lazy install detection (check for package.json, node_modules, or import attempt)
- ffprobe/ffmpeg-static integration approach
- TTS chunking strategy (4096 char limit per OpenAI TTS request)
- Error message wording for preflight failures
- Exact Remotion composition structure (Sequence nesting, timing math)

### Deferred Ideas (OUT OF SCOPE)

- Per-beat-type TTS pacing (slower for obstacles, faster for results) — v2 polish
- Background music mixing — v2 (ADV-07)
- Custom visual themes/color schemes — v2 (ADV-05)
- Live Build Radio (real-time narrated audio) — v2 (ADV-08)
- GitHub Wrapped / Build Wrapped HTML page — v2 (ADV-09)
- Remotion cloud rendering via Lambda — v2 (ADV-10)
- ElevenLabs and Piper TTS engines — v2 (TTS-01, TTS-02)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NARR-10 | "story" narrative style with warm third-person documentary voice, avg sentence under 15 words | New STYLE_PROMPTS["story"] case in system.ts; voice rules D-01 through D-05 |
| NARR-11 | StoryBeat schema extension: optional visual_cue, tone, duration_seconds fields | Zod `.optional()` on StoryBeatSchema; backward-compatible add |
| NARR-12 | Narration warnings returned in StoryArc metadata (not console.warn) — core stays pure | Add `warnings?: string[]` to StoryArc metadata schema |
| REND-01 | Video composition via Remotion in new `@buildstory/video` package | Remotion 4.0.446 — `remotion`, `@remotion/renderer`, `@remotion/bundler`, `react`, `react-dom` |
| REND-02 | TTS audio generation via OpenAI TTS API with parallel concurrency (default: 2) | `openai.audio.speech.create()` already in dep tree; Promise.allSettled with concurrency limiter |
| REND-03 | TTS cost estimation printed before API calls; --dry-run flag | ~$0.015/1000 chars for tts-1 |
| REND-04 | Remotion renders MP4 via headless Chrome — no custom canvas+FFmpeg pipeline | `renderMedia()` from `@remotion/renderer`; Chrome 146 confirmed available |
| REND-05 | Video output as MP4 (H.264 + AAC) | `codec: 'h264'` in `renderMedia()` |
| REND-06 | Subtitle generation as SRT file from narration text | `subtitle` npm package v4.2.2; or hand-rolled — SRT format is trivial |
| REND-07 | 4 scene components: TitleCard, TimelineBar, DecisionCallout, StatsCard with beat-type mapping | React components with `useCurrentFrame()` + `useVideoConfig()` + `interpolate()` from "remotion" |
| REND-08 | Per-scene audio via Remotion `<Audio>` components with ffprobe-measured startFrom offsets | `<Audio>` wrapped in `<Sequence from={N}>` per scene; timing cascades |
| REND-09 | ffprobe-measured TTS duration drives frame count (not estimated duration) | system ffprobe 7.1.2 available; `child_process.spawn` with `-show_entries format=duration` |
| REND-10 | Lazy Remotion install — @buildstory/video installed on first `render` use (~200MB) | Dynamic `import()` + try/catch detection; `pnpm --filter @buildstory/video install` |
| REND-11 | Preflight checks before TTS: verify Remotion installed, headless Chrome available, API keys present | Explicit check sequence: import attempt, `which google-chrome`, env var presence |
| CLI-03 | `buildstory render <story-arc.json>` command outputs MP4 + SRT | New `render.ts` command file in `packages/cli/src/commands/` |
| CLI-04 | `buildstory run <paths>` command runs full pipeline (scan → narrate → TTS → render) | Extend `run.ts` — add TTS + render steps after narrate |
| CLI-05 | `run` defaults to style:"story"; `narrate` keeps style:"overview" | Change `--style` default in `run` command in `index.ts` |
| CLI-06 | Progress indicators including Remotion render frame count | `onProgress` callback → ora spinner update |
| CLI-07 | Video mode skips text format generation; --include-text flag to add them back | Conditional format step in `run.ts` based on `--skip-video` / `--include-text` flags |
</phase_requirements>

---

## Summary

Phase 4 delivers the full video pipeline: prompt engineering fixes the narrative voice, OpenAI TTS generates per-scene audio, and Remotion renders the final MP4. The implementation spans three workstreams: (1) core type extensions and a new "story" system prompt, (2) a new `@buildstory/video` package owning TTS orchestration and Remotion rendering, and (3) CLI extensions adding `buildstory render` and updating `buildstory run`.

The most technically involved work is the Remotion integration. The render flow is: `bundle()` (webpack bundles the React composition) → `selectComposition()` (resolves metadata) → `renderMedia()` (drives headless Chrome frame-by-frame, calls `onProgress`). Audio sync is achieved by wrapping each `<Audio src={sceneAudioFile}>` in a `<Sequence from={cumulativeFrame}>` so timing cascades correctly without pre-merging audio files.

The existing codebase is clean and well-structured. The ESLint boundary (core cannot import fs/process/config) is already enforced. The pattern to follow: `@buildstory/video` imports types from `@buildstory/core`, but core never imports from video. The CLI reads config, creates providers, calls `@buildstory/video` functions for TTS and render — the same delegation pattern as phases 1-3.

**Primary recommendation:** Build workstream 1 (core type changes + "story" prompt) first — it unblocks workstreams 2 and 3 and can be tested independently. Then build TTS orchestration, then Remotion composition, then wire the CLI.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| remotion | 4.0.446 | Video composition framework (React-based) | Locked decision D-20; replaces custom canvas+FFmpeg |
| @remotion/renderer | 4.0.446 | Server-side `renderMedia()`, `selectComposition()` | Required for programmatic render from Node.js |
| @remotion/bundler | 4.0.446 | `bundle()` — Webpack bundle of Remotion entry point | Required prerequisite for `renderMedia()` |
| @remotion/cli | 4.0.446 | Optional: npx remotion render fallback | Included for dev studio; optional for prod render |
| react | 19.2.4 | Peer dep for Remotion | Remotion peer dep: `>=16.8.0`; use latest stable |
| react-dom | 19.2.4 | Peer dep for Remotion | Required alongside react |
| openai | 6.33.0 | TTS audio generation | Already in `@buildstory/core` deps; use same version |
| subtitle | 4.2.2 | SRT file generation | TypeScript-native, handles HH:MM:SS,mmm formatting |
| ffmpeg-static | 5.3.0 | Bundled FFmpeg/ffprobe binary | Zero-config default; `FFPROBE_PATH` env override |

[VERIFIED: npm registry — all versions confirmed 2026-04-07]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/react | 19.x | TypeScript types for React | dev dep in `packages/video/` |
| @types/react-dom | 19.x | TypeScript types for react-dom | dev dep in `packages/video/` |

### All Remotion packages MUST be pinned to the same version
[CITED: https://www.remotion.dev/docs/version-mismatch]

Remotion enforces version consistency across all `@remotion/*` packages. A version mismatch causes cryptic runtime errors. Pin without `^` in `packages/video/package.json`:
```json
{
  "dependencies": {
    "remotion": "4.0.446",
    "@remotion/renderer": "4.0.446",
    "@remotion/bundler": "4.0.446"
  }
}
```

### Installation for `packages/video/`
```bash
pnpm --filter @buildstory/video add remotion@4.0.446 @remotion/renderer@4.0.446 @remotion/bundler@4.0.446 react@19.2.4 react-dom@19.2.4 subtitle@4.2.2 ffmpeg-static@5.3.0
pnpm --filter @buildstory/video add -D @types/react@19 @types/react-dom@19
```

The `openai` package is already a dep of `@buildstory/core` but `@buildstory/video` must install it separately (no phantom deps in pnpm workspaces). It cannot import openai from core.

---

## Architecture Patterns

### Recommended Package Structure

```
packages/video/
├── package.json              # @buildstory/video — peerDeps: @buildstory/core
├── tsconfig.json             # extends ../../tsconfig.base.json
├── tsup.config.ts            # ESM output only (Remotion is ESM)
├── src/
│   ├── index.ts              # public API: generateAudio(), renderVideo(), preflightCheck()
│   ├── preflight.ts          # preflight checks (Remotion, Chrome, API key, ffprobe)
│   ├── tts/
│   │   ├── index.ts          # orchestrateTTS() — entry point
│   │   ├── generate.ts       # per-scene TTS call + exponential backoff
│   │   ├── measure.ts        # ffprobe duration measurement
│   │   └── types.ts          # AudioManifest, SceneAudio types
│   ├── render/
│   │   ├── index.ts          # renderVideo() — bundle + selectComposition + renderMedia
│   │   ├── composition/
│   │   │   ├── Root.tsx      # registerRoot() + <Composition> registration
│   │   │   ├── index.ts      # entry point (calls registerRoot)
│   │   │   ├── BuildStory.tsx # top-level composition: series of <Sequence> per beat
│   │   │   └── scenes/
│   │   │       ├── TitleCard.tsx
│   │   │       ├── TimelineBar.tsx
│   │   │       ├── DecisionCallout.tsx
│   │   │       └── StatsCard.tsx
│   │   └── srt.ts            # generateSRT() from beat array + durations
│   └── lazy.ts               # detectInstalled() + promptInstall() logic
```

### Pattern 1: Programmatic Remotion Render

**What:** Three-step async flow using `@remotion/bundler` + `@remotion/renderer`
**When to use:** Always — this is the only programmatic render path

```typescript
// Source: https://www.remotion.dev/docs/ssr-node
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import path from 'node:path'

export async function renderVideo(
  storyArc: StoryArc,
  audioManifest: AudioManifest,
  outputPath: string,
  onProgress: (progress: RenderProgress) => void,
) {
  // Step 1: Webpack-bundle the Remotion entry point
  const bundleLocation = await bundle({
    entryPoint: path.resolve('./src/render/composition/index.ts'),
    webpackOverride: (config) => config,
  })

  const inputProps = { storyArc, audioManifest }

  // Step 2: Resolve composition metadata (durationInFrames computed from inputProps)
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'BuildStory',
    inputProps,
  })

  // Step 3: Render MP4
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    onProgress: ({ renderedFrames, progress }) => {
      onProgress({ renderedFrames, totalFrames: composition.durationInFrames, progress })
    },
  })
}
```

Key note: `bundle()` runs Webpack — it is slow (~5-10s). Bundle once per render call; do not call it in a loop. [CITED: https://www.remotion.dev/docs/bundle]

### Pattern 2: Scene Timing With Nested Sequences

**What:** Each beat is a `<Sequence>` at a cumulative frame offset; audio lives inside the sequence
**When to use:** All multi-beat compositions

```tsx
// Source: https://www.remotion.dev/docs/sequence + https://www.remotion.dev/docs/media/audio
import { Sequence, AbsoluteFill } from 'remotion'
import { Audio } from '@remotion/media'  // Audio is in @remotion/media or remotion

// Timing cascades: Audio inside Sequence starts at Sequence's 'from'
// No manual frame offset math needed for the Audio component.
const BuildStoryComposition: React.FC<{ beats: BeatWithFrames[]; audioManifest: AudioManifest }> = ({ beats, audioManifest }) => {
  let cumulativeFrame = 0

  return (
    <AbsoluteFill>
      {beats.map((beat, i) => {
        const startFrame = cumulativeFrame
        const frames = beat.durationInFrames
        cumulativeFrame += frames
        return (
          <Sequence key={beat.id} from={startFrame} durationInFrames={frames}>
            <SceneForBeat beat={beat} />
            <Audio src={audioManifest.scenes[i]!.filePath} />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
```

Critical: `durationInFrames` for each scene must come from ffprobe-measured audio duration, not estimated. Convert seconds to frames: `Math.ceil(durationSeconds * fps)`. [CITED: design doc D-22]

### Pattern 3: TTS Orchestration With Concurrency

**What:** Generate per-scene MP3 files in parallel with a concurrency limit, then measure with ffprobe
**When to use:** TTS step before rendering

```typescript
// Concurrency limiter — avoid overwhelming OpenAI TTS rate limits
async function withConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = []
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = tasks.slice(i, i + limit).map(fn => fn())
    results.push(...await Promise.all(batch))
  }
  return results
}

// TTS with exponential backoff (D-23)
async function generateSceneAudio(text: string, outputPath: string, opts: TTSOptions): Promise<void> {
  const MAX_ATTEMPTS = 3
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await openai.audio.speech.create({
        model: 'tts-1',
        voice: opts.voice ?? 'nova',
        input: text,
        speed: opts.speed ?? 1.15,
      })
      const buffer = Buffer.from(await response.arrayBuffer())
      await fs.writeFile(outputPath, buffer)
      return
    } catch (err: unknown) {
      if (attempt === MAX_ATTEMPTS) throw err
      if (isRateLimitError(err)) {
        await sleep(Math.pow(2, attempt) * 1000) // 2s, 4s, 8s
      } else {
        throw err
      }
    }
  }
}
```

### Pattern 4: ffprobe Duration Measurement

**What:** Measure actual audio duration from MP3 file using system ffprobe
**When to use:** After every TTS call — never estimate duration

```typescript
// Source: design doc D-22 + verified ffprobe output format
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export async function measureAudioDuration(filePath: string): Promise<number> {
  // Use FFPROBE_PATH env var → ffmpeg-static path → system 'ffprobe'
  const ffprobePath = process.env['FFPROBE_PATH'] ?? getFfmpegStaticPath() ?? 'ffprobe'
  
  const { stdout } = await execFileAsync(ffprobePath, [
    '-v', 'quiet',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    filePath,
  ])
  
  const duration = parseFloat(stdout.trim())
  if (isNaN(duration)) throw new Error(`ffprobe returned non-numeric duration for ${filePath}`)
  return duration  // seconds as float
}
```

System ffprobe 7.1.2 is available at `/usr/bin/ffprobe`. [VERIFIED: environment probe 2026-04-07]

### Pattern 5: Scene Component Structure

**What:** Reusable scene component with fade-in/out and progress animation
**When to use:** All 4 scene types follow this base pattern

```tsx
// Source: https://www.remotion.dev/docs/the-fundamentals + https://www.remotion.dev/docs/interpolate
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'

export const TimelineBar: React.FC<{ beat: StoryBeat; progress: number }> = ({ beat, progress }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  
  // 300ms fade in/out at 30fps = 9 frames
  const FADE_FRAMES = 9
  const opacity = interpolate(
    frame,
    [0, FADE_FRAMES, durationInFrames - FADE_FRAMES, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )
  
  // Timeline bar fills left-to-right
  const barWidth = interpolate(frame, [0, durationInFrames], [0, 100])
  
  return (
    <AbsoluteFill style={{ background: '#1a1a2e', opacity }}>
      {/* bar fills from 0 to 100% width */}
      <div style={{ width: `${barWidth}%`, height: 8, background: '#e94560' }} />
      <p style={{ color: '#eaeaea' }}>{beat.summary}</p>
    </AbsoluteFill>
  )
}
```

### Pattern 6: Lazy Install Detection

**What:** Detect if `@buildstory/video` is installed before attempting to use it
**When to use:** At the start of `buildstory render` command

```typescript
// Detect by attempting dynamic import — most reliable method
export async function detectVideoPackage(): Promise<boolean> {
  try {
    await import('@buildstory/video')
    return true
  } catch {
    return false
  }
}

export async function promptAndInstall(yes: boolean): Promise<void> {
  if (!yes) {
    const answer = await prompt('Video rendering requires ~200MB of dependencies. Install now? [Y/n] ')
    if (answer.toLowerCase() === 'n') {
      process.exit(0)
    }
  }
  spawnSync('pnpm', ['--filter', '@buildstory/video', 'install'], { stdio: 'inherit' })
}
```

[ASSUMED] — the specific pnpm filter command to install an optional workspace package on demand. The pattern of dynamic import for detection is standard; the install trigger command is inferred from pnpm workspace docs.

### Anti-Patterns to Avoid

- **Estimating TTS duration:** Always use ffprobe. Estimated durations cause audio drift that worsens over long videos.
- **Pre-merging audio files:** Remotion `<Audio>` inside `<Sequence>` handles per-scene audio natively. No pre-merge step needed.
- **Calling `bundle()` per scene or per beat:** Bundle once per render call. Webpack bundling is ~5-10s.
- **Importing `@buildstory/core` rendering concerns in core:** The ESLint boundary is enforced. `@buildstory/video` imports from core; core does not import from video.
- **Version mismatches between `remotion` and `@remotion/*` packages:** Must all be `4.0.446` without `^`.
- **Using `console.warn` for narration warnings in core:** NARR-12 requires warnings in `StoryArc.metadata.warnings[]`, not stderr.
- **Forgetting `registerRoot()` in the Remotion entry file:** Without it, `selectComposition()` and `bundle()` cannot find the composition. [CITED: https://www.remotion.dev/docs/brownfield]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SRT timestamp formatting | Custom HH:MM:SS,mmm formatter | `subtitle` npm package | Handles edge cases (>1hr, millisecond rounding) |
| ffprobe duration parsing | Custom ffprobe subprocess wrapper | `child_process.execFile` with `-show_entries format=duration -of csv=p=0` | Simpler than `fluent-ffmpeg` (which STATE.md notes is archived); one-liner output |
| Remotion progress reporting | Custom frame counter | `onProgress` callback from `renderMedia()` | `renderedFrames`, `encodedFrames`, `progress` all provided natively |
| Animation easing | Custom lerp functions | `interpolate()` from `remotion` with `extrapolateLeft: 'clamp'` | Built-in, battle-tested, frame-accurate |
| TTS concurrency | Custom semaphore | Simple batched `Promise.all` with `limit = 2` | Concurrency of 2 is low enough that no library is needed |

**Key insight:** Remotion's React model means "video logic is just component logic" — use React patterns (props, conditional rendering, composition) rather than building a custom scene state machine.

---

## Common Pitfalls

### Pitfall 1: Remotion Version Mismatch
**What goes wrong:** `remotion` and `@remotion/renderer` on different patch versions causes "Remotion: Different versions of Remotion are loaded" crash at render time.
**Why it happens:** pnpm deduplication doesn't guarantee all `@remotion/*` packages resolve to the same version when using `^` semver ranges.
**How to avoid:** Pin all Remotion packages to exactly `4.0.446` (no `^`) in `packages/video/package.json`.
**Warning signs:** `selectComposition()` throws or `bundle()` emits version warnings to stderr.

### Pitfall 2: ESM / CommonJS Conflict in `@buildstory/video`
**What goes wrong:** `@buildstory/core` is ESM-only (remark forces ESM). Remotion is also ESM. The video package must be `"type": "module"` and tsup must output ESM only.
**Why it happens:** tsup defaults to CJS+ESM; if CJS output is generated and tries to `require('remotion')`, it fails because Remotion has no CJS build.
**How to avoid:** `packages/video/package.json` must have `"type": "module"`. `tsup.config.ts` must set `format: ['esm']` only.
**Warning signs:** `ERR_REQUIRE_ESM` at runtime when CLI invokes video package functions.

### Pitfall 3: `registerRoot()` Not Called
**What goes wrong:** `selectComposition()` returns empty compositions array; `renderMedia()` throws "Composition not found".
**Why it happens:** Remotion requires `registerRoot(RemotionRoot)` in the entry point file (`index.ts`). Missing this call is a silent failure during bundle.
**How to avoid:** `packages/video/src/render/composition/index.ts` must call `registerRoot(RemotionRoot)` as its only export.
**Warning signs:** `getCompositions()` returns `[]`; "Composition with id 'BuildStory' was not found" error.

### Pitfall 4: `bundle()` Path Resolution
**What goes wrong:** `bundle({ entryPoint: './src/render/composition/index.ts' })` works in development but fails when the package is built/installed (dist structure changes paths).
**Why it happens:** `bundle()` takes a filesystem path to the *source* TypeScript entry point, not the compiled output. In a built package, `dist/` doesn't contain `.tsx` source files.
**How to avoid:** The `bundle()` call must resolve to the correct path relative to the installed package. Two approaches: (a) include source files in the published package (`"files": ["src/", "dist/"]` in package.json); (b) bundle the Remotion composition separately and reference the bundle path. Since this is a monorepo tool (not published to npm), option (a) is simplest. [ASSUMED] — approach needs verification during execution.
**Warning signs:** `Error: Cannot find entry point` or `Module not found` during `bundle()`.

### Pitfall 5: TTS Text Exceeds 4096 Characters
**What goes wrong:** `openai.audio.speech.create()` silently truncates or throws for inputs over 4096 characters.
**Why it happens:** OpenAI TTS API has a hard 4096-character limit per request. [CITED: https://platform.openai.com/docs/guides/text-to-speech]
**How to avoid:** In `generate.ts`, measure `text.length` before calling the API. If over 3900 chars (safe buffer), split at sentence boundaries. Each chunk becomes a separate MP3; concatenate with ffmpeg or rely on Remotion to sequence them.
**Warning signs:** Audio cuts off mid-sentence; API returns 400 with "input too long".

### Pitfall 6: ffprobe Binary Path
**What goes wrong:** `ffprobe` CLI call fails when the system doesn't have ffprobe in PATH, even though `ffmpeg-static` is installed.
**Why it happens:** `ffmpeg-static` provides an FFmpeg binary, not ffprobe. The companion `ffprobe-static` package provides ffprobe, or use the system binary. On this machine, `/usr/bin/ffprobe` is available. [VERIFIED: environment probe 2026-04-07]
**How to avoid:** Check `FFPROBE_PATH` env var first, then fall back to system `ffprobe`. If neither works and `ffprobe-static` is not installed, fail preflight with actionable message.
**Warning signs:** `ENOENT: no such file or directory, 'ffprobe'` at runtime.

### Pitfall 7: Remotion Composition `durationInFrames` Must Be Integer
**What goes wrong:** If `durationInFrames` is a float (e.g., `150.3`), Remotion throws a validation error.
**Why it happens:** ffprobe returns duration as a float (e.g., `5.017`). `5.017 * 30 = 150.51` — not an integer.
**How to avoid:** Always `Math.ceil(durationSeconds * fps)` when converting audio duration to frames.
**Warning signs:** "durationInFrames must be an integer" error during `selectComposition()`.

### Pitfall 8: NARR-12 Warning Accumulation
**What goes wrong:** Existing code uses `console.warn()` in `narrate()` for hallucinated sourceEventIds. NARR-12 requires warnings in `StoryArc.metadata.warnings[]`.
**Why it happens:** The existing code predates the NARR-12 requirement. The `console.warn` calls in `packages/core/src/narrate/index.ts` need to be replaced.
**How to avoid:** Add `warnings?: string[]` to `StoryArcMetadataSchema`. Accumulate warnings in an array, set on `metadata.warnings`. Remove `console.warn` calls from core.
**Warning signs:** Tests asserting `console.warn` was not called; or CLI consuming warnings incorrectly.

---

## Code Examples

### Remotion Entry Point (required file)
```typescript
// Source: https://www.remotion.dev/docs/brownfield
// packages/video/src/render/composition/index.ts
import { registerRoot } from 'remotion'
import { RemotionRoot } from './Root.js'

registerRoot(RemotionRoot)
```

### Remotion Root Registration
```tsx
// Source: https://www.remotion.dev/docs/the-fundamentals
// packages/video/src/render/composition/Root.tsx
import { Composition } from 'remotion'
import { BuildStoryComposition } from './BuildStory.js'
import type { BuildStoryInputProps } from './types.js'

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="BuildStory"
      component={BuildStoryComposition}
      fps={30}
      width={1920}
      height={1080}
      durationInFrames={300}  // placeholder — overridden by calculateMetadata or inputProps
      defaultProps={{} as BuildStoryInputProps}
    />
  )
}
```

### SRT Generation
```typescript
// Source: https://www.npmjs.com/package/subtitle
import { stringify } from 'subtitle'
import type { SceneAudio } from '../tts/types.js'
import type { StoryBeat } from '@buildstory/core'

export function generateSRT(beats: StoryBeat[], scenes: SceneAudio[]): string {
  const nodes = beats.map((beat, i) => {
    const scene = scenes[i]!
    const startMs = scene.startOffsetSeconds * 1000
    const endMs = startMs + scene.durationSeconds * 1000
    return {
      type: 'cue' as const,
      data: {
        start: startMs,
        end: endMs,
        text: beat.summary,
      },
    }
  })
  return stringify(nodes)
}
```

### Preflight Check Pattern
```typescript
// All checks upfront; collect failures; report once; fail fast (D-12)
export async function preflightCheck(opts: { openaiKey: string }): Promise<void> {
  const failures: string[] = []

  // 1. Remotion installed
  try {
    await import('remotion')
  } catch {
    failures.push('@buildstory/video dependencies not installed. Run: pnpm --filter @buildstory/video install')
  }

  // 2. ffprobe available
  const ffprobePath = process.env['FFPROBE_PATH'] ?? 'ffprobe'
  try {
    await execFileAsync(ffprobePath, ['-version'])
  } catch {
    failures.push(`ffprobe not found. Set FFPROBE_PATH or install FFmpeg: https://ffmpeg.org/download.html`)
  }

  // 3. Headless Chrome
  const chromePath = process.env['PUPPETEER_EXECUTABLE_PATH'] ?? 
    (await which('google-chrome').catch(() => null)) ??
    (await which('chromium').catch(() => null))
  if (!chromePath) {
    failures.push('Headless Chrome not found. Install: npx puppeteer browsers install chrome')
  }

  // 4. OpenAI API key for TTS
  if (!opts.openaiKey) {
    failures.push('OPENAI_API_KEY not set. Required for TTS audio generation.')
  }

  if (failures.length > 0) {
    console.error('\nPreflight check failed:')
    failures.forEach(f => console.error(`  • ${f}`))
    process.exit(1)
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom canvas + FFmpeg renderer | Remotion React-based video | Phase 4 decision (2026-04-06) | Months of work → 1 week; TypeScript, React, battle-tested |
| `fluent-ffmpeg` for video | `child_process.spawn` directly (per STATE.md note) | Phase 1 | fluent-ffmpeg is archived; use spawn for ffprobe |
| All outputs on `buildstory run` | Video mode skips text formats by default; `--include-text` to add back | Phase 4 (D-26) | Cleaner default for video users |

**Deprecated/outdated:**
- `fluent-ffmpeg`: Archived library per STATE.md. Do not use for new code. Use `child_process.execFile` for ffprobe calls.
- Canvas+FFmpeg renderer: Replaced by Remotion per design doc decision.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Lazy install via `pnpm --filter @buildstory/video install` triggers optional workspace package install | Pattern 6 | May need different pnpm command; could require `pnpm install` at workspace root with `--filter` |
| A2 | `bundle()` entryPoint must point to source `.ts` file, not compiled `.js` — source files must be included in package | Pitfall 4 | Render fails at runtime if path resolution breaks; needs a Wave 0 decision on how to structure the package for bundle() |
| A3 | `<Audio>` component is imported from `remotion` (not a separate `@remotion/media` package) | Pattern 2 | Import path must be verified when writing first Remotion component |
| A4 | Cost estimate of ~$0.015/1000 chars for tts-1 model | REND-03 code | Pricing may have changed; check OpenAI pricing page before hardcoding |

---

## Open Questions

1. **`bundle()` entryPoint path resolution in monorepo**
   - What we know: `bundle()` takes a filesystem path to a TypeScript source file; Remotion uses Webpack to bundle it.
   - What's unclear: In a pnpm monorepo where `@buildstory/video` is an installed workspace package, what is the correct way to resolve the absolute path to the Remotion entry point at render time? Using `import.meta.url` + `path.resolve` should work for ESM.
   - Recommendation: Use `new URL('./render/composition/index.ts', import.meta.url).pathname` in `renderVideo()`. Verify this works from the CLI context during Wave 0. Include source files in `packages/video/` (don't `.gitignore` them).

2. **Audio import in Remotion 4**
   - What we know: The `<Audio>` component exists in Remotion; it can be wrapped in `<Sequence>` for timing.
   - What's unclear: Is `<Audio>` exported from `'remotion'` or `'@remotion/media-parser'` or another sub-package in v4.0.446?
   - Recommendation: Verify via `node -e "const r = require('remotion'); console.log(Object.keys(r).filter(k => k.includes('Audio')))"` or reading the Remotion source in node_modules after install.

3. **pnpm optional workspace package lazy install pattern**
   - What we know: D-10 specifies a Y/n prompt and `@buildstory/video` lazy install. The design doc says `pnpm --filter @buildstory/video install`.
   - What's unclear: Whether `@buildstory/video` should be listed as `optionalDependencies` in the CLI's `package.json` or simply not listed at all. Pnpm's `optional` handling may differ from expected behavior.
   - Recommendation: Don't list `@buildstory/video` in CLI's `package.json` at all. Use dynamic `import()` detection. On failure, exec `pnpm add @buildstory/video` (workspace version). This is the simplest approach.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v22.22.0 | — |
| Google Chrome | Remotion headless render | Yes | 146.0.7680.177 at `/usr/bin/google-chrome` | Manual install |
| ffprobe | Audio duration measurement | Yes | 7.1.2 at `/usr/bin/ffprobe` | `ffprobe-static` npm package, or `FFPROBE_PATH` env var |
| Remotion | Video render | Not installed | 4.0.446 on npm | Lazy install on first `render` use |
| pnpm | Package install | Assumed | — | — |

**Missing dependencies with no fallback:**
- None blocking — Chrome and ffprobe are both available on this machine.

**Missing dependencies with fallback:**
- Remotion: Not installed (expected — lazy install on first use per D-10).

---

## Validation Architecture

Validation skipped — `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`.

---

## Security Domain

No new authentication surfaces introduced. This phase adds:
- Reading `OPENAI_API_KEY` from environment (same pattern as existing `ANTHROPIC_API_KEY`)
- Writing files to `./buildstory-out/<project>/` (same pattern as existing output)
- Executing ffprobe subprocess with user-supplied `FFPROBE_PATH` (validate the env var is an absolute path before passing to `execFile`)

No new V2/V3/V4/V6 ASVS concerns beyond what phases 1-3 established.

---

## Sources

### Primary (HIGH confidence)
- npm registry — all package versions verified 2026-04-07 via `npm view <pkg> version`
- [https://www.remotion.dev/docs/ssr-node](https://www.remotion.dev/docs/ssr-node) — `bundle()`, `selectComposition()`, `renderMedia()` workflow
- [https://www.remotion.dev/docs/renderer/render-media](https://www.remotion.dev/docs/renderer/render-media) — `onProgress` callback fields
- [https://www.remotion.dev/docs/brownfield](https://www.remotion.dev/docs/brownfield) — adding Remotion to existing project, `registerRoot()` requirement
- [https://www.remotion.dev/docs/the-fundamentals](https://www.remotion.dev/docs/the-fundamentals) — `useCurrentFrame()`, `useVideoConfig()`, Composition registration
- [https://www.remotion.dev/docs/interpolate](https://www.remotion.dev/docs/interpolate) — fade in/out, progress bar animation
- [https://www.remotion.dev/docs/sequence](https://www.remotion.dev/docs/sequence) — `from`, `durationInFrames`, timing cascade
- [https://www.remotion.dev/docs/media/audio](https://www.remotion.dev/docs/media/audio) — `<Audio>` component props, `from`, `durationInFrames`
- [https://platform.openai.com/docs/guides/text-to-speech](https://platform.openai.com/docs/guides/text-to-speech) — 4096 char limit, `nova` voice, `speed` param
- Existing codebase: `packages/core/src/`, `packages/cli/src/` — verified structure and patterns

### Secondary (MEDIUM confidence)
- [https://www.remotion.dev/docs/bundle](https://www.remotion.dev/docs/bundle) — `bundle()` anti-pattern (call once, not per render)
- [https://www.remotion.dev/docs/version-mismatch](https://www.remotion.dev/docs/version-mismatch) — Remotion version pinning requirement
- WebSearch: Remotion `@remotion/bundler` required for SSR

### Tertiary (LOW confidence)
- A3: `<Audio>` import path from `remotion` vs sub-package — unverified

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified on npm registry
- Architecture patterns: HIGH — verified against Remotion official docs
- Pitfalls: HIGH (most); MEDIUM (pitfall 4 — bundle path resolution, needs Wave 0 verification)
- Environment availability: HIGH — directly probed via shell commands

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (Remotion releases frequently; re-check if >30 days pass)
