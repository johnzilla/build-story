# @buildstory/video

Remotion video rendering and OpenAI TTS for [BuildStory](https://github.com/johnzilla/build-story)
narrative scripts. **ESM-only.**

```ts
import { renderVideo, orchestrateTTS, estimateTTSCost, preflightCheck } from '@buildstory/video'
import { TTS_PRICE_PER_1000_CHARS } from '@buildstory/video/pricing'
```

Turns a `StoryArc` into a narrated MP4: per-scene TTS (content-keyed resume so a
failed run never re-bills completed audio), a Remotion composition, and SRT
subtitles.

Requires **ffmpeg** and **ffprobe** on `PATH` (override with `FFMPEG_PATH` /
`FFPROBE_PATH`) and headless Chrome for rendering. This package ships its `src/`
because the Remotion bundler compiles the composition from source at render time.

See the [monorepo README](https://github.com/johnzilla/build-story#readme) for details.

## License

[MIT](./LICENSE)
