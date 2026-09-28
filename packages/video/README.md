# @buildstory/video

Remotion video rendering and OpenAI TTS for [BuildStory](https://github.com/johnzilla/build-story)
narrative scripts. **ESM-only.**

```ts
import { renderVideo, orchestrateTTS, estimateTTSCost, preflightCheck } from '@buildstory/video'
import { TTS_PRICE_PER_1000_CHARS } from '@buildstory/video/pricing'
```

Turns a `StoryArc` into a narrated MP4 using per-scene TTS and a Remotion
composition. Estimated sentence captions are burned into the MP4 by default and
written to a separate SRT. Set render option `captions: false` for SRT only.
Narration uses optional beat `speechText`, falling back to `summary`; captions
retain summary spelling. The renderer does not speak `video-script.md`.

Long narration is split into requests of at most 3,900 characters, preferring
sentence or whitespace boundaries and preserving Unicode characters. Each
response is decoded to PCM before the chunks are joined into one scene WAV.
The complete narration remains in the scene and SRT; budget checks apply to
every speech request, and payload previews list every chunk.

## Evidence on screen

`displayText` supplies short on-screen copy; speech uses `speechText ?? summary`
and captions use readable summary text.
Older beats fall back to summary text. A typed `visual` can show source quotes,
code diffs, errors, architecture descriptions, alternative comparisons, or reported
outcomes. Panels take precedence over title/stats cards, so those defaults cannot
hide evidence. They include source citations, with matching excerpt locators where
available. Text is escaped by React; visuals never load URLs or execute markup.

Panels must have saved matches in `metadata.review` and still match the beat's
text and source IDs. Missing/stale matches fall back to ordinary layouts; malformed
visual schemas fail validation before rendering. To refresh edited panels, call
core `reviewStoryArc(arc, timeline)`. This checks source text, not semantic truth.
Changing display text or panels does not change speech or invalidate audio caches.

## Presentation

Captions split at sentence boundaries, then at up to 90 Unicode characters for
long sentences. Cues divide measured scene audio by text length; they are estimates,
not forced alignment. Very short audio merges cues to preserve positive durations.
The same `createCaptionCues` schedule drives the screen and SRT.

Scenes show chapter/position context. Evidence panels reveal sequentially; opening
and closing cards use existing beats and the editorial question where available.
IBM Plex Sans and Mono are bundled under the included SIL Open Font License.
Fonts load locally; unsupported characters can fall back to system fonts.
`FitText` measures after font loading, shrinks within readable limits, and cancels
rendering when text still overflows. Shorten display text or evidence to fix it.

`normalizeLoudness` defaults to true: two-pass FFmpeg normalization targets -16
LUFS, -1.5 dBTP, and LRA 11 on temporary render copies. Cached TTS files remain
unchanged. Silence is copied as-is; duration is capped at the original audio
length. Normalization is bounded to two concurrent jobs and a per-process deadline.
Set `normalizeLoudness: false` to keep original levels.

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
