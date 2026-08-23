# @buildstory/heygen

HeyGen avatar video rendering for [BuildStory](https://github.com/johnzilla/build-story)
narrative scripts. **ESM-only.**

```ts
import { renderWithHeyGen, estimateHeyGenCost, preflightHeyGenCheck } from '@buildstory/heygen'
```

Adapts a `StoryArc` into HeyGen scene chunks, submits and polls them, downloads
and concatenates the result. Hardened for the paid path: per-request timeouts,
retry on transient faults, content-keyed chunk resume, and an API-key preflight
that validates against a cheap endpoint before any paid submission.

See the [monorepo README](https://github.com/johnzilla/build-story#readme) for details.

## License

[MIT](./LICENSE)
