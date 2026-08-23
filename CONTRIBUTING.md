# Contributing to BuildStory

Thanks for your interest. This is a small TypeScript monorepo; the loop is fast.

## Prerequisites

- **Node.js 22+** (enforced via `engines`)
- **pnpm 10** — the version is pinned in `packageManager`. Run `corepack enable`
  once and pnpm will use the exact pinned version automatically.
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
pnpm build       # tsup (ESM + .d.ts) for every package
pnpm typecheck   # tsc --noEmit across all src + tests (real gate; tsup only
                 # type-checks each package's entry graph)
pnpm lint        # eslint packages/*/src
pnpm test        # vitest across all packages
```

`pnpm audit` (high) is also run in CI and on a weekly schedule.

## Repository layout

| Package | What it is |
|---------|------------|
| `@buildstory/core` | Pure library: scan → narrate → format. **No `fs`, `process`, or config** — I/O comes through injected `ArtifactSource` / `GitSource` / `TranscriptSource`. |
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
- **Validate at boundaries** with zod: LLM JSON output, config after TOML parse,
  and public inputs to core.
- **Never let secrets or full file contents reach the LLM or a committed file.**
  `rawContent` is stripped before narration; secrets are redacted at every
  ingress (`redactSecrets`); scan/timeline dumps are git-ignored.

## Tests

Vitest, colocated (`*.test.ts` next to source or under `__tests__/`). Prefer pure,
mockable units — see `packages/video/src/tts/` (concurrency, truncation, pricing)
and the provider tests that mock the OpenAI/HeyGen SDKs.

## Releasing

Version bumps and changelogs go through Changesets — see [RELEASING.md](./RELEASING.md).

## Security

Please report vulnerabilities privately — see [SECURITY.md](./SECURITY.md).
