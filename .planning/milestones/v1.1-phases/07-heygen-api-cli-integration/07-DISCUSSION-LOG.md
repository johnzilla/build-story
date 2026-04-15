# Phase 7: HeyGen API + CLI Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 07-heygen-api-cli-integration
**Areas discussed:** Polling UX, Multi-chunk concatenation, Error handling and recovery

---

## Polling UX

### Q1: How should the CLI show progress while HeyGen renders?

| Option | Description | Selected |
|--------|-------------|----------|
| Spinner with status | ora spinner showing HeyGen status text, matches Remotion pattern | ✓ |
| Periodic log lines | New line every poll interval, better for CI | |
| You decide | Claude picks based on HeyGen API status returns | |

**User's choice:** Spinner with status
**Notes:** Matches existing Remotion render spinner pattern.

### Q2: What should the timeout exit message include?

| Option | Description | Selected |
|--------|-------------|----------|
| Video ID + manual check URL | Print video_id and direct URL to check status | ✓ |
| Video ID only | Just the ID, no URL | |
| You decide | Claude picks based on API | |

**User's choice:** Video ID + manual check URL
**Notes:** None.

---

## Multi-Chunk Concatenation

### Q1: How should multiple HeyGen videos be combined?

| Option | Description | Selected |
|--------|-------------|----------|
| FFmpeg concat | Download all chunks, concat with fluent-ffmpeg into one MP4 | ✓ |
| Separate files | Download as part-1.mp4, part-2.mp4 etc., no concat | |
| You decide | Claude picks | |

**User's choice:** FFmpeg concat
**Notes:** fluent-ffmpeg already a dependency via @buildstory/video.

### Q2: Should chunk MP4s be kept after concatenation?

| Option | Description | Selected |
|--------|-------------|----------|
| Clean up | Delete chunks after successful concat | ✓ |
| Keep in subfolder | Move to parts/ subdirectory | |
| You decide | Claude picks | |

**User's choice:** Clean up
**Notes:** Chunks are temporary artifacts.

---

## Error Handling and Recovery

### Q1: What should happen on HeyGen API errors?

| Option | Description | Selected |
|--------|-------------|----------|
| Fail fast with actionable message | Print error code/message, suggest checks, exit non-zero | ✓ |
| Retry once then fail | Wait 30s and retry once | |
| You decide | Claude picks based on error taxonomy | |

**User's choice:** Fail fast with actionable message
**Notes:** Most HeyGen errors aren't transient.

### Q2: Multi-chunk partial failure behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Stop and report | Stop submitting remaining chunks, report successes with video IDs | ✓ |
| Continue all, report at end | Submit all regardless, concat only successes | |
| You decide | Claude picks based on cost implications | |

**User's choice:** Stop and report
**Notes:** Prevents wasting credits on doomed runs.

---

## Claude's Discretion

- HeyGen v2 API client implementation details
- Exponential backoff parameters for polling
- FFmpeg concat method
- API client module location
- Temporary directory strategy for chunk downloads

## Deferred Ideas

None.
