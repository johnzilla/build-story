# Phase 5: HeyGen Package - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold the `@buildstory/heygen` workspace package with VideoRenderer interface, API key configuration, preflight validation, cost estimation, and dry-run support. No HeyGen API credits should be spent before the user has verified intent. The existing Remotion pipeline remains untouched.

</domain>

<decisions>
## Implementation Decisions

### Renderer Dispatch
- **D-01:** Use `--renderer=heygen` CLI flag and `[video] renderer = "heygen"` in `buildstory.toml` to select HeyGen. Default remains `remotion`.
- **D-02:** Simple if/else branch in `render.ts` — no plugin registry, no renderer abstraction beyond a conditional import.
- **D-03:** Same lazy-install prompt pattern as Remotion. `ensureHeyGenPackage()` mirrors `ensureVideoPackage()` in `lazy.ts`.

### Cost Display
- **D-04:** Show both credits and USD estimate: `~5 credits (~$4.95 estimated)`. This gives users HeyGen's native billing unit alongside real cost.
- **D-05:** Use the same display position as existing TTS cost — printed before any API call, after preflight passes.

### Default Avatar/Voice
- **D-06:** Avatar and voice IDs are required configuration. If not set, preflight fails with an actionable error: "No avatar_id configured. See https://docs.heygen.com/reference/list-avatars-v2 for available avatars."
- **D-07:** No built-in default avatar/voice. Discovery commands (`list-avatars`, `list-voices`) are deferred to v1.2 — error message points to HeyGen docs/dashboard until then.

### Dry-Run Output
- **D-08:** Minimal output matching Remotion's pattern — just the cost estimate line. Keep `--dry-run` consistent across renderers.

### Claude's Discretion
- VideoRenderer interface shape — Claude can design the interface contract based on what both renderers need
- Package scaffold details (tsup config, tsconfig, package.json structure) — follow existing `@buildstory/video` patterns
- Zod schema design for HeyGen API responses
- Error message wording (beyond the avatar/voice discovery hint specified in D-06)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Renderer Patterns
- `packages/cli/src/commands/render.ts` — Current render command; the if/else dispatch goes here
- `packages/cli/src/lazy.ts` — Lazy install pattern to mirror for HeyGen
- `packages/cli/src/config.ts` — Config loading with deep merge; extend `BuildStoryConfig` with `video.renderer` and `[heygen]` section
- `packages/video/src/preflight.ts` — Preflight check pattern (`{ ok, failures }`) to replicate
- `packages/video/src/index.ts` — Public API surface pattern for the new package

### Research
- `.planning/research/STACK.md` §v1.1 Addendum — HeyGen API endpoints, request/response shapes, authentication
- `.planning/research/ARCHITECTURE.md` §HeyGen Renderer Integration — Package structure, data flow, build order
- `.planning/research/FEATURES.md` §SECTION 2 — Feature priorities, API workflow, avatar types, cost model
- `.planning/research/PITFALLS.md` §HeyGen Integration Pitfalls — Polling gotchas, character limits, rate limit error codes

### Core Types
- `packages/core/src/types/story.ts` — StoryArc and StoryBeat schemas consumed by the adapter

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PreflightResult` interface in `packages/video/src/preflight.ts` — same `{ ok, failures }` pattern for HeyGen preflight
- `estimateTTSCost()` in `packages/video/src/tts/index.ts` — cost estimation display pattern to follow
- `ensureVideoPackage()` in `packages/cli/src/lazy.ts` — lazy install pattern to clone for HeyGen
- `loadConfig()` in `packages/cli/src/config.ts` — deep merge pattern; add `video` and `heygen` sections

### Established Patterns
- Config is parsed in CLI, passed as typed objects to packages — core/video/heygen never read TOML
- API keys always from `process.env`, never from config files
- Dynamic `import()` for optional packages after install check
- `ora` spinners for progress, `chalk` for colored output
- Zod schema validation for all external data (LLM responses, story arc JSON)

### Integration Points
- `packages/cli/src/commands/render.ts` — Add renderer branch after lazy install
- `packages/cli/src/commands/run.ts` — Same renderer dispatch for the full pipeline command
- `packages/cli/src/config.ts` — Extend `BuildStoryConfig` interface
- `packages/cli/src/lazy.ts` — Add `ensureHeyGenPackage()` function
- `pnpm-workspace.yaml` — Register new `packages/heygen` workspace

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following existing codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

- Avatar/voice discovery commands (`buildstory heygen list-avatars`, `list-voices`) — deferred to v1.2 (CLI-11)
- `--avatar` and `--voice` per-run CLI flag overrides — deferred to v1.2 (CLI-10)

</deferred>

---

*Phase: 05-heygen-package*
*Context gathered: 2026-04-14*
