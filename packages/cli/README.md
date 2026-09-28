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

`storyboard <story-arc.json>` creates an offline HTML editor for scene text,
ordering, inclusion, sources, and incremental Remotion TTS estimates. Open the
HTML and download edits to save them. `--stills` previews all scenes with installed
Chrome/Chromium; `--scene 2` previews only scene 2. No API credentials or FFmpeg
are needed. Use `--timeline` to refresh source matching and `--cache-dir` to point
to project output containing `audio/`. Config is discovered beside the input;
`--config` selects the original project settings. Its `--output` is an exact new
directory (default: `storyboard/` beside input), which must not already exist.
Regenerate after edits to refresh stills, reviews, pronunciation, and estimates.

Commands: `run`, `scan`, `narrate`, `render`, `storyboard`. See the
[monorepo README](https://github.com/johnzilla/build-story#readme) for full options,
configuration (`buildstory.toml`), and cost/data-safety notes.

## License

[MIT](./LICENSE)
