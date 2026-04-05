# Phase 1: Scaffold - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up the pnpm monorepo with `@buildstory/core` and `buildstory` CLI packages. Establish enforced package boundaries (ESLint rule on core), wire the end-to-end pipeline with typed stubs, and configure build tooling. Ship criterion: `buildstory run` executes and returns stub results through the full scan → narrate → render pipeline.

</domain>

<decisions>
## Implementation Decisions

### Build & Module System
- **D-01:** ESM-only for `@buildstory/core` — remark/unified ecosystem is ESM-only, no need for CJS until n8n wrapper (deferred)
- **D-02:** tsup as build tool — esbuild-based, handles ESM output and .d.ts generation, fast
- **D-03:** TypeScript `moduleResolution: "NodeNext"` — strictest resolution, requires .js extensions in imports, catches issues early
- **D-04:** pnpm scripts only for task running — no Turborepo. `pnpm --filter` and workspace scripts sufficient for 2-package monorepo

### CLI Framework
- **D-05:** Commander for CLI argument parsing — subcommand pattern built-in, TypeScript support, PRD-specified
- **D-06:** ora spinners + chalk for CLI output — spinner per phase, colored status messages
- **D-07:** Binary name: `buildstory` — matches project name, clear and discoverable

### Config Loading
- **D-08:** TOML-only configuration — `buildstory.toml` at project root, `~/.config/buildstory/config.toml` for global defaults. Project overrides global. Parsed with smol-toml.
- **D-09:** API keys via environment variables only — `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` from env. Never stored in config files.

### Pipeline Wiring
- **D-10:** Stub functions return typed empty objects — scan() returns empty Timeline with correct shape, narrate() returns empty Script. Validates types end-to-end at scaffold phase.
- **D-11:** Sequential await for `buildstory run` — run() calls scan(), passes result to narrate(), passes to render(). Simple and debuggable.
- **D-12:** Zod schemas from the start — define Zod v4 schemas alongside TypeScript types. Runtime validation at phase boundaries (scan output, narrate output).

### Claude's Discretion
- Exact tsconfig settings beyond moduleResolution (target, lib, strictness)
- Package.json workspace configuration details
- ESLint rule implementation specifics for core boundary enforcement
- Test framework setup (Vitest confirmed by research)
- Directory structure within packages (research provided detailed layout)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs
- `.planning/PROJECT.md` — Project vision, core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — INFRA-01 through INFRA-06 requirements for this phase
- `.planning/ROADMAP.md` — Phase 1 success criteria and requirement mappings

### Research
- `.planning/research/STACK.md` — Technology recommendations with versions (pnpm, tsup, Vitest, remark, simple-git, Zod v4, etc.)
- `.planning/research/ARCHITECTURE.md` — Monorepo structure, component boundaries, build order
- `.planning/research/PITFALLS.md` — ESM/CJS boundary trap, core boundary leakage prevention, pnpm phantom dependencies

### PRD
- `build-story-prd-v2.md` — Full architecture diagram, monorepo structure, core public API, TypeScript dependencies

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code beyond README.md

### Established Patterns
- None yet — this phase establishes them

### Integration Points
- None — this is the foundation phase

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Research provided a detailed monorepo structure in ARCHITECTURE.md and specific library versions in STACK.md that should be followed.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-scaffold*
*Context gathered: 2026-04-05*
