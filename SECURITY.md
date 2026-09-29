# Security

## Supported versions

BuildStory is pre-1.0. Security fixes target `main`; older revisions are not
maintained as separate security branches.

## Reporting a vulnerability

Please report privately — do **not** open a public issue for a security problem.

If enabled on the repository, use GitHub’s **Security** tab → **Report a
vulnerability**. Otherwise, arrange a private reporting channel with the
maintainer before sharing exploit details. This document does not promise a
response time.

## What data leaves your machine

The CLI scans local sources. Generation uses these network services:

| Phase | Destination | What is sent |
|-------|-------------|--------------|
| Narration and text formatting | Anthropic or OpenAI | Sanitized timeline fields except `rawContent`, extraction prompts, generated beats during synthesis/formatting, and authentication. |
| Remotion speech generation | OpenAI TTS | Narration text, model/voice/speed settings, and API authentication. |
| HeyGen rendering | HeyGen API | Narration, scene settings, API authentication, and job IDs for polling. A credential-check GET precedes CLI paid work. |
| HeyGen download | Video URL returned by HeyGen (which may be a CDN) | A GET request for the generated video; the HeyGen API-key header is not forwarded. |

Remotion rendering uses a local browser. Dependency installation and explicit
maintenance commands can also access the network; the table describes generation.

**Event `rawContent` is never sent to the LLM.** `buildTimelinePayload` strips
it, including when a timeline is imported from JSON. Summaries still contain
selected commit-body and transcript excerpts. Events can also include bounded
`excerpts` selected from file prose, commit messages, and human/agent transcript
messages; these are sent to the narrator and appear in payload previews. Outbound `rootDir` and
`sourceTimeline` use a project label instead of an absolute directory. Local
`cwd`, `rootDir`, and `homeDir` metadata fields are removed recursively;
recognizable absolute paths in text are replaced with `[LOCAL_PATH]`.

### Ingress sources (what becomes event `summary`/`metadata`)

- **Files** — markdown heading outlines, frontmatter metadata, cross-references,
  and bounded decision-related prose excerpts.
- **Git** — commit subjects/bodies and tag names/messages.
- **Transcripts** — bounded human prompts, session metadata, and selected
  human/agent message excerpts with speaker attribution (opt-in; off by default).
  Private thinking and tool calls/results are excluded from the excerpt field.

Each event has at most six extracted passages, capped at 400 Unicode characters
each after sanitization. Excerpt selection is a heuristic, and source text remains
untrusted. Section labels and locations provide context, not factual validation.
Imported excerpts are sanitized again at the outbound boundary. Excluding code or
frontmatter from excerpts does not remove metadata or headings from other fields.

### Secret redaction

All three ingress paths run untrusted text through `redactSecrets` **before it
enters the timeline** (`packages/core/src/privacy/redact.ts`, re-exported by
`packages/cli/src/adapters/redact.ts`): files, git
commit/tag messages, and transcript turns. Patterns cover common API keys and
tokens (OpenAI/Anthropic, HeyGen V2, Hugging Face, Telegram bots, AWS, Slack,
Google, Stripe, npm, GitHub, JWTs, PEM
private-key blocks, URL credentials, and `key: value` / `key=value` secret
assignments, including quoted JSON keys and quoted values with spaces/escapes).

URL credentials are removed from HTTP(S), Postgres/PostgreSQL, MySQL,
MongoDB (including `mongodb+srv`), Redis/Rediss, AMQP(S), and FTP(S) URLs.
The scheme and address remain; username/password userinfo becomes `[REDACTED]`.
Vendor token patterns are shape heuristics with minimum lengths, not validation
against a provider; unusual, shortened, or future formats may evade detection.

**Accepted query-parameter gap:** ordinary URLs are preserved. Existing token and
secret-assignment patterns catch some literal query values, but there is no
complete query parser or percent-decoding pass. Encoded names (such as
`%74oken`), generic `key`/`sig` parameters, and signed URLs can retain credentials.
Review and remove these URLs before generation or sharing; a sanitized URL is not
a guarantee that it is safe to publish.

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

### Offline storyboard review

`storyboard` produces a local HTML editor, sanitized arc, and source review in a
new owner-only directory. Optional stills use installed Chrome; neither the
editor nor the command calls a provider. Source text is embedded as escaped JSON
and inserted with DOM text/value APIs under a restrictive Content Security Policy.
Evidence strings and URLs are shown as text. Cached audio is copied for playback;
it and the story may still contain private project information.

Edits exist in browser memory until downloaded. Downloaded edits have not been
re-sanitized or re-reviewed by the CLI; regenerate the storyboard with the original
timeline to refresh review, then inspect it before sharing. Browser download
permissions follow the browser's settings. Source matching is not fact checking.

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

1. **Structured story arcs.** Extraction and synthesis return a Zod-validated
   `StoryArc`. The Anthropic and OpenAI providers use their respective structured
   response APIs. Text formats return ordinary text, not a StoryArc. Schemas
   constrain fields and types; free-text fields can still contain misleading
   claims or injected instructions.
2. **Provenance validation (NARR-05).** After narration, every beat's
   `sourceEventIds` is validated against the actual event IDs in the input
   timeline. Any ID the model invents or that an injected artifact tries to
   plant is **dropped**, with a warning recorded in `arc.metadata.warnings`. A
   citation to an existing event can still be incorrect: this check verifies
   that an ID exists, not that the event supports the claim. Beats with no valid
   IDs remain in the arc and require review.

Injection can still influence *narrative wording* (the model is summarizing
attacker-controlled text). These checks enforce the output shape and reject
unknown event IDs; they do not establish factual accuracy or prevent hostile text from being quoted. Treat
generated output as you would any AI summary of untrusted input.

## Local artifacts

`timeline.json` and similar dumps embed **`rawContent`** (full file text and
commit bodies) and an **absolute `rootDir`** path. Common dump names are ignored
by this repository’s `.gitignore`; custom filenames and other repositories may
not exclude them. Review local artifacts before committing or publishing them.

## Dependency review — September 26, 2026

The item 3 audit recorded zero vulnerabilities with no ignored advisories.
Security overrides set patched version floors while retaining compatible major
versions. Re-run the audit when updating dependencies; this result is a snapshot.

| Dependency | Resolution | Exposure and action |
| --- | --- | --- |
| `fast-uri` | 3.1.8 | Arrives through Remotion's bundler → webpack → Ajv. Updated past the 3.1.6 fixes for host-normalization advisories. BuildStory does not use it directly for URL allowlisting. |
| `js-yaml` | 3.15.2 / 4.3.2 | YAML parsing is used by release tooling and, through gray-matter, artifact parsing. Updated both major branches for the empty-merge CPU exhaustion advisory. |
| `extract-zip` | Removed | Remotion packages upgraded together from 4.0.446 to 4.0.529. Removed the previous GHSA-jmr9-qjv8-65gv audit exception. |

References: [fast-uri advisory](https://github.com/advisories/GHSA-5jgf-p345-68v8),
[js-yaml advisory](https://github.com/advisories/GHSA-2883-xcg3-v3hh),
[extract-zip advisory](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3).

### Remaining vendored archive risk and mitigation

Remotion 4.0.529 includes its own ZIP extractor in
`@remotion/renderer/dist/browser/extract-zip-archive.js`. A local fixture with
a symlink entry followed by a regular file of the same name confirmed that it
can write outside the extraction directory. The fixture wrote only a harmless
marker inside a dedicated temporary review directory. Registry audits do not
identify this vendored implementation as the removed `extract-zip` package.

BuildStory's `renderVideo` now requires an installed Chrome/Chromium, using an
explicit option or local browser discovery. It passes the resulting path to
both `selectComposition` and `renderMedia`, and fails before bundling if no
browser is installed. Consequently these BuildStory paths do not invoke
Remotion's automatic browser download/extraction. Regression tests cover both
explicit and discovered browsers, plus the missing-browser failure.

This mitigates the reachable BuildStory path; it does not repair Remotion's
extractor. Direct use of Remotion's browser-download APIs remains outside this
protection. Install browsers from trusted sources. Reassess this mitigation
on the next Remotion upgrade and by October 26, 2026 before re-enabling any
automatic browser downloads. No new audit suppression was added.
