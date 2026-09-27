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
| `@buildstory/video` | Remotion rendering + OpenAI TTS. Loaded on demand at render time. |
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

## Releasing

Version bumps and changelogs go through Changesets — see [RELEASING.md](./RELEASING.md).

## Security

Please report vulnerabilities privately — see [SECURITY.md](./SECURITY.md).
