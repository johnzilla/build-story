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

See the [monorepo README](https://github.com/johnzilla/build-story#readme) for the
full pipeline and CLI.

## License

[MIT](./LICENSE)
