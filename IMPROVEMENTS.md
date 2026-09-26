# Improvement checklist

Based on the September 26, 2026 review. Work through one item at a time, with
verification and a review point after each. The product goal is to tell the
story of the development process and explain the decisions behind it.

## Security

1. [x] **Critical: prevent execution of Markdown frontmatter.** Permit only
   data formats; verify that JavaScript, aliases, BOMs, and CRLF cannot execute
   code. Preserve ordinary YAML/JSON metadata and document the behavior.
2. [ ] **High: close outbound privacy gaps.** Cover quoted credential keys,
   imported timelines, and final outbound payloads. Remove unnecessary absolute
   paths and provide a payload preview.
3. [ ] **High: resolve dependency advisories.** Update affected dependency
   chains, assess reachability, and document any remaining accepted exceptions.

## Reliability and cost

4. [ ] **High: resume paid HeyGen jobs.** Persist submission IDs immediately;
   resume polling and downloads, handle ambiguous submissions, and include
   dimensions in cache identity.
5. [ ] **High: enforce spending controls per request.** Bound output, check
   every extraction/synthesis request, and separate actual spend from estimates
   and cached audio.
6. [ ] **Medium: unify video timing.** Use one frame schedule for scene starts,
   narration padding, captions, and total duration.
7. [ ] **Medium: preserve all narration.** Split oversized TTS input instead of
   truncating it; keep spoken text, captions, and visible text consistent.
8. [ ] **Medium: unify configuration and preflight.** Honor the exact config
   file, target repository, and outputDir; validate all fields; check prerequisites
   before paid work; use the selected Chrome executable throughout rendering.
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
- Next: item 2, outbound privacy and secret redaction.
