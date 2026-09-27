# @buildstory/core

The core library of [BuildStory](https://github.com/johnzilla/build-story): reconstruct
a chronological development timeline and generate an LLM narrative script from git
history, planning artifacts, and coding-agent transcripts.

Filesystem, git, and transcript access are injected through `ArtifactSource`,
`GitSource`, and `TranscriptSource`. The library does not read CLI configuration
or write files. Its built-in Anthropic and OpenAI providers make network calls
for narration and text formatting; callers can inject their own provider. **ESM-only.**

```ts
import { scan, narrate, format, createProvider } from '@buildstory/core'
```

- `scan(source, options, gitSource?, transcriptSource?)` → `Timeline`
- `narrate(timeline, options, provider?)` → `StoryArc`
- `format(arc, formatType, provider)` → text (outline / thread / blog / video-script)

`TimelineEvent.excerpts` optionally carries up to six redacted source passages
about problems, alternatives, decisions, and outcomes, with section/line or
speaker/turn context. Extraction selects prose using English keywords; it excludes
code blocks, HTML blocks, and frontmatter. Transcript extraction uses user-visible
user/agent messages, excluding private thinking and tool records. The exported
`SourceExcerptSchema` and `EvidenceTopicSchema` describe the shape. Existing
version-1 timelines without excerpts remain valid.

Excerpt text is bounded to 400 Unicode characters during scanning and marked
when truncated. File/commit line ranges refer to scanned/normalized text, not a
pinned revision. These passages are included in narration payloads and previews;
`rawContent` is still omitted. Speaker attribution and source locations do not
verify whether a claim is true.

See the [monorepo README](https://github.com/johnzilla/build-story#readme) for the
full pipeline and CLI.

## License

[MIT](./LICENSE)
