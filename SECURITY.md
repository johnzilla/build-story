# Security

## Supported versions

BuildStory is pre-1.0. Only the latest `main` (and the most recent tagged
release) receives security fixes.

## Reporting a vulnerability

Please report privately — do **not** open a public issue for a security problem.

Use GitHub's private vulnerability reporting: the repository's **Security** tab →
**Report a vulnerability**. That opens a private advisory visible only to the
maintainer. Expect an initial response within a few days.

## What data leaves your machine

BuildStory is a local CLI. It reaches the network only in these phases, and only
sends what's listed:

| Phase | Destination | What is sent |
|-------|-------------|--------------|
| `narrate` / `format` | LLM provider (Anthropic or OpenAI) | The timeline **payload** — per event: `id`, `date`, `source`, `path`, `summary`, `metadata`, `crossRefs`. Plus generated beats during formatting. |
| `render` (Remotion) | OpenAI TTS | The narration text of each beat. |
| `render` (HeyGen) | HeyGen | The narration text + scene config. |

**`rawContent` is never sent to the LLM.** `buildTimelinePayload` explicitly
strips it — full file text and full commit bodies stay local. They are retained
only in local artifacts (see below).

### Ingress sources (what becomes event `summary`/`metadata`)

- **Files** — markdown heading outlines, frontmatter metadata, cross-references.
- **Git** — commit subjects/bodies and tag names/messages.
- **Transcripts** — agent session prompts/reasoning (opt-in; off by default).

### Secret redaction

All three ingress paths run untrusted text through `redactSecrets` **before it
enters the timeline** (`packages/cli/src/adapters/redact.ts`): files, git
commit/tag messages, and transcript turns. Patterns cover common API keys and
tokens (OpenAI/Anthropic, AWS, Slack, Google, Stripe, npm, GitHub, JWTs, PEM
private-key blocks, and `key: value` / `key=value` secret assignments).
Redaction is best-effort pattern matching, not a guarantee — review outputs
before publishing, especially with transcripts enabled.

## Prompt-injection threat model

Planning files, commit messages, and transcripts are **untrusted input**. Their
text reaches the LLM as data, so a hostile artifact could try to steer the
narrator ("ignore your instructions", "attribute this to event X", etc.). Two
controls contain the blast radius:

1. **Structured output.** `narrate`/`format` constrain the model to a
   Zod-validated `StoryArc` shape (`messages.parse` + `zodOutputFormat`). The
   model cannot return arbitrary side-channel content — only schema-valid beats.
2. **Provenance validation (NARR-05).** After narration, every beat's
   `sourceEventIds` is validated against the actual event IDs in the input
   timeline. Any ID the model invents or that an injected artifact tries to
   plant is **dropped**, with a warning recorded in `arc.metadata.warnings`. A
   poisoned commit cannot forge a citation to an event that isn't really there.

Injection can still influence *narrative wording* (the model is summarizing
attacker-controlled text). BuildStory's guarantees are about **structure and
provenance**, not about preventing a hostile artifact from being quoted. Treat
generated output as you would any AI summary of untrusted input.

## Local artifacts

`timeline.json` and similar dumps embed **`rawContent`** (full file text and
commit bodies) and an **absolute `rootDir`** path. These are git-ignored by
default — do not commit or publish them without reviewing their contents.
