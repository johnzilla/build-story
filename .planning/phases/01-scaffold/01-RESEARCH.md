# Phase 01: Scaffold - Research

**Researched:** 2026-04-05
**Domain:** pnpm monorepo scaffold — TypeScript, tsup, ESLint boundary rule, Commander CLI, smol-toml config, Zod stubs
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** ESM-only for `@buildstory/core` — remark/unified ecosystem is ESM-only, no need for CJS until n8n wrapper (deferred)
- **D-02:** tsup as build tool — esbuild-based, handles ESM output and .d.ts generation, fast
- **D-03:** TypeScript `moduleResolution: "NodeNext"` — strictest resolution, requires .js extensions in imports, catches issues early
- **D-04:** pnpm scripts only for task running — no Turborepo. `pnpm --filter` and workspace scripts sufficient for 2-package monorepo
- **D-05:** Commander for CLI argument parsing — subcommand pattern built-in, TypeScript support, PRD-specified
- **D-06:** ora spinners + chalk for CLI output — spinner per phase, colored status messages
- **D-07:** Binary name: `buildstory` — matches project name, clear and discoverable
- **D-08:** TOML-only configuration — `buildstory.toml` at project root, `~/.config/buildstory/config.toml` for global defaults. Project overrides global. Parsed with smol-toml.
- **D-09:** API keys via environment variables only — `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` from env. Never stored in config files.
- **D-10:** Stub functions return typed empty objects — scan() returns empty Timeline with correct shape, narrate() returns empty Script. Validates types end-to-end at scaffold phase.
- **D-11:** Sequential await for `buildstory run` — run() calls scan(), passes result to narrate(), passes to render(). Simple and debuggable.
- **D-12:** Zod schemas from the start — define Zod v4 schemas alongside TypeScript types. Runtime validation at phase boundaries (scan output, narrate output).

### Claude's Discretion

- Exact tsconfig settings beyond moduleResolution (target, lib, strictness)
- Package.json workspace configuration details
- ESLint rule implementation specifics for core boundary enforcement
- Test framework setup (Vitest confirmed by research)
- Directory structure within packages (research provided detailed layout)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Monorepo scaffold with pnpm workspaces (`@buildstory/core`, `buildstory` CLI) | pnpm-workspace.yaml, package.json workspace config, verified pnpm 10.31.0 available |
| INFRA-02 | `@buildstory/core` exposes typed public API (`scan()`, `narrate()`, `render()`) with zero CLI/config imports | ESM-only package design, typed stub pattern, Zod v4 schema at boundaries |
| INFRA-03 | CLI wrapper parses args and loads `buildstory.toml`, delegates to core functions | Commander 14.0.3 subcommand pattern, smol-toml 1.6.1 config loader |
| INFRA-04 | `buildstory.toml` at project-level and `~/.config/buildstory/config.toml` for global defaults | smol-toml parse + merge pattern, os.homedir() resolution |
| INFRA-05 | ESLint boundary rule preventing core from importing CLI/config concerns | ESLint 10 flat config, no-restricted-imports rule targeting fs/process.env/config libs |
| INFRA-06 | `buildstory run` command executes full pipeline (scan -> narrate -> render) | Sequential await pattern, stub implementations wired end-to-end |

</phase_requirements>

---

## Summary

Phase 1 is a greenfield monorepo scaffold. No existing code — every file is net-new. The goal is not functionality but foundation: correct package topology, enforced boundaries, typed stubs that prove the pipeline compiles end-to-end, and a working CLI entry point.

The critical technical challenges are (1) getting the ESM-only setup correct so downstream remark/unified imports work without pain, (2) wiring the ESLint boundary rule that will protect core isolation for the entire project lifetime, and (3) correctly configuring the `moduleResolution: "NodeNext"` requirement which enforces `.js` extensions in all relative imports.

A key conflict exists in the upstream research artifacts: STACK.md recommends `fluent-ffmpeg`, while PITFALLS.md correctly identifies that fluent-ffmpeg was archived on May 22, 2025 and must not be used. PITFALLS.md takes precedence — Phase 1 scaffold must NOT install fluent-ffmpeg. The render phase will use `child_process.spawn` directly. This matters for Phase 1 because it affects what goes into `@buildstory/core/package.json`.

**Primary recommendation:** Scaffold the two-package monorepo with ESM-only core, NodeNext resolution, a custom ESLint no-restricted-imports rule for core isolation, and stub implementations that return correctly-typed empty structures through the full pipeline.

---

## Project Constraints (from CLAUDE.md)

Directives extracted from `./CLAUDE.md` that the planner must treat as locked:

| Directive | Source | Enforcement |
|-----------|--------|-------------|
| `@buildstory/core` must have zero knowledge of CLI args, config files, or n8n | CLAUDE.md constraints | ESLint boundary rule (INFRA-05) |
| TypeScript monorepo with pnpm workspaces — all packages in `packages/` | CLAUDE.md constraints | Directory structure |
| FFmpeg required for render phase (external dependency) | CLAUDE.md constraints | Not in Phase 1 scope; render stubs only |
| LLM API key required for narrate phase | CLAUDE.md constraints | Not in Phase 1 scope; narrate stubs only |
| Use `/browse` skill for all web browsing | CLAUDE.md global | Agent execution scope only |

---

## Standard Stack

### Core (Phase 1 scope only)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 6.0.2 | Language | Current release; Zod v4 requires TS 5.5+. [VERIFIED: npm registry] |
| pnpm workspaces | 10.31.0 | Monorepo package manager | Strict hoisting, workspace: protocol, fastest installs. Already installed on system. [VERIFIED: pnpm --version] |
| Node.js | 22.22.0 | Runtime | Current LTS; all dependencies require Node 18+. [VERIFIED: node --version] |
| tsup | 8.5.1 | Build tool per package | esbuild-wrapped, zero-config ESM+dts. [VERIFIED: npm registry] |
| Vitest | 4.1.2 | Test runner | Native ESM+TS, zero config. [VERIFIED: npm registry] |
| zod | 4.3.6 | Runtime schema validation | Defines typed stubs at phase boundaries; 14x faster than v3. [VERIFIED: npm registry] |
| commander | 14.0.3 | CLI argument parsing | 35M+ weekly downloads, subcommand pattern, TypeScript support. [VERIFIED: npm registry] |
| smol-toml | 1.6.1 | TOML config parsing | TOML 1.1.0 compliant, pure TypeScript, most-downloaded TOML parser. [VERIFIED: npm registry] |
| ESLint | 10.2.0 | Linting | Flat config format (ESLint 10 default). [VERIFIED: npm registry] |
| @typescript-eslint/eslint-plugin | 8.58.0 | TypeScript rules for ESLint | Typed linting rules, boundary enforcement. [VERIFIED: npm registry] |
| @typescript-eslint/parser | 8.58.0 | TypeScript parser for ESLint | Required with the plugin. [VERIFIED: npm registry] |
| Prettier | 3.8.1 | Code formatting | Separate from ESLint; `prettier --write`. [VERIFIED: npm registry] |
| @changesets/cli | 2.30.0 | Versioning | pnpm-recommended for monorepo version management. [VERIFIED: npm registry] |

### Supporting (Phase 1 scope — CLI output)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ora | latest | CLI spinners | Phase 1 CLI stub — spinner per pipeline phase during `buildstory run` |
| chalk | latest | CLI colors | Phase 1 CLI stub — colored status messages |

> Note: ora and chalk versions not checked in this session. Use `npm view ora version` and `npm view chalk version` before installing. [ASSUMED versions; VERIFIED: both are in the decision list D-06]

### Do NOT Install in Phase 1

These packages are in STACK.md but belong to later phases. Do not put them in any Phase 1 package.json:

| Package | Phase | Reason |
|---------|-------|--------|
| fluent-ffmpeg | NEVER | Archived May 2025. Use child_process.spawn in Phase 4. [VERIFIED: PITFALLS.md] |
| remark, remark-parse, unified | Phase 2 | Scanner implementation |
| simple-git | Phase 2 | Git integration |
| @anthropic-ai/sdk, openai | Phase 3/4 | LLM/TTS integration |
| canvas, sharp | Phase 4 | Frame generation |
| ffmpeg-static | Phase 4 | FFmpeg binary |
| fast-glob | Phase 2 | File discovery |

### Installation Commands

```bash
# Root workspace devDependencies
pnpm add -D -w typescript@^6 tsup@^8 vitest@^4 eslint@^10 @typescript-eslint/eslint-plugin@^8 @typescript-eslint/parser@^8 prettier@^3 @changesets/cli@^2

# @buildstory/core dependencies (Phase 1 only — stubs)
pnpm add --filter @buildstory/core zod@^4

# @buildstory/core devDependencies
pnpm add -D --filter @buildstory/core @types/node

# buildstory CLI dependencies
pnpm add --filter buildstory commander@^14 smol-toml@^1 ora chalk

# buildstory CLI devDependencies
pnpm add -D --filter buildstory @types/node
```

---

## Architecture Patterns

### Recommended Project Structure

```
build-story/
├── packages/
│   ├── core/                       # @buildstory/core (ESM-only)
│   │   ├── src/
│   │   │   ├── scan/
│   │   │   │   └── index.ts        # stub: scan() returns empty Timeline
│   │   │   ├── narrate/
│   │   │   │   └── index.ts        # stub: narrate() returns empty Script
│   │   │   ├── render/
│   │   │   │   └── index.ts        # stub: render() returns empty RenderResult
│   │   │   ├── types/
│   │   │   │   ├── timeline.ts     # Timeline, TimelineEvent interfaces + Zod schema
│   │   │   │   ├── script.ts       # Script, Scene interfaces + Zod schema
│   │   │   │   └── options.ts      # ScanOptions, NarrateOptions, RenderOptions
│   │   │   └── index.ts            # public API barrel: scan, narrate, render + types
│   │   ├── package.json            # "type": "module", "exports" field
│   │   ├── tsconfig.json           # moduleResolution: NodeNext, composite: true
│   │   └── tsup.config.ts          # format: esm, dts: true
│   │
│   └── cli/                        # buildstory (CLI binary)
│       ├── src/
│       │   ├── commands/
│       │   │   └── run.ts          # buildstory run — sequential scan→narrate→render
│       │   ├── config.ts           # buildstory.toml loader (smol-toml, global+project merge)
│       │   └── index.ts            # commander entry point, shebang
│       ├── package.json            # "bin": { "buildstory": "./dist/index.js" }
│       ├── tsconfig.json           # moduleResolution: NodeNext
│       └── tsup.config.ts          # format: esm, entry: src/index.ts
│
├── pnpm-workspace.yaml
├── package.json                    # root: workspace scripts only
├── tsconfig.base.json              # shared: strict, target ES2022, NodeNext
├── .eslintrc.js  (or eslint.config.js)  # flat config, boundary rule
├── .prettierrc
└── .changeset/
    └── config.json
```

### Pattern 1: ESM-Only Core Package

**What:** `@buildstory/core` is declared as `"type": "module"` in its package.json. All imports use `.js` extensions (required by NodeNext resolution). Exports field maps entry points explicitly.

**When to use:** Always for this package — remark/unified (Phase 2) is ESM-only and will be a direct dependency.

**Example:**
```jsonc
// packages/core/package.json
{
  "name": "@buildstory/core",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run"
  }
}
```

```typescript
// packages/core/src/index.ts
// NodeNext requires .js extensions on all relative imports
export { scan } from './scan/index.js'
export { narrate } from './narrate/index.js'
export { render } from './render/index.js'
export type { Timeline, TimelineEvent } from './types/timeline.js'
export type { Script, Scene } from './types/script.js'
export type { ScanOptions, NarrateOptions, RenderOptions } from './types/options.js'
```

### Pattern 2: tsup Configuration for ESM + d.ts

**What:** tsup builds ESM output with TypeScript declarations in one command. No separate `tsc --emitDeclarationOnly` pass needed.

**Example:**
```typescript
// packages/core/tsup.config.ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
})
```

```typescript
// packages/cli/tsup.config.ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,        // CLI binary does not publish types
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',  // shebang injected into output
  },
})
```

### Pattern 3: Shared tsconfig Base

**What:** Root `tsconfig.base.json` establishes shared compiler options. Each package extends it and adds `composite: true` for project references.

**Example:**
```jsonc
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

```jsonc
// packages/core/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "composite": true
  },
  "include": ["src"]
}
```

```jsonc
// packages/cli/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "composite": true
  },
  "include": ["src"],
  "references": [{ "path": "../core" }]
}
```

### Pattern 4: ESLint Boundary Rule for Core Isolation

**What:** ESLint `no-restricted-imports` rule applied only to `packages/core/src/**` that bans `fs`, `path`, `process`, `os`, and any config-parsing library. This is the technical enforcement of INFRA-05.

**When to use:** Applied at scaffold time and never relaxed.

**Example (ESLint flat config):**
```javascript
// eslint.config.js (root)
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    // Global TypeScript rules
    files: ['packages/*/src/**/*.ts'],
    extends: [tseslint.configs.recommended],
  },
  {
    // Core boundary enforcement
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['fs', 'fs/*', 'node:fs', 'node:fs/*'],
            message: '@buildstory/core must not import fs. Pass file contents as arguments.',
          },
          {
            group: ['path', 'node:path'],
            message: '@buildstory/core must not import path for config resolution. Use typed options.',
          },
          {
            group: ['smol-toml', '@iarna/toml', 'toml', 'js-toml'],
            message: '@buildstory/core must not parse config files. Config is loaded by the CLI wrapper.',
          },
        ],
      }],
      'no-restricted-globals': ['error',
        { name: 'process', message: 'Do not access process.env in @buildstory/core. Pass env values via typed options.' },
      ],
    },
  }
)
```

> Note: `no-restricted-globals` blocks `process` as a global. However, `import { env } from 'process'` bypasses it — also add `'process'` to the `no-restricted-imports` patterns list to cover both forms. [ASSUMED: this covers the full attack surface; verify against actual ESLint behavior during implementation]

### Pattern 5: Typed Stub Implementations

**What:** Phase 1 stub functions return correctly-shaped empty objects matching the Zod schema. The pipeline wires end-to-end without any real logic.

**When to use:** Phase 1 only — replaced by real implementation in Phases 2, 3, 4.

**Example:**
```typescript
// packages/core/src/types/timeline.ts
import { z } from 'zod'

export const TimelineEventSchema = z.object({
  id: z.string(),
  date: z.string(),
  source: z.enum(['file', 'git-commit', 'git-tag']),
  path: z.string().optional(),
  summary: z.string(),
  metadata: z.record(z.unknown()),
})

export const TimelineSchema = z.object({
  version: z.literal('1'),
  rootDir: z.string(),
  scannedAt: z.string(),
  dateRange: z.object({ start: z.string(), end: z.string() }),
  events: z.array(TimelineEventSchema),
})

export type Timeline = z.infer<typeof TimelineSchema>
export type TimelineEvent = z.infer<typeof TimelineEventSchema>
```

```typescript
// packages/core/src/scan/index.ts
import type { ScanOptions } from '../types/options.js'
import type { Timeline } from '../types/timeline.js'

export async function scan(options: ScanOptions): Promise<Timeline> {
  return {
    version: '1',
    rootDir: options.rootDir,
    scannedAt: new Date().toISOString(),
    dateRange: { start: '', end: '' },
    events: [],
  }
}
```

```typescript
// packages/core/src/types/options.ts
export interface ScanOptions {
  rootDir: string
  patterns?: string[]
  excludes?: string[]
}

export interface NarrateOptions {
  provider: 'anthropic' | 'openai'
  style: 'technical' | 'overview' | 'retrospective' | 'pitch'
  apiKey: string
}

export interface RenderOptions {
  outputPath: string
}
```

### Pattern 6: Config Loading in CLI (smol-toml)

**What:** CLI's `config.ts` reads global then project `buildstory.toml`, merges with project taking precedence, returns a typed config object. Core never sees this.

**Example:**
```typescript
// packages/cli/src/config.ts
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { parse } from 'smol-toml'

export interface BuildStoryConfig {
  provider?: 'anthropic' | 'openai'
  style?: 'technical' | 'overview' | 'retrospective' | 'pitch'
  outputDir?: string
}

export function loadConfig(projectRoot: string): BuildStoryConfig {
  const globalPath = join(homedir(), '.config', 'buildstory', 'config.toml')
  const projectPath = join(projectRoot, 'buildstory.toml')

  const globalConfig: BuildStoryConfig = existsSync(globalPath)
    ? (parse(readFileSync(globalPath, 'utf8')) as BuildStoryConfig)
    : {}

  const projectConfig: BuildStoryConfig = existsSync(projectPath)
    ? (parse(readFileSync(projectPath, 'utf8')) as BuildStoryConfig)
    : {}

  // Project overrides global
  return { ...globalConfig, ...projectConfig }
}
```

### Pattern 7: Commander CLI Entry Point

**What:** Commander subcommand pattern with `buildstory run` as the Phase 1 wired command.

**Example:**
```typescript
// packages/cli/src/index.ts
import { Command } from 'commander'
import { run } from './commands/run.js'

const program = new Command()

program
  .name('buildstory')
  .description('Extract and narrate your build story from planning artifacts')
  .version('0.1.0')

program
  .command('run [paths...]')
  .description('Run the full pipeline: scan → narrate → render')
  .option('-c, --config <path>', 'path to buildstory.toml')
  .option('--provider <provider>', 'LLM provider (anthropic|openai)', 'anthropic')
  .option('--style <style>', 'narrative style', 'overview')
  .option('-o, --output <path>', 'output directory', './buildstory-out')
  .action(run)

program.parseAsync(process.argv)
```

```typescript
// packages/cli/src/commands/run.ts
import { scan, narrate, render } from '@buildstory/core'
import { loadConfig } from '../config.js'
import ora from 'ora'

export async function run(paths: string[], opts: {
  config?: string
  provider: string
  style: string
  output: string
}) {
  const config = loadConfig(process.cwd())
  const rootDir = paths[0] ?? process.cwd()

  const spinner = ora('Scanning artifacts...').start()
  const timeline = await scan({ rootDir })
  spinner.succeed('Scan complete')

  spinner.start('Narrating...')
  const script = await narrate(timeline, {
    provider: (config.provider ?? opts.provider) as 'anthropic' | 'openai',
    style: (config.style ?? opts.style) as 'technical' | 'overview' | 'retrospective' | 'pitch',
    apiKey: process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY ?? '',
  })
  spinner.succeed('Narration complete')

  spinner.start('Rendering...')
  await render(script, { outputPath: opts.output })
  spinner.succeed('Render complete')
}
```

### Anti-Patterns to Avoid

- **Importing `fs` in core:** The first violation of the boundary rule. ESLint will catch it, but don't set a precedent.
- **`workspace:^1.0.0` instead of `workspace:*`:** pnpm resolves semver workspace references from the registry in some configurations. Always use `workspace:*` for internal deps during development.
- **Omitting `.js` extensions in relative imports:** With `moduleResolution: "NodeNext"`, TypeScript requires `.js` extensions even for `.ts` source files. Missing them produces runtime errors, not compile errors, so they're easy to miss in stubs.
- **Setting `"type": "module"` in root `package.json`:** The root package is a workspace root, not a module. Only set `"type": "module"` in individual package `package.json` files.
- **`tsup --format cjs,esm` for core:** Decision D-01 is ESM-only for core. Do not add CJS output. CJS will be needed for the n8n nodes package (Phase 5, out of scope).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TOML parsing | Custom regex/string parser | smol-toml | TOML 1.1.0 has multi-line strings, datetime types, dotted keys — 30+ edge cases |
| CLI arg parsing | `process.argv` slice/split | commander | Subcommand dispatch, help generation, option validation — all solved |
| ESM/CJS interop | Custom wrapper shims | tsup with `format: ['esm']` | tsup handles .d.ts, sourcemaps, and esbuild interop in one config |
| TypeScript compilation order | Makefile/shell scripts | pnpm `--filter` with `workspace:*` dependencies | pnpm resolves build order from the dependency graph |
| Runtime type validation on config | Manual `typeof` checks | zod `.parse()` on smol-toml output | Edge cases in TOML types (integer vs float, datetime) need schema validation |

**Key insight:** Phase 1 is infrastructure, not product. Every minute spent hand-rolling a solved problem delays the foundation that all subsequent phases depend on.

---

## Common Pitfalls

### Pitfall 1: fluent-ffmpeg in Package.json

**What goes wrong:** STACK.md (which pre-dates PITFALLS.md) recommends fluent-ffmpeg. If the planner follows STACK.md literally, fluent-ffmpeg gets installed at scaffold time and becomes a dependency assumption for Phase 4.

**Why it happens:** The two research documents contradict each other. PITFALLS.md is authoritative: fluent-ffmpeg was archived May 22, 2025.

**How to avoid:** Do not install fluent-ffmpeg at any point. Phase 4 render stubs use `child_process.spawn` directly.

**Warning signs:** `fluent-ffmpeg` appearing anywhere in any `package.json`.

### Pitfall 2: Missing `.js` Extensions on Relative Imports

**What goes wrong:** TypeScript with `moduleResolution: "NodeNext"` requires `.js` extensions on all relative imports (even though the source file is `.ts`). Omitting them causes Node.js `ERR_MODULE_NOT_FOUND` at runtime. TypeScript does not always error at compile time for this.

**Why it happens:** Developers used to CommonJS or bundler-mode resolution write `import { foo } from './foo'` and it looks fine in the editor.

**How to avoid:** Every relative import must use `.js` extension: `import { scan } from './scan/index.js'`. This applies in all `.ts` source files across both packages.

**Warning signs:** Bare relative imports like `from './config'` or `from '../types/timeline'` without `.js`.

### Pitfall 3: Phantom Dependencies via pnpm Hoisting

**What goes wrong:** If `packages/cli/src/` imports a package only declared in `packages/core/package.json`, it works locally (pnpm store is shared) but fails for external consumers who install only `buildstory` CLI.

**Why it happens:** pnpm's content-addressable store makes all installed packages accessible on disk even without explicit declaration.

**How to avoid:** Every `import` in a package must correspond to an entry in that package's own `dependencies` or `devDependencies`. Run `pnpm install --frozen-lockfile` in CI with a clean environment to catch this.

**Warning signs:** Importing `smol-toml` in CLI without it in CLI's `package.json`; importing `zod` in CLI without declaring it.

### Pitfall 4: ESLint Flat Config Scope Misconfiguration

**What goes wrong:** The boundary rule `files: ['packages/core/src/**/*.ts']` glob does not match files in the way ESLint resolves relative paths from the config file location. The rule appears to apply but never fires.

**Why it happens:** ESLint flat config glob paths are relative to the config file location. A config at project root uses paths relative to root, which should work — but glob negation and deep patterns need careful testing.

**How to avoid:** After writing the ESLint config, manually test it: add a `import { readFileSync } from 'fs'` to `packages/core/src/index.ts` and run `eslint packages/core/src/index.ts`. Verify it errors. Remove the test import.

**Warning signs:** `eslint packages/core/src/` produces no output when there is a known violation.

### Pitfall 5: Zod v4 Import Paths Changed

**What goes wrong:** Zod v4 changed some import paths compared to v3. Code copied from v3 examples (`import { z } from 'zod/v4'` etc.) or incorrect assumptions about the v4 API surface will fail.

**Why it happens:** Zod v4 was a major release with internal restructuring.

**How to avoid:** Use only `import { z } from 'zod'` as the entry point. For v4-specific features (`.brand()`, `.meta()`, etc.) consult current Zod v4 docs. Do not use `zod/v3` compatibility shims.

**Warning signs:** Import paths other than `'zod'` as the module specifier.

---

## Code Examples

### pnpm-workspace.yaml

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
```

### Root package.json (workspace root)

```jsonc
// package.json (root — NOT "type": "module")
{
  "name": "build-story",
  "private": true,
  "scripts": {
    "build": "pnpm --filter '@buildstory/core' build && pnpm --filter 'buildstory' build",
    "test": "pnpm --filter '*' test",
    "lint": "eslint packages/*/src",
    "format": "prettier --write .",
    "clean": "pnpm --filter '*' exec -- rm -rf dist"
  },
  "devDependencies": {}
}
```

### Verifying the ESLint Boundary Rule Works

```bash
# After setting up ESLint, smoke-test the boundary rule:
# 1. Add a violation temporarily to packages/core/src/index.ts:
#    import { readFileSync } from 'fs'
# 2. Run ESLint against it:
pnpm eslint packages/core/src/index.ts
# 3. Expect: error on the fs import
# 4. Remove the test import
```

### Verifying `buildstory run` Works End-to-End

```bash
# After building both packages:
pnpm build

# Install CLI globally or use pnpm exec:
node packages/cli/dist/index.js run .

# Expected output (stub):
# ✓ Scan complete
# ✓ Narration complete
# ✓ Render complete

# Or via pnpm bin linking (after pnpm install):
pnpm --filter buildstory exec buildstory run .
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| fluent-ffmpeg for FFmpeg orchestration | child_process.spawn directly | May 2025 (fluent-ffmpeg archived) | Phase 4 must use spawn; do not install fluent-ffmpeg |
| Turborepo for monorepo task orchestration | pnpm --filter scripts (for small monorepos) | Decision D-04 | No turbo.json needed; pnpm scripts sufficient for 2 packages |
| tsup CJS+ESM dual output | ESM-only for core | Decision D-01 | Simpler tsup config; remark/unified compatibility |
| TSConfig `module: "CommonJS"` | `module: "NodeNext"` | Decision D-03 | Enforces .js extensions; catches module resolution issues early |

**Deprecated/outdated (do not use):**
- `@iarna/toml`: Last release 2021, TOML 0.5 only. Use smol-toml.
- `ts-jest`: No reason to exist when Vitest is available.
- `yargs`: More configuration surface for no benefit at 4-subcommand scope.
- `fluent-ffmpeg`: Archived May 2025.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ora and chalk are the correct versions from npm when installed without pinning | Standard Stack | Low — both are stable libraries; run `npm view ora version` before install |
| A2 | `no-restricted-globals` with `process` blocks both `process.env` access and bare `process` usage in core | Architecture Patterns (ESLint rule) | Medium — if it doesn't, add `'process'` to the `no-restricted-imports` patterns as well |
| A3 | ESLint flat config glob `packages/core/src/**/*.ts` resolves correctly from project root | Common Pitfalls | Medium — test with a known violation after setup |

---

## Open Questions

1. **ora and chalk exact versions**
   - What we know: Both are in decision D-06; both are popular stable packages
   - What's unclear: Current major versions not checked in this session
   - Recommendation: Run `npm view ora version` and `npm view chalk version` before the install task

2. **smol-toml type safety for config merge**
   - What we know: smol-toml returns `unknown` from `parse()`; casting to `BuildStoryConfig` is not type-safe
   - What's unclear: Whether Zod should validate the TOML output in Phase 1 or Phase 3
   - Recommendation: Add a lightweight Zod schema for `BuildStoryConfig` in `packages/cli/src/config.ts` and validate after parsing. This is Claude's discretion (no locked decision covering it).

3. **`bin` field and `chmod +x` for CLI dist file**
   - What we know: The CLI needs `#!/usr/bin/env node` shebang and executable permissions
   - What's unclear: tsup's `banner.js` injects the shebang; but `chmod +x` on dist/index.js may be needed for `pnpm link` to work
   - Recommendation: Add a `postbuild` script: `chmod +x dist/index.js` in `packages/cli/package.json`

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22 | All packages | Yes | v22.22.0 | — |
| pnpm | Monorepo | Yes | 10.31.0 | — |
| npm registry | Package install | Yes | (via npm view) | — |
| git | Version control | Yes (implicit — git repo exists) | — | — |

No external service dependencies in Phase 1 (no FFmpeg, no LLM APIs — those are in later phases).

---

## Security Domain

Applicable ASVS categories for Phase 1 (scaffold only):

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not applicable to scaffold |
| V3 Session Management | No | Not applicable to scaffold |
| V4 Access Control | No | Not applicable to scaffold |
| V5 Input Validation | Partial | smol-toml TOML parse + Zod schema on config output |
| V6 Cryptography | No | API keys in env vars; no key material in Phase 1 stubs |

### Known Threat Patterns for Phase 1

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key in buildstory.toml (committed to git) | Information Disclosure | Decision D-09: API keys via env vars only; document in CLI help; add buildstory.toml to .gitignore example |
| Path traversal via rootDir in ScanOptions | Tampering | Phase 2 concern; for Phase 1 stubs, rootDir is unused but type it as `string` — add validation in Phase 2 |
| Malformed TOML config crashing CLI | DoS | smol-toml throws on parse error — wrap loadConfig() in try/catch with a clear error message |

---

## Sources

### Primary (HIGH confidence)
- npm registry — all package versions confirmed via `npm view [pkg] version` on 2026-04-05 [VERIFIED]
- Node.js version confirmed via `node --version` [VERIFIED]
- pnpm version confirmed via `pnpm --version` [VERIFIED]
- `.planning/research/PITFALLS.md` — fluent-ffmpeg archived status, phantom dependency pattern [VERIFIED: file read]
- `.planning/research/STACK.md` — full library recommendations [VERIFIED: file read]
- `.planning/research/ARCHITECTURE.md` — project structure, unidirectional dependency pattern [VERIFIED: file read]
- `.planning/phases/01-scaffold/01-CONTEXT.md` — all locked decisions D-01 through D-12 [VERIFIED: file read]

### Secondary (MEDIUM confidence)
- TypeScript docs on NodeNext moduleResolution — `.js` extension requirement [CITED: typescriptlang.org/docs]
- ESLint flat config docs — file glob resolution behavior [CITED: eslint.org]

### Tertiary (LOW confidence)
- Zod v4 import path stability claim [ASSUMED: based on zod v4 release notes context]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via npm registry and local environment
- Architecture patterns: HIGH — sourced from project research files which were themselves sourced from official docs
- Pitfalls: HIGH — fluent-ffmpeg archive status sourced from PITFALLS.md with GitHub issue citation; other pitfalls sourced from project research

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable libraries; re-verify TypeScript and Zod major versions if planning is delayed beyond 30 days)
