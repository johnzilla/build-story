# Phase 4: Renderer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 04-renderer
**Areas discussed:** Narrative voice tuning, Visual style & scene design, Lazy install & preflight UX, TTS voice & pacing

---

## Narrative Voice Tuning

| Option | Description | Selected |
|--------|-------------|----------|
| Podcast casual | Like a dev friend telling you about their weekend project. Light humor, informal contractions, occasional jokes. | |
| Fireship energy | Fast-paced, punchy, slightly irreverent. Pop culture references OK. Very short sentences. | |
| Warm documentary | Kurzgesagt-style. Friendly but informative, not trying to be funny. Stakes and tension without sarcasm. | ✓ |

**User's choice:** Warm documentary
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Always "you" | Second-person throughout. Feels personal, works for solo devs. | |
| Name when available | Use git author name when found. Falls back to "you" if no git data. | |
| You decide | Claude picks based on whether git author data is available and consistent | |

**User's choice:** Other — "not sure about 'you'...the output shouldn't be me talking to myself. and solo devs and builders shouldn't always be 'we' or 'a team'"
**Notes:** Led to follow-up on narrative perspective.

| Option | Description | Selected |
|--------|-------------|----------|
| Third-person narrator | Narrator is an outsider telling the story. Uses git author name when available, project name as fallback. | |
| Project-as-protagonist | The project is the main character. Developer appears as supporting cast. | |
| Mix both | Project for big-picture moments, developer name for specific decisions. | ✓ |

**User's choice:** Mix both
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal | Warmth and personality, but no jokes. Tension and stakes carry the interest. | ✓ |
| Occasional wry observations | Not jokes, but a knowing tone. Maybe every 4-5 beats. | |
| You decide | Claude calibrates humor based on the content | |

**User's choice:** Minimal humor
**Notes:** None

---

## Visual Style & Scene Design

| Option | Description | Selected |
|--------|-------------|----------|
| Ship dark navy + warm red | The design doc's starting point. Dark, cinematic. Iterate after seeing real output. | ✓ |
| Softer/warmer tones | Dark charcoal + amber/gold. More approachable. | |
| You decide | Claude picks a cohesive palette | |

**User's choice:** Ship dark navy + warm red
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Always included | Every video opens with title and closes with stats. No config needed. | |
| Configurable | Include by default but allow --no-title-card and --no-stats-card flags. | ✓ |
| You decide | Claude determines based on complexity | |

**User's choice:** Configurable
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal motion | Fade in/out between scenes. Timeline bar fills left-to-right. No fancy transitions. | ✓ |
| Subtle but considered | Ease-in-out fades, smooth fill, text slides in gently. ~300ms transitions. | |
| You decide | Claude balances polish vs shipping speed | |

**User's choice:** Minimal motion
**Notes:** None

---

## Lazy Install & Preflight UX

| Option | Description | Selected |
|--------|-------------|----------|
| Prompt Y/n then install | Interactive prompt. Blocks until done. | ✓ |
| Auto-install silently | Just install it. Print progress but don't ask. | |
| Fail with install instructions | No auto-install. User runs command manually. | |

**User's choice:** Prompt Y/n then install
**Notes:** "I like #1, power users can opt to just take the text output and give it to their own render pipeline"

| Option | Description | Selected |
|--------|-------------|----------|
| Error with install guide | Clear error, user installs manually. | ✓ |
| Auto-install Chrome | Silently download Chrome via Puppeteer. | |
| You decide | Claude picks based on Remotion's ecosystem | |

**User's choice:** Error with install guide
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| All checks upfront | Check everything before any API calls. Single report. Fail fast. | ✓ |
| Check progressively | Check each dependency right before it's needed. | |
| You decide | Claude picks best error message approach | |

**User's choice:** All checks upfront
**Notes:** None

---

## TTS Voice & Pacing

| Option | Description | Selected |
|--------|-------------|----------|
| Nova at 1.15x (Recommended) | Warm, natural-sounding. Slightly faster. Configurable via buildstory.toml. | ✓ |
| Let users pick on first run | Print available voices and let them choose. | |
| You decide | Claude picks best voice for documentary tone | |

**User's choice:** Nova at 1.15x
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Global speed only | One speed for whole video. Configurable via buildstory.toml. | ✓ |
| Beat-type pacing | Obstacles/pivots slower, results faster. More cinematic. | |
| You decide | Claude determines based on API capabilities | |

**User's choice:** Global speed only
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| 0.3s between scenes only | As design doc specifies. No extra padding. | |
| Add 1s bookend silence | 1s before first scene, 1s after last. More polished. | ✓ |
| You decide | Claude picks based on what sounds natural | |

**User's choice:** Add 1s bookend silence
**Notes:** None

---

## Claude's Discretion

- Exact system prompt wording for "story" narrative style
- Font choice (Inter or system sans-serif)
- Remotion project structure within packages/video/
- Lazy install detection mechanism
- ffprobe/ffmpeg-static integration approach
- TTS chunking strategy (4096 char limit)
- Error message wording for preflight failures
- Remotion composition structure

## Deferred Ideas

- Per-beat-type TTS pacing — v2 polish
- Background music mixing — v2
- Custom visual themes — v2
- Live Build Radio — v2
- GitHub Wrapped — v2
- Remotion cloud rendering — v2
- ElevenLabs and Piper TTS — v2
