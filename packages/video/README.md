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

## Timing

`createFrameSchedule(manifest, fps)` supplies the boundaries used by scene
visuals, audio sequences, SRT cues, and composition duration. The default is
30 fps. Audio durations round up to whole frames so the final samples fit.
Each scene includes a 200 ms visual lead before narration, followed by the
configured gap (300 ms by default), or the closing bookend for the last scene.
The opening visual also covers the initial bookend. With the defaults, the
silence between narrations includes both the gap and the next scene's lead.

Manifest second offsets and total duration are derived from this schedule;
rendering recomputes them from audio durations and padding, so older cached audio
can be reused. Invalid durations, scene order, and beat/scene count mismatches
fail before rendering. Intermediate audio stays PCM; AAC is encoded once during
final MP4 assembly to preserve encoder-delay metadata.

For library callers, `generateSRT(beats, manifest, fps?)` now takes the full
`AudioManifest`, replacing the earlier scene-array argument. This ensures
caption generation has the same gap and bookend settings as rendering.

## License

[MIT](./LICENSE)
