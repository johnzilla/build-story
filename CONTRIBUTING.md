# Contributing to BuildStory

Thanks for your interest. This is a small TypeScript monorepo; the loop is fast.

## Prerequisites

- **Node.js 22+** (enforced via `engines`)
- **pnpm 10** — the version is pinned in `packageManager`. Run `corepack enable`
  once and pnpm will use the exact pinned version automatically.
- **Installed Chrome/Chromium** for Remotion rendering (not needed for unit tests).
- **ffmpeg** and **ffprobe** on your `PATH` (for the video/TTS paths). Override
  with `FFMPEG_PATH` / `FFPROBE_PATH`.

## Setup

```bash
pnpm install     # install the whole workspace
pnpm build       # build every package (core → video → heygen → cli)
```

Run the CLI from the build output while developing:

```bash
node packages/cli/dist/index.js run . --dry-run
```

## The gates

All four must be green before anything is committed to `main`:

```bash
pnpm build       # tsup: ESM bundles; library packages also emit .d.ts
pnpm typecheck   # tsc --noEmit across all src + tests (real gate; tsup only
                 # type-checks each package's entry graph)
pnpm lint        # eslint packages/*/src
pnpm test        # vitest across all packages
```

`pnpm audit` (high) is also run in CI and on a weekly schedule.

## Repository layout

| Package | What it is |
|---------|------------|
| `@buildstory/core` | Scan → narrate → format. Source access is injected; built-in LLM providers make network calls. No direct filesystem/config access. |
| `@buildstory/video` | Remotion rendering + OpenAI TTS. Loaded on demand for rendering and storyboard review. |
| `@buildstory/heygen` | HeyGen avatar rendering. Loaded on demand at render time. |
| `@buildstory/cli` | Thin wrapper (the `buildstory` command). Reads config/env, maps flags to typed inputs, calls core/video/heygen. |

Guidelines:

- **Keep `@buildstory/core` pure.** It must not import `fs`, `process`, config
  libraries, or vendor SDKs beyond the LLM providers. Filesystem/git/transcript
  access is injected.
- **ESM-only.** Every package is `"type": "module"` and ships ESM only (the
  remark ecosystem core depends on is ESM-only). Use `.js` import specifiers in
  TypeScript (`moduleResolution: nodenext`).
- **Validate at boundaries.** Use Zod schemas for LLM JSON and imported data.
  The CLI validates TOML configuration with field-specific rules before work.
- **Never let secrets or full file contents reach the LLM or a committed file.**
  `rawContent` is stripped before narration; secrets are redacted at every
  ingress (`redactSecrets`) and outbound content boundaries. Redaction is
  best-effort. Only known dump names are ignored here; check custom filenames.

## Tests

Vitest, colocated (`*.test.ts` next to source or under `__tests__/`). Prefer pure,
mockable units — see `packages/video/src/tts/` (concurrency, splitting, pricing)
and the provider tests for Anthropic/OpenAI SDK mocks. HeyGen tests mock HTTP
and process failures. The real FFmpeg assembly test runs when FFmpeg and FFprobe
are available; otherwise it is skipped. No paid API calls are needed for tests.

### Offline video acceptance

After `pnpm build`, run `pnpm test:acceptance` when changing rendering, timing,
captions, audio assembly, fonts, or layout. This separate suite requires installed
Chrome/Chromium, FFmpeg, and FFprobe; missing tools fail the run rather than skip it.
`CHROME_PATH` or `PUPPETEER_EXECUTABLE_PATH`, `FFMPEG_PATH`, and `FFPROBE_PATH`
select custom binaries. No credentials or paid services are used.

The fixture creates three 1.2-second tones and renders the production 1080p
pipeline. Checks cover H.264/AAC decoding, 204 frames at 30 fps, stream duration,
audio/silence windows, SRT cue timing, caption visibility and changes at frame
boundaries, chapter changes, and rejection of unfit text. Pixel checks compare
bright text regions within the same render, avoiding platform-specific golden
images. They do not assess narration quality or every possible layout.

A unique directory under the OS temporary directory retains the MP4, SRT, source
fixture, FFprobe report, and representative PNGs on success or failure. The path
is printed. Set `BUILDSTORY_ACCEPTANCE_DIR` to choose the parent; runs do not reuse
or overwrite a prior fixture directory. Partial artifacts remain after failures.
Review the PNGs/video when changing presentation. Delete old artifacts when no
longer needed. CI runs this suite separately with a 15-minute job limit and
uploads available artifacts for seven days, including failed runs.

## Releasing

Version bumps and changelogs go through Changesets — see [RELEASING.md](./RELEASING.md).

## Security

Please report vulnerabilities privately — see [SECURITY.md](./SECURITY.md).
