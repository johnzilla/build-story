# @buildstory/cli

The command-line interface for [BuildStory](https://github.com/johnzilla/build-story) —
turn your development history into narrated video documentaries and shareable text,
from git commits, planning artifacts, and coding-agent transcripts.

The package name is **`@buildstory/cli`**, and its executable is **`buildstory`**.
The bare npm package name `buildstory` is unrelated. For source-checkout setup,
follow the [quick start](https://github.com/johnzilla/build-story#quick-start).
From the repository root after installing and building:

```bash
node packages/cli/dist/index.js run ~/my-project --dry-run
node packages/cli/dist/index.js run ~/my-project --skip-video
node packages/cli/dist/index.js run ~/my-project
```

Dry runs are offline. Text generation requires the selected narration provider’s
key. Remotion video additionally requires an OpenAI key, FFmpeg, FFprobe, and
installed Chrome/Chromium. HeyGen requires its own key, avatar/voice settings,
and FFmpeg.

`run` discovers config inside its target project. With no output override, it
writes to `<target>/buildstory-out/<project>/`. `narrate` and `render` discover
config beside their input JSON; use `--config` and `--output` explicitly when
continuing an earlier run. `--max-cost` is available only on `run`.

Commands: `run`, `scan`, `narrate`, `render`. See the
[monorepo README](https://github.com/johnzilla/build-story#readme) for full options,
configuration (`buildstory.toml`), and cost/data-safety notes.

## License

[MIT](./LICENSE)
