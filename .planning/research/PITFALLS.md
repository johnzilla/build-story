# Pitfalls Research

**Domain:** TypeScript monorepo — markdown/git artifact scanning, LLM narration, FFmpeg video rendering
**Researched:** 2026-04-05
**Confidence:** HIGH (monorepo/FFmpeg), MEDIUM (LLM integration patterns), HIGH (node-canvas memory)

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

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode OpenAI as sole LLM provider | Ships faster, no abstraction needed | Can't add Anthropic without rewrite; provider-specific error codes leak everywhere | Never — the PRD requires both providers |
| Use `fluent-ffmpeg` for familiarity | Less FFmpeg argument knowledge needed | Unmaintained, breaks on FFmpeg version updates, adds dead dependency | Never — archived May 2025 |
| Estimated TTS duration instead of measured | Simpler pipeline | Audio/video desync on any video longer than ~10 seconds | Never in video assembly |
| Single `tsconfig.json` at root | Easier to set up | Types bleed across packages, no incremental build, IDE confusion about which package owns a file | MVP only, must be fixed before publishing packages |
| `JSON.parse()` without Zod on LLM output | Less code | Silent failures when model response schema drifts | Never — runtime type safety on LLM output is mandatory |
| Write all packages to `packages/core` during early dev | Avoids monorepo plumbing friction | Package boundaries become impossible to enforce retroactively | Prototype/spike only, resolve before v1 |

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

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Generating all video frames before piping any to FFmpeg | Peak memory = (frame count × frame size); OOM on longer videos | Pipe frames to FFmpeg stdin as a stream, or write to a temp dir and use the concat demuxer with file list | ~100 frames (~4 seconds at 24fps) on a 512MB process limit |
| Calling `narrate()` with full raw markdown content instead of extracted timeline | Context window overflow (128K–200K token limits hit), cost spike | Summarize and chunk content in the scanner phase; pass structured timeline events to narrator, not raw file contents | Projects with >50 planning documents |
| Sequential TTS generation (one scene at a time) | Render phase takes minutes waiting on API round trips | Parallelize TTS calls with `Promise.all()` across scenes; TTS has no ordering dependency | Videos with >5 scenes |
| Re-running full git log on every `scan()` call | Slow on repos with thousands of commits | Cache the timeline JSON with a content hash of relevant file paths + latest commit SHA as the cache key | Repos with >5,000 commits |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing Anthropic/OpenAI API keys in `buildstory.toml` (checked into git) | Key exposure in public repos | Read API keys only from environment variables; document in CLI help that keys must not go in config files; add `*.toml` to `.gitignore` example only if it would contain secrets — better to make the config file key-free by design |
| Scanning arbitrary paths without validation | Path traversal — a malicious `buildstory.toml` could point the scanner at `/etc/` | Validate all scan root paths are within the declared project directory; reject absolute paths outside the working dir |
| Passing unsanitized git commit message content directly into FFmpeg subtitle filters | FFmpeg filter injection via specially crafted commit messages | Escape all user-supplied text before embedding in FFmpeg filter arguments; use `-metadata` flags rather than inline filter strings where possible |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent failure when FFmpeg is not installed | `render()` fails with a cryptic spawn error at the end of a long scan+narrate run | Check for FFmpeg at startup with `which ffmpeg` / `ffmpeg -version`; exit early with a clear install message before any expensive API calls |
| No progress output during long operations | User can't tell if the tool is working or hung — narrate and render can each take 30–120 seconds | Emit progress events (`scan:complete`, `narrate:scene:N`, `render:frame:N`) from core so CLI can display them; never have a silent multi-second wait |
| Emitting generated video to cwd without warning | Unexpected large file (100–500MB) written to the project directory | Default output to a `./buildstory-out/` subdirectory; make the path configurable; warn about estimated file size before writing |
| Overwriting previous output without asking | User loses a carefully generated video by re-running | Append timestamp to output filename by default, or check for existence and prompt before overwrite |

---

## "Looks Done But Isn't" Checklist

- [ ] **FFmpeg availability check:** The render phase spawns FFmpeg — verify there is an explicit pre-flight check that fails fast with a human-readable error if `ffmpeg` is not on PATH
- [ ] **TTS duration measurement:** The first multi-scene video looks synced — verify `ffprobe` is called on each TTS audio file and the measured duration (not the estimated one) drives frame count
- [ ] **Core package isolation:** The core library compiles cleanly — verify `packages/core/package.json` has zero runtime dependencies on `fs`, config parsers, or CLI libraries
- [ ] **LLM schema validation:** The narrator returns valid JSON — verify every LLM response goes through `z.parse()` before being typed as `ScriptOutput`; check what happens when the model returns a refusal
- [ ] **Temp file cleanup:** A render completes — verify the tmp directory of individual frames and audio files is deleted on both success and error paths (use `try/finally`)
- [ ] **Git history boundary:** `scan()` runs on a large repo — verify `--max-count` or equivalent is applied so the scanner doesn't process an unbounded commit history
- [ ] **Monorepo phantom deps:** All packages build — verify `pnpm install --frozen-lockfile` passes in a fresh Docker container with no pre-existing store

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Core library has absorbed config/CLI concerns | HIGH | Extract all config-touching code into the CLI package; audit every import in `packages/core/` against a banned-import list; this is a refactor, not a patch |
| fluent-ffmpeg is already in use | MEDIUM | Replace with direct `child_process.spawn` calls; the spawn wrapper is ~50 lines; write the replacement in one sitting before the render phase grows larger |
| LLM cost runaway incident | LOW (code) / potentially HIGH (cost) | Rotate API key immediately; add spend limits to provider dashboards; add token estimation before API calls; review billing alert settings |
| Audio/video desync discovered after render | MEDIUM | Retrofit `ffprobe` duration measurement into the render pipeline; rewrite the frame count calculation to use measured duration; regenerate affected videos |
| node-canvas OOM on long video | MEDIUM | Refactor frame generation to process in batches of N frames; write each batch to disk and clear references before the next batch |

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

---
*Pitfalls research for: TypeScript monorepo — artifact scanning, LLM narration, FFmpeg video rendering*
*Researched: 2026-04-05*
