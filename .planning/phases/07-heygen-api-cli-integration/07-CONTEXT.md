# Phase 7: HeyGen API + CLI Integration - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire `adaptStoryArc()` output into actual HeyGen v2 API calls — submit video generation requests, poll for completion with visible progress, download finished MP4s, and concatenate chunks for large arcs. Replace the Phase 7 placeholder in `render.ts` with the full end-to-end flow. The existing preflight, cost estimation, and dry-run paths remain unchanged.

</domain>

<decisions>
## Implementation Decisions

### Polling UX
- **D-01:** Use an `ora` spinner showing HeyGen's status text on each poll cycle (e.g., "Processing scene 3/8..."). Matches the existing Remotion render spinner pattern in `render.ts`.
- **D-02:** On timeout (default 600s from `HeyGenOptions.timeoutSeconds`), exit with a clear error including the HeyGen `video_id` and a direct URL to check status manually. Example: `Timeout after 600s. Video ID: abc123 — check status at https://app.heygen.com/videos/abc123`

### Multi-Chunk Concatenation
- **D-03:** When `AdaptResult.chunks` has multiple entries, submit each chunk sequentially (one at a time, not parallel — avoid rate limiting and simplify error handling), download each completed MP4, then concatenate all chunk MP4s into a single output file using `fluent-ffmpeg` (already a dependency via `@buildstory/video`).
- **D-04:** Delete individual chunk MP4 files after successful concatenation. User gets one clean final MP4. Chunks are temporary artifacts.

### Error Handling
- **D-05:** Fail fast with an actionable error message on HeyGen API errors (submission failure, invalid avatar, rate limit). No automatic retry — most HeyGen errors aren't transient. Print error code, error message, and suggest what to check.
- **D-06:** For multi-chunk arcs, if any chunk fails (submission error or poll timeout), stop submitting remaining chunks immediately. Report which chunks succeeded (with video IDs and downloaded files) and which failed. Keep downloaded MP4s for successful chunks so the user doesn't lose credits.

### Claude's Discretion
- HeyGen v2 API client implementation details (HTTP client choice, request/response handling)
- Exponential backoff parameters for polling (initial interval, max interval, jitter)
- FFmpeg concat method (demuxer concat vs filter complex — demuxer is simpler for same-codec files)
- Where the API client module lives within `packages/heygen/src/`
- Temporary directory strategy for chunk downloads before concat

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Code (Phase 7 integration points)
- `packages/cli/src/commands/render.ts` — The Phase 7 placeholder is at line 82. Replace the `process.exit(1)` block with actual submission. Preflight + cost estimation + dry-run already wired above it.
- `packages/cli/src/commands/run.ts` — Same renderer dispatch; should work once render.ts is complete
- `packages/heygen/src/index.ts` — Public API: `adaptStoryArc`, `preflightHeyGenCheck`, `estimateHeyGenCost`, types
- `packages/heygen/src/adapter.ts` — `adaptStoryArc()` returns `AdaptResult { chunks: HeyGenScene[][], warnings: string[] }`
- `packages/heygen/src/types.ts` — `HeyGenOptions`, `HeyGenScene`, `AdaptOptions`, `AdaptResult`

### Research (HeyGen API)
- `.planning/research/STACK.md` §v1.1 Addendum — HeyGen v2 API endpoints, request/response shapes, authentication headers
- `.planning/research/PITFALLS.md` §HeyGen Integration Pitfalls — Polling gotchas, character limits, rate limit error codes, video status values
- `.planning/research/FEATURES.md` §SECTION 2 — API workflow, video generation flow, status polling endpoint

### Prior Phase Context
- `.planning/phases/05-heygen-package/05-CONTEXT.md` — Renderer dispatch (D-02), lazy install (D-03), config patterns, default avatar/voice handling (D-06, D-07)
- `.planning/phases/06-storyarc-adapter/06-CONTEXT.md` — Chunking strategy (D-06, D-07), adapter return shape

### Core Types
- `packages/core/src/types/story.ts` — StoryArc, StoryBeat schemas

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ora` spinner in `render.ts` — same pattern for polling progress display
- `chalk` colored output — error messages, progress text
- `ensureHeyGenPackage()` in `packages/cli/src/lazy.ts` — lazy install already wired
- `fluent-ffmpeg` in `@buildstory/video` — available for concat (may need to import from video or use ffmpeg-static directly)
- `ffmpeg-static` — provides FFmpeg binary path

### Established Patterns
- Config parsed in CLI, passed as typed objects — heygen package never reads TOML
- API keys from `process.env` only, never config files
- Dynamic `import()` for optional packages after install check
- Zod schema validation for all external data
- Warnings returned in metadata objects, not console.warn (core purity)
- `render.ts` already has the if/else branch for heygen renderer with preflight + cost wired

### Integration Points
- `packages/cli/src/commands/render.ts` line 82 — Replace placeholder with submission + poll + download
- `packages/heygen/src/` — New API client module (`api.ts` or `client.ts`)
- `packages/heygen/src/index.ts` — Export new submission/polling functions

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following existing codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-heygen-api-cli-integration*
*Context gathered: 2026-04-15*
