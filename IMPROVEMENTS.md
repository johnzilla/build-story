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
6. [ ] **Medium: unify video timing.** Use one frame schedule for scene starts,
   narration padding, captions, and total duration.
7. [ ] **Medium: preserve all narration.** Split oversized TTS input instead of
   truncating it; keep spoken text, captions, and visible text consistent.
8. [ ] **Medium: unify configuration and preflight.** Honor the exact config
   file, target repository, and outputDir; validate all fields; check prerequisites
   before paid work. Using the selected Chrome executable throughout rendering
   was completed with item 3.
9. [ ] **Medium: bound network and assembly work.** Apply deadlines through
   response-body consumption; test stalled downloads and multi-chunk FFmpeg
   assembly, including paths with spaces and apostrophes.
10. [ ] **Medium: strengthen TTS recovery.** Write completed audio atomically,
    validate cached files, persist progress incrementally, and reuse unchanged
    narration after scene reordering.

## Development stories and video quality

11. [ ] **Preserve decision evidence.** Extract bounded, redacted passages about
    problems, alternatives, choices, and outcomes instead of headings alone.
12. [ ] **Validate narrative claims and chronology.** Distinguish documented
    facts from inference, retain source links, surface unsupported beats, and
    disclose incomplete commit coverage and uncertain decision dates.
13. [ ] **Add editorial control.** Choose a central question, pivotal decisions,
    and target runtime; compress routine updates and preserve unresolved questions.
14. [ ] **Show evidence on screen.** Separate spoken narration from display text;
    implement validated visual cues for diffs, errors, architecture changes,
    alternative comparisons, and outcomes.
15. [ ] **Improve presentation.** Add sentence captions, chapter context,
    progressive reveals, bundled fonts, overflow checks, pronunciation controls,
    consistent loudness, and purposeful opening/closing scenes.
16. [ ] **Add storyboard review and scene previews.** Edit, reorder, and preview
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
- Next: item 6, consistent scene, narration, and caption timing.
