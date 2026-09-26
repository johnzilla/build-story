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

**Event `rawContent` is never sent to the LLM.** `buildTimelinePayload` strips
it, including when a timeline is imported from JSON. Summaries still contain
selected commit-body and transcript excerpts. Outbound `rootDir` and
`sourceTimeline` use a project label instead of an absolute directory. Local
`cwd`, `rootDir`, and `homeDir` metadata fields are removed recursively;
recognizable absolute paths in text are replaced with `[LOCAL_PATH]`.

### Ingress sources (what becomes event `summary`/`metadata`)

- **Files** — markdown heading outlines, frontmatter metadata, cross-references.
- **Git** — commit subjects/bodies and tag names/messages.
- **Transcripts** — agent session prompts/reasoning (opt-in; off by default).

### Secret redaction

All three ingress paths run untrusted text through `redactSecrets` **before it
enters the timeline** (`packages/core/src/privacy/redact.ts`, re-exported by
`packages/cli/src/adapters/redact.ts`): files, git
commit/tag messages, and transcript turns. Patterns cover common API keys and
tokens (OpenAI/Anthropic, AWS, Slack, Google, Stripe, npm, GitHub, JWTs, PEM
private-key blocks, URL credentials, and `key: value` / `key=value` secret
assignments, including quoted JSON keys and quoted values with spaces/escapes).

Outbound sanitization also runs before LLM extraction, synthesis, formatting,
OpenAI speech generation, and HeyGen scene construction. Nested sensitive
fields are redacted before serialization, so imported timelines and arcs do
not depend on having passed through the scanner. Narration, video text, and
subtitles use the same sanitization policy. Authentication credentials remain
available to the SDKs; they are not included in content previews.

Redaction and text-path detection are best-effort, not a guarantee of anonymity
or complete secret detection. Relative repository paths and ordinary web links
remain in the story. Review previews and outputs, especially with transcripts
enabled. Original input files are not rewritten by outbound sanitization.

### Offline payload previews

`run`, `narrate`, and `render` accept `--preview-payload <file>`. The command
writes a new file with owner-only permissions and exits without API calls,
authentication checks, or rendering. It refuses to overwrite existing files.

- `run` / `narrate`: sanitized system and user content for each extraction
  request, using the same chunking as narration. Later synthesis/formatting and
  speech requests depend on generated output and cannot be previewed at this stage.
- `render`: narration request bodies for the selected renderer. Missing HeyGen
  avatar/voice IDs use labeled placeholders. Authentication is omitted. TTS
  previews include every scene even if the real run can reuse cached audio.

Previews can still contain private project information. They are for local
review, not automatically safe to publish.

## Frontmatter parsing

Scanned documents may contain YAML (including `yaml`/`yml` labels) or JSON
frontmatter. Executable and unknown frontmatter languages contribute no
metadata. JavaScript frontmatter is disabled before parsing; malformed metadata
is ignored while the document's heading summary and cross-references remain
available.

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
