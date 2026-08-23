# @buildstory/cli

The command-line interface for [BuildStory](https://github.com/johnzilla/build-story) —
turn your development history into narrated video documentaries and shareable text,
from git commits, planning artifacts, and coding-agent transcripts.

Installing this package provides the **`buildstory`** command. (The bare npm name
`buildstory` belongs to an unrelated package, so the CLI is published as
`@buildstory/cli`.)

```bash
npm install -g @buildstory/cli
buildstory run ~/my-project              # scan → narrate → TTS → render
buildstory run ~/my-project --skip-video # text-only (no OpenAI key needed)
buildstory run ~/my-project --dry-run    # cost estimate, no API calls
```

Commands: `run`, `scan`, `narrate`, `render`. See the
[monorepo README](https://github.com/johnzilla/build-story#readme) for full options,
configuration (`buildstory.toml`), and cost/data-safety notes.

## License

[MIT](./LICENSE)
