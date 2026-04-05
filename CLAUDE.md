<!-- GSD:project-start source:PROJECT.md -->
## Project

**BuildStory**

BuildStory is a TypeScript monorepo toolkit that scans GStack/GSD planning artifacts across repositories, reconstructs a chronological development timeline, generates a narrative script via LLM, and renders narrated video documentaries. The core logic lives in `@buildstory/core` with thin wrappers for CLI, n8n nodes, and future integrations (MCP server, GitHub Actions).

**Core Value:** Extract the build story from planning artifacts and make it consumable — the structured narrative script is the product; video is one output format among many.

### Constraints

- **Tech stack**: TypeScript monorepo with pnpm workspaces — all packages in `packages/`
- **External dependency**: FFmpeg required for render phase (video assembly)
- **External dependency**: LLM API key required for narrate phase (Anthropic or OpenAI)
- **External dependency**: TTS API key required for render phase (OpenAI TTS for v1)
- **Package boundary**: `@buildstory/core` must have zero knowledge of CLI args, config files, or n8n — pure typed inputs/outputs
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

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
## Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint 10 | Linting | Use `@typescript-eslint/eslint-plugin` with flat config format (ESLint 10 default). No Prettier conflicts with `eslint-config-prettier`. |
| Prettier 3 | Formatting | Standard. Run via `prettier --write`. Do not combine formatting rules into ESLint. |
| Turbo 2.9 | Task orchestration | Optional but recommended for `build`, `test`, `lint` pipeline across packages with caching. pnpm workspaces alone work for small monorepos; Turbo becomes valuable once CI matters. |
## Installation
# Root workspace devDependencies
# @buildstory/core dependencies
# @buildstory/core devDependencies
# buildstory CLI dependencies
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
## Stack Patterns by Variant
- Build with `tsup --format cjs,esm --dts` to produce dual-module output
- Export types explicitly — don't rely on `export *`
- Keep zero knowledge of CLI args, file paths, or config files — accept plain typed objects
- Use zod to validate all public inputs and LLM JSON responses
- Thin wrapper only — import from `@buildstory/core`, map CLI args to typed inputs
- Use `commander` with TypeScript option declarations
- Read `buildstory.toml` here, not in core — pass parsed config as typed object to core functions
- Executable via `#!/usr/bin/env node` shebang with `bin` field in package.json
- Generate frames as PNG files in a temp directory using canvas + sharp
- Pass frame directory + audio file to fluent-ffmpeg
- Use `ffmpeg-static` path as default; check `process.env.FFMPEG_PATH` first
- Chunk TTS calls per scene (OpenAI TTS limit: 4096 chars per request)
- Implement a provider interface: `{ complete(prompt: string): Promise<string> }`
- Anthropic implementation: `@anthropic-ai/sdk` messages API
- OpenAI implementation: `openai` chat completions API
- Parse all LLM JSON output through zod schemas — never trust raw LLM response shape
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
## Critical ESM Note
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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
