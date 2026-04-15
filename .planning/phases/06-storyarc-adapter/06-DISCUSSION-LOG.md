# Phase 6: StoryArc Adapter - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 06-storyarc-adapter
**Areas discussed:** Beat-to-color palette, Scene script content, Chunking behavior

---

## Beat-to-Color Palette

### Q1: What visual feel should the beat-type background colors convey?

| Option | Description | Selected |
|--------|-------------|----------|
| Narrative arc | Colors follow story energy: cool blues for setup, warm oranges for tension, greens for resolution | ✓ |
| Monochrome with accents | Dark background throughout with colored accent bar per beat type | |
| You decide | Claude picks a tasteful palette for avatar video backgrounds | |

**User's choice:** Narrative arc
**Notes:** Specific hex values agreed upon for all 9 beat types.

### Q2: Should the colors be the full-screen background or more subtle?

| Option | Description | Selected |
|--------|-------------|----------|
| Solid background | Full solid color behind avatar, uses HeyGen background_color field | ✓ |
| You decide | Claude picks based on HeyGen API support | |

**User's choice:** Solid background
**Notes:** None.

---

## Scene Script Content

### Q1: What text should the avatar narrate for each beat?

| Option | Description | Selected |
|--------|-------------|----------|
| Summary only | Beat summary field used directly as scene script | ✓ |
| Title + summary | Avatar says beat title first, then reads summary | |
| Contextual intro + summary | Avatar says beat-type intro, then reads summary | |

**User's choice:** Summary only
**Notes:** The LLM narrator already crafted the narration — no need to add layers.

### Q2: How should long beat summaries (>1500 chars) be handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Truncate with warning | Truncate at sentence boundary, include warning in adapter output | ✓ |
| Split into sub-scenes | Break long beat into multiple consecutive scenes with same color | |
| You decide | Claude picks based on how common long summaries are | |

**User's choice:** Truncate with warning
**Notes:** None.

---

## Chunking Behavior

### Q1: How should chunks relate to each other when splitting >10 beats?

| Option | Description | Selected |
|--------|-------------|----------|
| Clean split, separate videos | Each chunk produces independent video, caller concatenates post-download | ✓ |
| Overlap with transition beats | Last beat of chunk N repeats as first of chunk N+1 | |
| You decide | Claude picks simplest approach | |

**User's choice:** Clean split, separate videos
**Notes:** Keeps adapter pure. Phase 7 handles concatenation.

---

## Claude's Discretion

- Adapter function signature and return type
- Zod schema for adapter output
- Beat-to-color map storage format
- Test fixture design

## Deferred Ideas

None.
