import { EditorialOptionsSchema, type EditorialOptions } from '../types/editorial.js'
import type { Timeline } from '../types/timeline.js'
import type { StoryArc } from '../types/story.js'
import { sanitizeOutboundValue } from '../privacy/outbound.js'

export function prepareEditorial(input: EditorialOptions | undefined, timeline: Timeline): EditorialOptions | undefined {
  if (input === undefined) return undefined
  const options = EditorialOptionsSchema.parse(input)
  const ids = new Set(timeline.events.map(event => event.id))
  for (const id of options.pivotalEventIds ?? []) {
    if (!ids.has(id)) throw new Error(`Editorial pivotal event ID "${id}" is not in the timeline. Use IDs from timeline.json.`)
  }
  return sanitizeOutboundValue({ ...options, pivotalEventIds: [...new Set(options.pivotalEventIds ?? [])],
    compressRoutine: options.compressRoutine ?? true, preserveOpenLoops: options.preserveOpenLoops ?? true })
}

export function editorialPrompt(options: EditorialOptions | undefined): string {
  if (!options) return ''
  return `\n## Editorial brief\n${JSON.stringify(options)}\n
Use this brief to organize the development story. The central question is a focus, not proof of its premise. Do not invent an answer, a decision, or an outcome to satisfy it.
Give pivotalEventIds space to explain the documented problem, alternatives, choice, and outcome. They designate sources to emphasize, not necessarily proven decisions. Keep their source IDs in the final arc.
When compressRoutine is true, group low-significance updates into concise transitions; do not give every commit equal time. When false, allow routine developments their own beats where useful.
When preserveOpenLoops is true, retain documented unresolved questions as open_loop beats and leave them unresolved. When false, they may be omitted for focus; never fabricate closure.
If targetRuntimeSeconds is supplied, budget the TOTAL spoken beat.summary text at about 130 words per minute (targetRuntimeSeconds * 130 / 60 words). Prefer fewer substantive beats over many tiny ones. duration_seconds alone cannot enforce runtime. Preserve accuracy and pivotal sources before length.
For a partial timeline chunk, include only pivotal IDs present in that chunk and treat runtime as the final story's total budget, not a quota for each chunk. During synthesis, apply the brief across all chunks and compress repetition.\n`
}

/** Advisory estimate only: actual speech timing is measured after TTS. */
export function applyEditorialReview(arc: StoryArc, options: EditorialOptions | undefined): StoryArc {
  if (!options) return arc
  const wordCount = arc.beats.reduce((total, beat) => total + beat.summary.trim().split(/\s+/).filter(Boolean).length, 0)
  const estimatedRuntimeSeconds = Math.round(wordCount * 60 / 130)
  const warnings = [...(arc.metadata.warnings ?? [])]
  const used = new Set(arc.beats.flatMap(beat => beat.sourceEventIds))
  for (const id of options.pivotalEventIds ?? []) {
    if (!used.has(id)) warnings.push(`Editorial brief: pivotal source "${id}" was omitted; revise the arc before publishing.`)
  }
  const target = options.targetRuntimeSeconds
  if (target !== undefined && Math.abs(estimatedRuntimeSeconds - target) > Math.max(5, target * 0.2)) {
    warnings.push(`Editorial runtime: estimated ${estimatedRuntimeSeconds}s versus target ${target}s at 130 words/minute. Actual TTS duration varies; narration was not truncated.`)
  }
  return { ...arc, metadata: { ...arc.metadata, warnings, editorial: { ...options, wordCount, estimatedRuntimeSeconds } } }
}
