# Phase 5: HeyGen Package - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 05-heygen-package
**Areas discussed:** Renderer dispatch, Cost display format, Default avatar/voice, Dry-run output

---

## Renderer Dispatch

| Option | Description | Selected |
|--------|-------------|----------|
| Flag + config, simple if/else | --renderer=heygen flag or [video] renderer = "heygen" in buildstory.toml. Simple branch in render.ts. | ✓ |
| Separate commands | buildstory render-heygen vs buildstory render. Avoids branching but adds CLI surface area. | |
| You decide | Claude picks the approach that fits the existing codebase best | |

**User's choice:** Flag + config, simple if/else
**Notes:** None

### Follow-up: Lazy Install

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, same pattern | Consistent UX — prompt to install @buildstory/heygen deps on first use | ✓ |
| No, always available | HeyGen package is lightweight. Include it by default, no install prompt needed. | |
| You decide | Claude picks based on dependency weight | |

**User's choice:** Yes, same pattern

---

## Cost Display Format

| Option | Description | Selected |
|--------|-------------|----------|
| Credits + USD estimate | "~5 credits (~$4.95 estimated)" — shows both the HeyGen unit and approximate real cost | ✓ |
| USD only | "~$4.95 estimated" — consistent with existing TTS cost display | |
| Credits only | "~5 credits" — matches HeyGen's billing model but user doesn't know credit value | |

**User's choice:** Credits + USD estimate
**Notes:** None

---

## Default Avatar/Voice

| Option | Description | Selected |
|--------|-------------|----------|
| Error with discovery hint | Fail preflight with actionable error pointing to HeyGen docs | ✓ |
| Ship a sensible default | Pick a known stock avatar/voice as the default | |
| Fetch first available | Call GET /v2/avatars at runtime, use the first stock avatar | |

**User's choice:** Error with discovery hint
**Notes:** Discovery commands (list-avatars, list-voices) deferred to v1.2. Error message points to HeyGen docs/dashboard until then.

---

## Dry-Run Output

| Option | Description | Selected |
|--------|-------------|----------|
| Rich plan output | Scene count, char count, avatar ID, voice ID, credits, processing time | |
| Minimal (match Remotion) | Just the cost estimate line, same as existing Remotion dry-run | ✓ |
| You decide | Claude picks the level of detail | |

**User's choice:** Minimal (match Remotion)
**Notes:** Keep --dry-run consistent across renderers.

---

## Claude's Discretion

- VideoRenderer interface shape
- Package scaffold details (tsup, tsconfig, package.json)
- Zod schema design for API responses
- Error message wording (except D-06 discovery hint)

## Deferred Ideas

- Avatar/voice discovery commands — v1.2 (CLI-11)
- Per-run --avatar/--voice CLI overrides — v1.2 (CLI-10)
