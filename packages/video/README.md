# @buildstory/video

Remotion video rendering and OpenAI TTS for [BuildStory](https://github.com/johnzilla/build-story)
narrative scripts. **ESM-only.**

```ts
import { renderVideo, orchestrateTTS, estimateTTSCost, preflightCheck } from '@buildstory/video'
import { TTS_PRICE_PER_1000_CHARS } from '@buildstory/video/pricing'
```

Turns a `StoryArc` into a narrated MP4 using per-scene TTS and a Remotion
composition. It also writes a separate SRT, with one cue per beat; subtitles are
not burned into the MP4. Narration uses beat summaries, not `video-script.md`.

Long narration is split into requests of at most 3,900 characters, preferring
sentence or whitespace boundaries and preserving Unicode characters. Each
response is decoded to PCM before the chunks are joined into one scene WAV.
The complete narration remains in the scene and SRT; budget checks apply to
every speech request, and payload previews list every chunk.

## Recovery

Scene filenames use a SHA-256 key derived from outbound narration, voice, speed,
model, and encoding version. Beat positions are excluded, so unchanged narration
survives reordering; identical scenes and chunks share work within an invocation.

Cached WAVs must contain complete 24 kHz, mono, 16-bit PCM data. Reuse validates
the structure and any recorded checksum, then computes duration from PCM bytes.
A version-2 `audio/manifest.json` is saved atomically after each completed scene.
Write failures are surfaced. Missing or malformed metadata can be rebuilt from
intact WAVs; without a recorded checksum, recovery can only verify structure.

Each completed, validated speech chunk is retained in `audio/chunks/` with its
checksum metadata before the next chunk is requested. Final assembly uses these
chunks and publishes a validated scene atomically. Failures keep saved chunks
and any previous scene file. Interrupted requests or failed decodes before a
chunk is saved may still incur another request on retry.

Valid legacy scene files are migrated by matching their narration/settings hash,
regardless of the old beat index. Potentially truncated caches from before
long-narration splitting are not reused. Cache paths are derived locally;
metadata does not supply paths to arbitrary files.

Keep `audio/` to preserve recovery. Both scene files and chunks remain on disk;
there is no automatic pruning. Avoid concurrent invocations targeting the same
output directory. The cache is for interrupted-run recovery and reuse, not proof
that audio has never been deliberately modified alongside its metadata.

Requires **ffmpeg** and **ffprobe** on `PATH` (override with `FFMPEG_PATH` /
`FFPROBE_PATH`) and installed Chrome/Chromium for rendering. Automatic browser
downloads are disabled. `preflightCheck` checks prerequisites; direct library
callers should invoke it before paying for speech. Pass the discovered
`chromePath` as `renderVideo`’s `browserExecutable` option. This package ships its `src/`
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
