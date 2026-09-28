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
- `reviewStoryArc(arc, timeline)` → locally reviewed `StoryArc` (no model calls)
- `renderSourceReview(arc)` → Markdown source review
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

`narrate` recomputes `metadata.review` after synthesis: it checks cited IDs,
matches evidence against cited summaries/excerpts, and flags uncertain dates and
reverse commit/tag chronology. A matching quote is not semantic fact checking.
`claimBasis` is the model's documented/inference classification; older beats
without it remain accepted and are flagged as unclassified. Provider response
schemas exclude the locally generated review. Existing warnings are preserved.

`Timeline.coverage` records commit count and limitations. Git adapters can expose
`getCommitWarnings()` after `getCommits()` to report shallow/capped/failed history
reads; adapters without it are marked as having unknown coverage. Coverage travels
through previews and all narration chunks. Old timelines are still accepted.

`NarrateOptions.editorial` accepts `centralQuestion`, `pivotalEventIds`,
`targetRuntimeSeconds` (integer, 10–3600), `compressRoutine`, and
`preserveOpenLoops`. `EditorialOptionsSchema` validates shape and bounds; narration
and previews reject IDs absent from the full timeline before extraction. Prompts
carry the sanitized brief through chunking and synthesis. Boolean controls default
to true only when a brief is supplied. No brief preserves existing behavior.

Narration saves the effective brief, word count, and runtime estimate in
`metadata.editorial`. Missing pivotal references and runtime estimates outside
20% of target (minimum five seconds) add warnings. Timing assumes 130 words/minute;
it is advisory, does not truncate narration, and adds no model calls. The source
review includes these details; actual duration comes from audio generation.

`StoryBeat.displayText` is optional short screen copy (maximum 240 characters),
separate from spoken `summary`. `EvidenceVisualSchema` defines an optional `visual`
with a known kind and one or two bounded, attributed text panels. Narration review
keeps only panels matched to cited summaries/excerpts, records their matches and
applicable locators, and warns when visuals are omitted. Code/error text matching
preserves whitespace. Raw content is not consulted or sent to generate panels.
After manual visual edits, run `reviewStoryArc` with the original timeline again.
Labels and source claims still require human review.

See the [monorepo README](https://github.com/johnzilla/build-story#readme) for the
full pipeline and CLI.

## License

[MIT](./LICENSE)
