# Stack Research

**Domain:** TypeScript monorepo toolkit — planning artifact scanning, LLM narration, video rendering
**Researched:** 2026-04-05
**Confidence:** HIGH (all versions confirmed via npm registry; rationale confirmed via official docs and cross-source verification)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | 6.0.2 | Language | Already decided. TS 5.x+ strict mode gives the typed pipeline contracts needed between scan/narrate/render. v6 is current; no reason to pin below latest. |
| pnpm workspaces | (pnpm 10.x) | Monorepo package manager | Enforces strict dependency isolation between packages (no phantom deps), `workspace:` protocol for cross-package references, fastest install times. The project decision is already locked. |
| Node.js | 22 LTS | Runtime | Node 22 is the current LTS. All dependencies (sharp, canvas, fluent-ffmpeg) require Node 18+. Node 22 gives the stable `fs.glob` API and native `.env` file loading. |
| tsup | 8.5.1 | Library bundler (per package) | Wraps esbuild. Zero-config CJS+ESM dual output with `.d.ts` generation in one command. The de-facto standard for TS library packages as of 2025. Generates declaration files with `--dts`. Faster than tsc-only or rollup. |
| Vitest | 4.1.2 | Test runner | Native TypeScript and ESM without Babel/ts-jest setup. 10-20x faster cold starts than Jest in monorepos. Zero configuration for TS projects. The standard choice for new greenfield TS projects in 2025. |

### Markdown Parsing

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| remark | 15.0.1 | Markdown processor | Unified ecosystem: parses to mdast (Markdown AST), transforms via plugins. Superior to marked/markdown-it for extraction use cases — exposes full syntax tree with positional info, heading hierarchy, cross-references. Use `remark-parse` (11.0.0) as the parser plugin. |
| remark-parse | 11.0.0 | remark parser plugin | The standard entry point into the unified/remark pipeline. |
| remark-frontmatter | (latest) | YAML/TOML frontmatter in markdown | Many planning artifacts (ADRs, docs) use frontmatter for metadata. |
| gray-matter | 4.0.3 | Frontmatter extraction fallback | Faster than a full unified parse when only metadata is needed. Use when scanning file headers before deciding whether to deep-parse. |
| mdast-util-from-markdown | 2.0.3 | Low-level mdast builder | Use when building custom extractors without the full remark plugin chain — faster for targeted extraction. |

### Git Integration

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| simple-git | 3.33.0 | Git history extraction | 6.4M weekly downloads vs isomorphic-git's 628K. Thin wrapper over the git CLI — no pure-JS reimplementation overhead, no feature gaps. Supports `log`, `blame`, `tags`, `branch`, structured output. Bundled TypeScript types since v3. The correct choice when git is guaranteed to be installed (it is — it's a dev tool). |

### LLM Integration

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @anthropic-ai/sdk | 0.82.0 | Anthropic Claude API client | Official SDK. Node 18+ required. Full streaming support. Actively maintained (0.82 released 3 days before research date). |
| openai | 6.33.0 | OpenAI API client (chat + TTS) | Official SDK v6. Used for both chat completions (narrator) and `audio.speech.create` (TTS). Single SDK covers both use cases. |

### Frame Generation (2D)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| canvas | 3.2.3 | 2D frame drawing | Cairo-backed HTML5 Canvas API for Node. The standard choice for programmatic 2D graphics (text, shapes, timelines, title cards). node-canvas v3 ships with TypeScript types. Required for custom frame layouts that need `fillText`, `drawImage`, bezier curves. |
| sharp | 0.34.5 | Image composition and export | Libvips-backed. Use for image resizing, compositing multiple layers, and converting canvas output to PNG/JPEG before handing to FFmpeg. Bundled TypeScript types since v0.32. Do not use sharp for drawing — use it as the final output stage after canvas rendering. |

### TTS

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| openai (audio.speech) | 6.33.0 | TTS for v1 | Already in the dependency tree as the LLM client. `openai.audio.speech.create()` supports `tts-1`, `tts-1-hd`, and `gpt-4o-mini-tts`. Mp3/opus/wav output. 4096 char limit per request — scenes must be chunked. No extra dependency needed. |

### Video Assembly

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| fluent-ffmpeg | 2.1.3 | FFmpeg command builder | Fluent API that abstracts complex FFmpeg flags into a chainable JS interface. Frame stitching, audio mixing, subtitle embedding, fade transitions are all first-class operations. @types/fluent-ffmpeg (2.1.28) for TypeScript definitions. |
| ffmpeg-static | 5.3.0 | Bundled FFmpeg binary | Provides a static FFmpeg 6.1.1 binary for macOS/Linux/Windows. `require('ffmpeg-static')` returns the binary path. Use as the default — no system FFmpeg install required. Allow override via `FFMPEG_PATH` env var for users who want their own version. |

### Configuration

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| smol-toml | 1.6.1 | TOML config parsing (`buildstory.toml`) | Most downloaded TOML parser on npm. TOML 1.1.0 compliant. Pure TypeScript, no native bindings, tiny footprint. Correct choice for `buildstory.toml` parsing. Prefer over `@iarna/toml` (not updated recently) or `toml` (only supports TOML 0.4.0). |

### CLI Wrapper

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| commander | 14.0.3 | CLI argument parsing | 35M+ weekly downloads. Minimal, idiomatic API. Excellent TypeScript support. The right fit for `buildstory scan|narrate|render|run` — simple subcommand pattern with no plugin architecture needed. Yargs adds unnecessary complexity for this scope. Clipanion is excellent but brings class-based overhead for a thin wrapper. |

### Validation

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| zod | 4.3.6 | Runtime schema validation | Zod v4 is 14x faster than v3, 57% smaller. Use for validating: LLM JSON outputs (narrative script, timeline), config file contents after TOML parse, public API inputs to `@buildstory/core`. The TypeScript-first choice; no alternative is competitive in the TS ecosystem as of 2025. |

### File System

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| fast-glob | 3.3.3 | Pattern-based file discovery | 10-20% faster than node-glob on deep trees. Stream and Promise APIs. TypeScript types bundled. Use for the artifact scanner's include/exclude pattern matching. |

### Monorepo Release Management

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @changesets/cli | 2.30.0 | Versioning and changelog generation | The pnpm-recommended tool for monorepo versioning. Integrates with `pnpm changeset` commands. Keeps package versions in sync across `@buildstory/core`, `buildstory` CLI, and future packages. |

---

## Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint 10 | Linting | Use `@typescript-eslint/eslint-plugin` with flat config format (ESLint 10 default). No Prettier conflicts with `eslint-config-prettier`. |
| Prettier 3 | Formatting | Standard. Run via `prettier --write`. Do not combine formatting rules into ESLint. |
| Turbo 2.9 | Task orchestration | Optional but recommended for `build`, `test`, `lint` pipeline across packages with caching. pnpm workspaces alone work for small monorepos; Turbo becomes valuable once CI matters. |

---

## Installation

```bash
# Root workspace devDependencies
pnpm add -D -w typescript@^6 tsup@^8 vitest@^4 eslint@^10 prettier@^3 @changesets/cli@^2 turbo@^2

# @buildstory/core dependencies
pnpm add --filter @buildstory/core remark@^15 remark-parse@^11 remark-frontmatter gray-matter@^4 mdast-util-from-markdown@^2 simple-git@^3 @anthropic-ai/sdk@^0 openai@^6 canvas@^3 sharp@^0 fluent-ffmpeg@^2 ffmpeg-static@^5 smol-toml@^1 fast-glob@^3 zod@^4

# @buildstory/core devDependencies
pnpm add -D --filter @buildstory/core @types/node @types/fluent-ffmpeg @types/ffmpeg-static

# buildstory CLI dependencies
pnpm add --filter buildstory commander@^14
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| simple-git | isomorphic-git | Only if you need git in a browser environment (not applicable here — this is a CLI tool) |
| canvas (node-canvas) | @napi-rs/canvas | @napi-rs/canvas shows faster benchmarks and zero system dependencies. Viable swap if node-canvas native build causes CI pain. API is identical (HTML5 Canvas). |
| canvas (node-canvas) | skia-canvas | Better text rendering and GPU support. Use if text quality on title cards matters more than setup simplicity. API closely mirrors browser Canvas. |
| commander | clipanion | Use Clipanion if the CLI grows to dozens of commands with complex class hierarchies (Yarn Modern uses it). Overkill for 4 subcommands. |
| remark | markdown-it | markdown-it is faster for HTML rendering, but exposes no syntax tree. Useless for extraction. Don't use for this project. |
| smol-toml | @iarna/toml | @iarna/toml was the previous standard but is not actively maintained. smol-toml is TOML 1.1.0 compliant and the current ecosystem standard. |
| tsup | tsdown | tsdown (from the Rolldown/Vite team) is a tsup-inspired alternative on Rolldown. Worth watching in 2026 but not stable enough yet for production v1 tooling. |
| Vitest | Jest | Only use Jest if migrating an existing Jest test suite. New projects in 2025: always Vitest. |
| ffmpeg-static | System FFmpeg | Allow user override via `FFMPEG_PATH` env var. ffmpeg-static is the zero-config default; system FFmpeg is the escape hatch for users who need codec features not in the static build. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| marked | No AST — returns HTML strings only. Useless for content extraction, heading parsing, cross-reference discovery. | remark + remark-parse |
| markdown-it | Same problem as marked — HTML output, no structured tree. | remark + remark-parse |
| nodegit | Native C++ bindings (libgit2). Build failures are frequent across platforms. Abandoned by many teams. | simple-git |
| @ffmpeg/ffmpeg | WASM-based FFmpeg. Intended for browser environments. Slow, memory-heavy, no benefit in a Node CLI context. | fluent-ffmpeg + ffmpeg-static |
| @iarna/toml | Last release was 2021. Does not support TOML 1.1.0. | smol-toml |
| toml (npm package) | Only supports TOML 0.4.0 (2013 spec). | smol-toml |
| ts-jest | Legacy bridge for running TypeScript in Jest. Zero reason to add it to a new project when Vitest exists. | Vitest |
| rollup (direct) | Correct tool for complex library bundling edge cases but excessive configuration overhead for this project's library shape. | tsup (wraps esbuild with good defaults) |
| yargs | Runtime type coercion is stringly typed. More configuration surface area than commander for no benefit at this CLI scope. | commander |

---

## Stack Patterns by Variant

**For the `@buildstory/core` library package:**
- Build with `tsup --format cjs,esm --dts` to produce dual-module output
- Export types explicitly — don't rely on `export *`
- Keep zero knowledge of CLI args, file paths, or config files — accept plain typed objects
- Use zod to validate all public inputs and LLM JSON responses

**For the `buildstory` CLI package:**
- Thin wrapper only — import from `@buildstory/core`, map CLI args to typed inputs
- Use `commander` with TypeScript option declarations
- Read `buildstory.toml` here, not in core — pass parsed config as typed object to core functions
- Executable via `#!/usr/bin/env node` shebang with `bin` field in package.json

**For the render pipeline (FFmpeg assembly):**
- Generate frames as PNG files in a temp directory using canvas + sharp
- Pass frame directory + audio file to fluent-ffmpeg
- Use `ffmpeg-static` path as default; check `process.env.FFMPEG_PATH` first
- Chunk TTS calls per scene (OpenAI TTS limit: 4096 chars per request)

**For LLM calls:**
- Implement a provider interface: `{ complete(prompt: string): Promise<string> }`
- Anthropic implementation: `@anthropic-ai/sdk` messages API
- OpenAI implementation: `openai` chat completions API
- Parse all LLM JSON output through zod schemas — never trust raw LLM response shape

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| canvas@3.2.3 | Node 18.12.0+ | Requires Cairo system library; prebuilt binaries available for Linux/macOS/Windows via node-gyp |
| sharp@0.34.5 | Node 18.17.0+ | Automatically downloads libvips ~7MB binary during install; no system install required |
| ffmpeg-static@5.3.0 | Node 12+ | Provides FFmpeg 6.1.1 static binary; ~60MB download per platform |
| @anthropic-ai/sdk@0.82.0 | Node 18+ | |
| openai@6.33.0 | TypeScript 4.9+ | |
| remark@15.0.1 | ESM only | The unified/remark ecosystem is ESM-only as of remark v14+. `tsup` handles this correctly with `--format esm` for packages consuming it. If CJS output is needed, use dynamic `import()` in a CJS wrapper or `createRequire`. Flag: `@buildstory/core` must be ESM or dual-module. |
| zod@4.3.6 | TypeScript 5.5+ | Zod v4 drops support for TS < 5.5. |
| smol-toml@1.6.1 | TypeScript moduleResolution: node16 or bundler | Must set `moduleResolution` correctly in tsconfig for type resolution. |

---

## Critical ESM Note

The unified/remark ecosystem (remark, remark-parse, unified, mdast-util-from-markdown) is **ESM-only** as of their current major versions. This is the most common build-time surprise in this stack.

**Resolution:** Configure `@buildstory/core` as `"type": "module"` in package.json, or use tsup's `--format esm,cjs` which handles the interop. The CLI (`buildstory`) can remain CJS since it imports core dynamically at runtime. Verify the tsconfig `moduleResolution` is set to `bundler` or `node16`.

---

## Sources

- npmjs.com registry — version numbers confirmed 2026-04-05 via `npm show [package] version`
- [remark GitHub](https://github.com/remarkjs/remark) — ecosystem overview, ESM-only status
- [unified.js.org](https://unifiedjs.com/) — remark vs micromark use case guidance
- [simple-git GitHub](https://github.com/steveukx/git-js) — TypeScript bundled types since v3 confirmed
- [sharp installation docs](https://sharp.pixelplumbing.com/install/) — libvips auto-download, TypeScript bundled since v0.32
- [node-canvas GitHub](https://github.com/Automattic/node-canvas) — v3 TypeScript types, Cairo requirement
- [smol-toml GitHub](https://github.com/squirrelchat/smol-toml) — TOML 1.1.0 compliance, npm download position
- [fluent-ffmpeg npm](https://www.npmjs.com/package/fluent-ffmpeg) — version, @types/fluent-ffmpeg status
- [OpenAI TTS docs](https://platform.openai.com/docs/guides/text-to-speech?lang=node) — 4096 char limit, voice options, model names
- [Zod v4 InfoQ coverage](https://www.infoq.com/news/2025/08/zod-v4-available/) — 14x performance, TS 5.5+ requirement
- [pnpm workspaces docs](https://pnpm.io/workspaces) — workspace: protocol, changesets integration
- [tsup docs](https://tsup.egoist.dev/) — version 8.5.1, CJS+ESM+dts output confirmed
- [Vitest docs](https://vitest.dev/) — version 4.x, zero-config TypeScript

---

*Stack research for: BuildStory — TypeScript monorepo toolkit*
*Researched: 2026-04-05*

---

## v1.1 Addendum: HeyGen Renderer Integration

**Researched:** 2026-04-14
**Scope:** New additions only for the HeyGen async video renderer milestone.

### Executive Summary

HeyGen has no official Node.js SDK for async video generation. The REST API is the integration surface. All HeyGen calls should use Node 22's native `fetch` global (already required by the project) — no new HTTP client dependency. The one community TypeScript SDK (`@teamduality/heygen-typescript-sdk`) was last substantially updated January 2025 and is not HeyGen-official; avoid it.

The correct package home is a new `packages/heygen/` workspace package. This isolates it from `@buildstory/video` (Remotion-heavy) and respects the existing `@buildstory/core` boundary rule (core knows nothing of renderers).

### What Changes vs. v1.0

| Area | v1.0 | v1.1 Change |
|------|------|-------------|
| Packages | core, video, cli | Add `@buildstory/heygen` package |
| HTTP client | SDK-managed | Native `fetch` (Node 22 built-in) — zero new dep |
| Renderer abstraction | None (Remotion implicit) | `RendererProvider` interface in `@buildstory/core/types/` |
| CLI flag | `--renderer` not present | Add `--renderer=heygen` (default: `remotion`) |
| Config keys | `[video.*]` only | Add `[heygen.*]` section in `buildstory.toml` |
| Env vars | `OPENAI_API_KEY` | Add `HEYGEN_API_KEY` |
| New dependencies | — | `p-retry ^6.2.1` (polling resilience) |

### New Package: `@buildstory/heygen`

Create at `packages/heygen/`. Same tsup/vitest/tsconfig scaffold as the other packages.

```json
{
  "name": "@buildstory/heygen",
  "version": "0.1.0",
  "type": "module",
  "dependencies": {
    "@buildstory/core": "workspace:*",
    "zod": "^4.3.6",
    "p-retry": "^6.2.1"
  },
  "devDependencies": {
    "@types/node": "^25.5.2",
    "tsup": "^8.5.1",
    "vitest": "^4.1.2"
  }
}
```

`zod` is already a workspace dependency — pulling it here adds no meaningful install cost. `p-retry` is the only genuinely new transitive dependency for the project.

### HeyGen REST API — Integration Surface

**Confidence:** MEDIUM — verified from official HeyGen docs and community examples. No SDK to confirm exact type shapes against; shapes below are derived from docs and community integrations.

#### Authentication

All requests require a single header. No OAuth, no session negotiation.

```
X-Api-Key: <value of HEYGEN_API_KEY env var>
Content-Type: application/json
```

#### Key Endpoints

Use v2 endpoints. HeyGen's engineering focus has shifted to v3 ("Video Agents" — prompt-driven, less control), but v3 does not support multi-scene structured video with explicit avatar/voice selection, which is what BuildStory needs. v2 remains fully supported through October 31, 2026.

| Operation | Method | URL |
|-----------|--------|-----|
| List avatars | GET | `https://api.heygen.com/v2/avatars` |
| List voices | GET | `https://api.heygen.com/v2/voices` |
| Generate video | POST | `https://api.heygen.com/v2/video/generate` |
| Poll video status | GET | `https://api.heygen.com/v2/videos/{video_id}` |

#### Video generation request shape

```typescript
interface HeyGenVideoGenerateRequest {
  video_inputs: Array<{
    character: {
      type: 'avatar'
      avatar_id: string
      avatar_style?: 'normal' | 'circle' | 'closeUp'
    }
    voice: {
      type: 'text'
      input_text: string  // the narration text for this scene
      voice_id: string
      speed?: number      // 0.5 to 2.0
    }
    background?: {
      type: 'color'
      value: string       // hex e.g. "#1a1a2e"
    }
  }>
  dimension?: { width: number; height: number }  // default 1280x720
  caption?: boolean
}

interface HeyGenVideoGenerateResponse {
  data: { video_id: string }
  error: null | { code: string; message: string }
}
```

Each element of `video_inputs` maps to one StoryBeat — HeyGen concatenates them into a single video, which aligns naturally with the existing `StoryArc.beats` structure.

#### Video status response shape

```typescript
interface HeyGenVideoStatusResponse {
  data: {
    video_id: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    video_url?: string       // present only when status === 'completed'
    thumbnail_url?: string
    duration?: number        // seconds
    error?: { code: string; message: string }
  }
}
```

#### Polling strategy

- Poll `GET /v2/videos/{video_id}` every 5 seconds (community-observed safe interval)
- Timeout after 10 minutes (avatar video generation for a 3–10 minute script typically takes 2–5 minutes)
- Use `p-retry` for exponential backoff on network errors only — not on `pending`/`processing` status (those are normal state, not errors)
- Webhooks exist but require a publicly-reachable URL — not viable for a local CLI tool

### RendererProvider Interface (new addition to `@buildstory/core`)

Model HeyGen on the same provider pattern as `LLMProvider` in `packages/core/src/narrate/providers/interface.ts`. Add to `packages/core/src/types/`:

```typescript
// packages/core/src/types/renderer.ts
export interface RendererCostEstimate {
  sceneCount: number
  estimatedMinutes: number
  estimatedCostUSD: number
  currency: 'credits'
  creditsRequired: number
}

export interface RendererOptions {
  outputDir: string
  onProgress?: (message: string) => void
}

export interface RendererResult {
  videoPath: string       // local path to downloaded MP4
  durationSeconds: number
}

export interface RendererProvider {
  render(storyArc: StoryArc, options: RendererOptions): Promise<RendererResult>
  estimateCost(storyArc: StoryArc): RendererCostEstimate
  preflight(): Promise<PreflightResult>
}
```

Both `@buildstory/video` (Remotion) and `@buildstory/heygen` implement this interface. The CLI selects the implementation based on `--renderer` flag or `buildstory.toml` `video.renderer` setting, then lazy-imports the appropriate package.

### New `p-retry ^6.2.1`

**Purpose:** Exponential backoff on network errors in the polling loop.
**Why:** Polling over 5-10 minutes will encounter transient network failures. Hand-rolling retry logic is boilerplate. `p-retry` is Sindre Sorhus's canonical retry utility, ESM-native, TypeScript types bundled, 7M+ weekly downloads.
**Confidence:** HIGH — confirmed active maintenance, ESM compatibility.

**If zero new deps is preferred:** Replace with a plain `while` loop + `try/catch` + `setTimeout`. `p-retry` is convenience, not a hard requirement.

### Config Schema Additions

New `[heygen]` section in `buildstory.toml`. Parsed in CLI, passed to `@buildstory/heygen` as a typed object:

```toml
[video]
renderer = "heygen"   # "remotion" (default) | "heygen"

[heygen]
avatar_id = "Monica_chair_front_public"
voice_id  = "2d5b0e6cf36f460aa7fc47e3eee4ba54"
avatar_style = "normal"   # "normal" | "circle" | "closeUp"
width  = 1280
height = 720
caption = false
```

`HEYGEN_API_KEY` is never written to config — env var only, same pattern as `OPENAI_API_KEY`.

### API Pricing (for `estimateCost()`)

| Tier | Cost per credit | 1 credit = |
|------|----------------|------------|
| Pro (pay-as-you-go) | ~$0.99/credit | 1 minute of avatar video |
| Scale | ~$0.50/credit | 1 minute of avatar video |

A 5-minute BuildStory story costs approximately $0.50–$0.99 at scale tier. The `estimateCost()` method surfaces this before rendering begins, matching the UX pattern of `estimateTTSCost()` in `@buildstory/video`.

Note: HeyGen removed free API credits as of February 2026. Any API key will require a paid plan.

### What NOT to Add for HeyGen

| Package | Why to avoid |
|---------|--------------|
| `@teamduality/heygen-typescript-sdk` | Community SDK, last major update January 2025, not HeyGen-official. 4 endpoints don't justify the dependency. |
| `@heygen/streaming-avatar` | Browser SDK for real-time interactive avatars — completely different product from async video generation |
| `@heygen/liveavatar-web-sdk` | Same — browser/real-time, wrong fit |
| `axios` / `got` / `node-fetch` / `undici` | Redundant — Node 22 native `fetch` covers all HeyGen API calls |
| `fluent-ffmpeg` in heygen package | HeyGen returns a finished MP4 URL — no local assembly needed |
| `canvas` / `sharp` in heygen package | No frame generation — HeyGen renders server-side |
| `openai` in heygen package | HeyGen has its own TTS built in — OpenAI TTS is not needed when using the HeyGen renderer |

### Installation (HeyGen additions only)

```bash
# New workspace package
mkdir packages/heygen
# (scaffold package.json, tsup.config.ts, tsconfig.json per existing package pattern)

# @buildstory/heygen dependencies
pnpm add --filter @buildstory/heygen p-retry@^6

# zod is already in workspace — add as workspace dep if not already shared
pnpm add --filter @buildstory/heygen zod@^4
```

### Sources (v1.1 additions)

- [HeyGen API Documentation](https://docs.heygen.com/) — main docs hub
- [HeyGen API Reference](https://docs.heygen.com/reference) — endpoint reference
- [Generate Studio Video (v2)](https://docs.heygen.com/docs/create-video) — video generation endpoint and payload shape
- [Get Video Status/Details](https://docs.heygen.com/reference/video-status) — polling endpoint, status values
- [List All Avatars v2](https://docs.heygen.com/reference/list-avatars-v2)
- [List Available Voices v2](https://docs.heygen.com/reference/list-voices-v2)
- [HeyGen API Pricing](https://www.heygen.com/api-pricing) — credit cost structure
- [HeyGen Developers](https://developers.heygen.com) — v2 vs v3 versioning policy, October 2026 support deadline
- [@teamduality/heygen-typescript-sdk on GitHub](https://github.com/teamduality/heygen-typescript-sdk) — reviewed and rejected (community, not official)
- [HeyGen Official GitHub](https://github.com/heygen-com) — confirms streaming/liveavatar SDKs are browser-targeted
- [p-retry on npm](https://www.npmjs.com/package/p-retry) — ESM, TypeScript types bundled
- [HeyGen API Pricing Help Article](https://help.heygen.com/en/articles/10060327-heygen-api-liveavatar-pricing-subscriptions-explained) — no free credits from Feb 2026
