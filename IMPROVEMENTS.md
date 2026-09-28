# Improvement checklist

Based on the September 26, 2026 review. Work through one item at a time, with
verification and a review point after each. The product goal is to tell the
story of the development process and explain the decisions behind it.

## Security

1. [x] **Critical: prevent execution of Markdown frontmatter.** Permit only
   data formats; verify that JavaScript, aliases, BOMs, and CRLF cannot execute
   code. Preserve ordinary YAML/JSON metadata and document the behavior.
2. [x] **High: close outbound privacy gaps.** Cover quoted credential keys,
   imported timelines, and final outbound payloads. Remove unnecessary absolute
   paths and provide a payload preview.
3. [x] **High: resolve dependency advisories.** Update affected dependency
   chains, assess reachability, and document remaining risks and mitigations.

## Reliability and cost

4. [x] **High: resume paid HeyGen jobs.** Persist submission IDs immediately;
   resume polling and downloads, handle ambiguous submissions, and include
   dimensions in cache identity.
5. [x] **High: enforce spending controls per request.** Bound output, check
   every extraction/synthesis request, and separate actual spend from estimates
   and cached audio.
6. [x] **Medium: unify video timing.** Use one frame schedule for scene starts,
   narration padding, captions, and total duration.
7. [x] **Medium: preserve all narration.** Split oversized TTS input instead of
   truncating it; keep spoken text, captions, and visible text consistent.
8. [x] **Medium: unify configuration and preflight.** Honor the exact config
   file, target repository, and outputDir; validate all fields; check prerequisites
   before paid work. Using the selected Chrome executable throughout rendering
   was completed with item 3.
9. [x] **Medium: bound network and assembly work.** Apply deadlines through
   response-body consumption; test stalled downloads and multi-chunk FFmpeg
   assembly, including paths with spaces and apostrophes.
10. [x] **Medium: strengthen TTS recovery.** Write completed audio atomically,
    validate cached files, persist progress incrementally, and reuse unchanged
    narration after scene reordering.

## Development stories and video quality

11. [x] **Preserve decision evidence.** Extract bounded, redacted passages about
    problems, alternatives, choices, and outcomes instead of headings alone.
12. [x] **Validate narrative claims and chronology.** Distinguish documented
    facts from inference, retain source links, surface unsupported beats, and
    disclose incomplete commit coverage and uncertain decision dates.
13. [x] **Add editorial control.** Choose a central question, pivotal decisions,
    and target runtime; compress routine updates and preserve unresolved questions.
14. [x] **Show evidence on screen.** Separate spoken narration from display text;
    implement validated visual cues for diffs, errors, architecture changes,
    alternative comparisons, and outcomes.
15. [x] **Improve presentation.** Add sentence captions, chapter context,
    progressive reveals, bundled fonts, overflow checks, pronunciation controls,
    consistent loudness, and purposeful opening/closing scenes.
16. [x] **Add storyboard review and scene previews.** Edit, reorder, and preview
    scenes with their sources and incremental costs before a full render.
17. [ ] **Add offline video acceptance checks.** Render a small fixture with
    synthetic audio and verify caption timing, boundaries, overflow, and output
    validity. Add these checks alongside the rendering changes they validate.

## Progress

- Item 1 complete: allow only unlabeled YAML, yaml/yml, and JSON frontmatter;
  explicitly disable the JavaScript engine. Unsupported or malformed metadata
  is ignored. Added 13 regression cases and documented the behavior in SECURITY.md.
- Verification: 202 core tests and 73 CLI tests pass; core typecheck, repository
  lint, and core build pass. Local core build output now includes the fix.
- Item 2 complete: shared credential redaction covers quoted values and nested
  sensitive fields. Imported timelines/arcs and outbound LLM, TTS, and HeyGen
  content are sanitized; project labels replace absolute roots and local path
  metadata is removed. Added offline `--preview-payload <file>` to run, narrate,
  and render, with explicit preview scope and no network calls.
- Item 2 verification: all 382 tests pass, plus workspace build, typecheck,
  lint, and diff checks. Tests cover SDK boundaries, imported content, preview
  equivalence, no-key/no-network operation, and overwrite protection.
- Item 3 complete: upgraded Remotion packages together to 4.0.529, updated
  fast-uri and both js-yaml branches, removed extract-zip and its audit exception.
  Remotion's vendored ZIP extractor still permits writes through symlinks;
  BuildStory now requires an installed browser and supplies it to both renderer
  calls, avoiding automatic downloads/extraction. SECURITY.md records the risk.
  Fixed TypeScript import resolution in the composition bundle after the render
  smoke check exposed a failure.
- Item 3 verification: all 385 tests pass, plus workspace build, typecheck,
  lint, frozen-lockfile install, and diff checks. Audit reports zero advisories
  with none ignored. A real 1080p H.264/AAC render with synthetic audio completed.
- Item 4 complete: write an exclusive submission marker before each paid POST,
  save returned IDs atomically before polling, and resume existing jobs after
  polling/download failures. Uncertain outcomes block resubmission with manual
  recovery instructions. Cache fingerprints include dimensions; legacy chunks
  require verification before reuse. Job records omit credentials and narration.
- Item 4 verification: workspace build, typecheck, lint, and tests pass (402
  tests, including 75 HeyGen tests after the final recovery cases). Added 17
  cases covering real disk persistence, ambiguous responses, concurrent submit
  protection, disk failures, download/assembly recovery, dimensions, and legacy
  chunks. HeyGen requests and FFmpeg assembly were mocked; no paid calls made.
- Item 5 complete: shared budget reservations guard each extraction, synthesis,
  text format, TTS request, and new HeyGen submission. LLM output limits match
  the reservations; automatic SDK retries are disabled. Concurrent audio work
  reserves funds before sending and drains before failure reporting. Cached
  audio and saved HeyGen jobs incur no new reservation. Reports distinguish
  usage-based costs, estimates, and uncertain outcomes, including on failures.
- Item 5 verification: workspace build, typecheck, lint, all 419 tests, and diff
  checks pass. Added 17 tests for request boundaries, concurrency reservations,
  uncertain costs, resumed jobs, and CLI preservation/reporting. No paid calls
  made. The cap uses configured rates and conservative local estimates, not a
  guaranteed provider invoice ceiling; this limitation is documented.
- Item 6 complete: one frame schedule drives visuals, audio, captions, manifest
  offsets, and composition duration. It includes each scene's 200 ms audio lead,
  gaps, and bookends; audio durations round up to avoid clipped tails. Opening
  visuals cover the initial pause, and fades accommodate short scenes. SRT now
  accepts the full manifest. Final assembly encodes PCM directly to MP4/AAC,
  removing the ~43 ms offset measured with Remotion's raw AAC intermediate.
- Item 6 verification: workspace build/typecheck/lint/tests passed, followed by
  the final video build/typecheck, lint, and 44 video tests (434 tests total).
  Added 15 cases covering fractional durations, 200-scene schedules at 24/30/60
  fps, short/empty scenes, invalid inputs, shared boundaries, and final encoding.
  A real 1080p render has 142 frames and matching 4.733-second audio/video tracks;
  synthetic tone starts match SRT starts within 0.1 ms. Opening frame inspected.
  No paid calls made.
- Item 7 complete: shared splitting preserves every character, prefers sentence
  and whitespace boundaries, and avoids splitting surrogate pairs. OpenAI speech
  chunks stay within 3,900 characters and are decoded/joined into one scene WAV;
  HeyGen narration splits into scenes of at most 1,500 characters and jobs of
  at most ten scenes. Previews include every request and budgets gate each one.
  Full narration remains available to captions and visuals. Completed audio is
  published atomically; old potentially truncated long-scene caches regenerate,
  while short-scene caches remain compatible.
- Item 7 verification: workspace build, typecheck, lint, all 445 tests, and diff
  checks pass. Coverage includes long multilingual text, request/preview parity,
  budget stops, partial failures, cache migration, and HeyGen scene packing. A
  real FFmpeg check joined three synthetic MP3 responses into exactly 0.600 seconds
  of PCM audio using a path with spaces and an apostrophe. No paid calls made.
  Persisting completed chunks within an unfinished TTS scene remains for item 10.
- Item 8 complete: exact config-file selection, target/input-based discovery,
  field validation, and per-file path resolution now apply consistently across
  commands. Explicit output flags override configured directories. Normal runs
  check keys, output permissions, and renderer prerequisites before narration;
  previews and dry runs remain offline. Invalid browser overrides fail explicitly,
  and unavailable HeyGen credential verification blocks paid work.
- Item 8 verification: workspace build, typecheck, lint, and 476 tests pass.
  Coverage includes config precedence and paths, invalid fields, preflight order,
  output failures, browser propagation, offline dry runs, and unavailable HeyGen
  verification. No paid calls made.
- Item 9 complete: deadlines now cover HeyGen response bodies/download streams,
  narration SDK operations, and speech responses. Poll waits, retries, and status
  reads share the overall deadline. FFmpeg processing and probes are bounded;
  HeyGen assembly drains bounded diagnostics, honors FFMPEG_PATH, and uses safe
  relative concat entries. Failed downloads remove partial files; failed assembly
  preserves paid chunks and previous output, publishing atomically on success.
- Item 9 verification: workspace build, typecheck, lint, and all 490 tests pass.
  Added 14 cases for stalled bodies, poll deadlines, uncertain spend, assembly
  termination/diagnostics, and recovery. A real FFmpeg test joined two clips into
  a 0.4-second MP4 under a path with spaces and an apostrophe. No paid calls made.
- Item 10 complete: scene keys no longer include beat position; identical scenes
  and chunks share requests within a run. Reuse checks complete PCM structure
  and recorded SHA-256 checksums and derives duration from audio bytes. Each
  completed scene updates the manifest atomically, with write errors surfaced.
  Validated chunks persist across later request/budget/assembly failures. Legacy
  compatible scenes migrate by hash without trusting manifest paths; potentially
  truncated old long-scene caches regenerate.
- Item 10 verification: workspace build, typecheck, lint, and all 513 tests pass.
  Coverage includes reordering, duplicate requests, corrupted WAVs/checksums,
  missing metadata, interrupted scenes, manifest-write failures, and migration.
  A real FFmpeg test resumes synthetic MP3 responses after a failed second
  request and verifies the assembled PCM duration against FFprobe, using a path
  with spaces and an apostrophe. No paid calls made.
- Item 11 complete: optional source excerpts now accompany heading summaries,
  commit messages, and opt-in transcript events. Selection preserves up to six
  redacted prose passages of 400 Unicode characters each, balancing problem,
  alternative, decision, and outcome topics. Excerpts include scanned-line or
  attributed transcript-turn references and explicit truncation markers. Code,
  HTML blocks, frontmatter, private thinking, and tool records are excluded.
  Narration prompts use excerpts as untrusted source data; old timelines remain
  valid, and rawContent stays out of provider payloads.
- Item 11 verification: workspace build, typecheck, lint, and all 530 tests pass.
  Added 17 cases covering late rationale, topic coverage, Unicode bounds,
  redaction, source attribution, schema compatibility, and preview propagation.
  A real offline CLI preview preserved a decision's reason while excluding a
  synthetic secret and raw-only marker. No paid calls made. Extraction uses
  English keyword/heading heuristics; factual validation remains item 12.
- Item 12 complete: model-supplied documented/inference labels, local quote and
  source-ID checks, saved source-review.md, and explicit source-date meanings.
  Reviews preserve IDs, paths, commit hashes, and excerpt locators. Chronology
  checks flag reversed source dates without changing editorial order; timeline
  sorting/ranges now use real instants and exclude invalid dates from ranges.
  Coverage notes disclose current-HEAD scope, merge/date/path filters, caps,
  shallow repositories, unavailable/failed history, and legacy unknown coverage.
  Reports distinguish matching text from semantic truth; review is advisory and
  adds no paid calls. Manually edited arcs need a fresh review.
- Item 12 verification: workspace build, typecheck, lint, and all 547 tests pass.
  Added source-review and Git-coverage cases, including unsupported/missing
  evidence, inference labels, legacy input, timezone ordering, invalid dates,
  chunk propagation, report escaping, and shallow/failed/capped history. The
  budget-stop test verifies the report survives later request failures. A real
  offline CLI preview confirmed current-HEAD and cap disclosures with rawContent
  excluded. No paid calls made.
- Item 13 complete: optional editorial briefs set a central question, pivotal
  source IDs, and target spoken runtime. Config and run/narrate flags support
  field-level precedence; previews and narration use the same sanitized brief.
  Prompts compress routine updates and retain documented open loops by default
  when a brief is supplied, with explicit configuration to change either choice.
  Chunk synthesis receives the whole-story budget. Unknown IDs fail before paid
  extraction; omitted pivotal sources and runtime misses add review warnings.
  Saved metadata and source-review.md include the brief and a word-based duration
  estimate. Full narration is preserved; semantic choices and timing remain
  advisory and require review. Existing callers without a brief remain compatible.
- Item 13 verification: workspace build, typecheck, lint, and all 572 tests pass.
  Tests cover config/flag precedence, bounds, invalid pivotal IDs before paid
  calls, redaction, preview parity, chunk synthesis, runtime estimates, omitted
  pivotal sources, and compatibility without a brief. Real offline CLI previews
  for both run and narrate confirmed effective config, flag overrides, source
  selection, and target runtime. No paid calls made.
- Item 14 complete: optional short displayText is separate from spoken summaries.
  Typed evidence panels cover quotes, diffs, errors, architecture descriptions,
  alternatives, and reported outcomes. Local review requires source matches;
  unsupported panels are omitted with warnings. Remotion rechecks saved text/ID
  matches, displays source references and matching locators, and gives evidence
  precedence over bookend/stats cards. Markup stays literal and no assets are
  fetched. Diff/log text must already exist in shared source data; the scanner
  does not retrieve patches. HeyGen discloses its unsupported visual fields.
- Item 14 verification: workspace build, typecheck, lint, and all 593 tests pass.
  Added checks for source matching, raw-only/uncited evidence rejection, diff
  whitespace, panel bounds, correct excerpt locators, escaped markup, stale
  matches, layout priority, unchanged captions, and HeyGen disclosure. Six real
  1080p Remotion stills (one per visual kind) rendered using synthetic source
  material and local silent audio; each was visually inspected. No paid calls.
- Item 15 complete: estimated sentence captions share one screen/SRT schedule;
  chapters and scene positions provide context, evidence panels reveal in sequence,
  and opening/closing cards frame the question and remaining work. Bundled IBM
  Plex fonts include their license; text is measured after loading, shrinks within
  readable limits, and fails explicitly on unresolved overflow. Pronunciation
  dictionaries/manual speech text propagate through both renderers, previews,
  costs, and audio caches without changing readable captions or evidence. Remotion
  normalizes temporary audio with two FFmpeg passes and bounded concurrency;
  source caches remain untouched. Caption alignment is estimated, not forced.
- Item 15 verification: workspace build, typecheck, lint, and all 605 tests pass.
  Coverage includes caption boundaries/Unicode/short audio, pronunciation matching,
  cache reuse, both renderer previews, config validation, and real FFmpeg loudness
  and duration measurements. A real 1080p synthetic-audio render verified fonts,
  captions, chapter context, evidence reveals, opening/closing cards, overflow
  rejection, and matching audio/video duration. Rendered frames were inspected.
  Offline CLI dictionary previews passed for both renderers. A pre-existing
  recovery test now targets a named failed scene instead of assuming concurrent
  request order. No paid calls made.
- Item 16 complete: the offline storyboard command creates a standalone HTML
  editor for text, scene order, inclusion, source inspection, and edited arc
  downloads. Optional timeline review refreshes source matches and chronology.
  Incremental Remotion TTS estimates validate scene/chunk caches and count shared
  missing requests once. Cached speech can be played locally; optional Chrome
  stills use full-story layouts with audio disabled and measured/estimated timing.
  Existing review directories are refused. Edits require download and regeneration
  for refreshed stills, sources, pronunciation, and estimates. HeyGen preview and
  live rendering inside the editor are outside this feature.
- Item 16 verification: workspace build, typecheck, lint, and 619 tests pass.
  Added coverage for cache integrity, read-only estimates, duplicate speech,
  partial caches, settings/override identity, invalid scene selection, output
  protection, source-review refresh, inert markup, and silent full-context stills.
  A real offline Chrome run verified cached audio loading, a 1080p selected-scene
  still, editing/reordering/exclusion, updated costs, schema-valid exported JSON,
  and escaped hostile markup with no page errors. The editor and still were
  visually inspected. No paid calls made.
- Next: item 17, offline video acceptance checks.
