# @buildstory/core

The pure core of [BuildStory](https://github.com/johnzilla/build-story): reconstruct
a chronological development timeline and generate an LLM narrative script from git
history, planning artifacts, and coding-agent transcripts.

Zero I/O of its own — filesystem, git, and transcript access are injected
(`ArtifactSource` / `GitSource` / `TranscriptSource`), so the library stays free
of CLI, config, and vendor specifics. **ESM-only.**

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
