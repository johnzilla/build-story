# @buildstory/heygen

HeyGen avatar video rendering for [BuildStory](https://github.com/johnzilla/build-story)
narrative scripts. **ESM-only.**

```ts
import { renderWithHeyGen, estimateHeyGenCost, preflightHeyGenCheck } from '@buildstory/heygen'
```

Adapts a `StoryArc` into HeyGen scene chunks, submits and polls them, downloads
and concatenates the result. Hardened for the paid path: per-request timeouts,
retry on transient status faults, persistent paid job IDs, and an API-key preflight
that validates against a cheap endpoint before any paid submission.

Narration over 1,500 characters is split into additional scenes without dropping
text, and those scenes are packed into jobs of at most ten scenes each. Split
notices identify affected beats; previews show every resulting scene. Long
narration can therefore require more paid work than older truncated renders.

See the [monorepo README](https://github.com/johnzilla/build-story#readme) for details.

## Recovering a paid job

Rerun with the same story, settings, and output path. Each chunk has a private
`*.job.json` record in `<output>.parts/`. BuildStory records submission intent
before the POST and atomically saves the returned video ID before polling.
Reruns poll saved IDs and obtain fresh download URLs; completed downloads are
reused. Partial downloads are replaced. Failed provider jobs retain their IDs
and are never automatically submitted again.

Paid POST requests are never retried automatically. If a connection fails, a
response is malformed, or the process exits before saving the ID, the record
stays in `submitting` state. This also conservatively blocks rejected requests.
The error gives the exact recovery record path:

1. Stop other renders using this output and check the HeyGen account.
2. If the job exists, edit that record: preserve `version` and `key`, set
   `state` to `"submitted"`, and add `"videoId": "the-verified-id"`.
3. Only after confirming no job was created, remove that record to allow a new
   paid submission. For a failed provider job, resolve its billing/status before
   deliberately removing its record and paying for a replacement.

Records contain a request fingerprint and job ID, without API keys, narration,
or signed download URLs. Keep the parts directory until recovery is complete.
Changing narration, avatar, voice, speed, dimensions, or output path can require
new paid jobs. Legacy cached chunks omit dimensions; BuildStory stops and gives
instructions to verify and rename them rather than silently replacing them.
The parts directory is removed after successful assembly, so a later render
after success starts new work. This is interruption recovery, not a permanent
video archive. Avoid simultaneous renders to the same output; the exclusive
submission marker prevents duplicate POSTs while a new submission is in flight,
but does not serialize downloads or final assembly.

## License

[MIT](./LICENSE)
