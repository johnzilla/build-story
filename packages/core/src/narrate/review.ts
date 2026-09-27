import { StoryArcSchema, type StoryArc } from '../types/story.js'
import type { Timeline, TimelineEvent } from '../types/timeline.js'
import { sanitizeStoryArc, sanitizeTimeline } from '../privacy/outbound.js'

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ').replace(/^["“](.*)["”]$/s, '$1')
}

function dateMeaning(event: TimelineEvent): string {
  if (!Number.isFinite(Date.parse(event.date))) return 'Invalid date; chronology unknown'
  if (event.dateConfidence !== 'exact') return `${event.dateConfidence} source date; decision date unverified`
  if (event.source === 'file') return 'Latest file commit date; not the date of each documented decision'
  if (event.source === 'transcript') return 'Session start; not the date of each decision or statement'
  return event.source === 'git-commit' ? 'Commit author date; not proof of decision time' : 'Tag date; not proof of decision time'
}

/** Local source matching only. Never treats a model's review as validation. */
export function reviewStoryArc(input: StoryArc, original: Timeline): StoryArc {
  const arc = sanitizeStoryArc(input)
  const timeline = sanitizeTimeline(original)
  const events = new Map(timeline.events.map(event => [event.id, event]))
  const warnings = [...(arc.metadata.warnings ?? []), ...(timeline.coverage?.warnings ?? ['Commit coverage is unknown (timeline has no coverage metadata).'])]
  const review: NonNullable<StoryArc['metadata']['review']> = { version: '1', beats: [] }
  let previousStart = -Infinity
  const beats = arc.beats.map((beat, beatIndex) => {
    const notes: string[] = []
    const sourceEventIds = [...new Set(beat.sourceEventIds)].filter(id => {
      if (events.has(id)) return true
      notes.push(`Unknown source event ID "${id}" removed.`)
      return false
    })
    const sources = sourceEventIds.map(id => events.get(id)!)
    if (!sources.length) notes.push('No valid sourceEventIds; this beat is unsupported.')
    const matchedEvidence: Array<{ text: string; eventIds: string[] }> = []
    const unmatchedEvidence: string[] = []
    for (const text of beat.evidence) {
      const quote = normalize(text)
      // Short fragments, paths, and redaction placeholders cannot establish support.
      const matches = quote.length >= 12 && !/\[(?:REDACTED|LOCAL_PATH)[^\]]*\]/i.test(quote)
        ? sources.filter(event => [event.summary, ...(event.excerpts ?? []).map(e => e.text)]
          .some(passage => normalize(passage).includes(quote))).map(event => event.id)
        : []
      if (matches.length) matchedEvidence.push({ text, eventIds: matches })
      else unmatchedEvidence.push(text)
    }
    if (!beat.evidence.length) notes.push('No evidence supplied; review the claims against sources.')
    if (unmatchedEvidence.length) notes.push(`${unmatchedEvidence.length} evidence item(s) could not be matched to cited summaries or excerpts; paraphrases also require review.`)
    if (beat.claimBasis === 'inference') notes.push('Model labels this beat as inference; verify the interpretation before publishing.')
    if (!beat.claimBasis) notes.push('Claim basis was not supplied; documented fact versus inference is unclassified.')
    for (const source of sources) {
      if (source.dateConfidence !== 'exact' || !Number.isFinite(Date.parse(source.date)) || source.source === 'file' || source.source === 'transcript') {
        notes.push(`${source.id}: ${dateMeaning(source)}.`)
      }
    }
    // Compare only precise commit/tag timestamps. Do not invent order from file mtimes or session starts.
    const dates = sources.filter(s => s.dateConfidence === 'exact' && (s.source === 'git-commit' || s.source === 'git-tag'))
      .map(s => Date.parse(s.date)).filter(Number.isFinite)
    if (dates.length) {
      const start = Math.min(...dates)
      const end = Math.max(...dates)
      if (end < previousStart) notes.push('Source dates precede an earlier beat; review narrative chronology.')
      previousStart = start
    }
    review.beats.push({
      beatIndex,
      status: beat.claimBasis === 'inference' ? 'inference' : notes.length ? 'needs-review' : 'source-matched',
      matchedEvidence, unmatchedEvidence,
      sources: sources.map(source => ({
        eventId: source.id, ...(source.path ? { path: source.path } : {}),
        date: source.date, dateMeaning: dateMeaning(source),
        references: [
          ...(typeof source.metadata['hash'] === 'string' ? [`Commit ${source.metadata['hash']}`] : []),
          ...(source.excerpts ?? []).map(excerpt => excerpt.locator.kind === 'lines'
          ? `Scanned lines ${excerpt.locator.startLine}-${excerpt.locator.endLine}${excerpt.truncated ? ' (truncated)' : ''}`
          : `${excerpt.locator.role} turn ${excerpt.locator.turnIndex}${excerpt.locator.timestamp ? ` at ${excerpt.locator.timestamp}` : ''}${excerpt.truncated ? ' (truncated)' : ''}`)],
      })),
      notes,
    })
    warnings.push(...notes.map(note => `Beat ${beatIndex + 1} "${beat.title}": ${note}`))
    return { ...beat, sourceEventIds }
  })
  return StoryArcSchema.parse({
    ...arc, beats,
    metadata: { ...arc.metadata, generatedAt: new Date().toISOString(), sourceTimeline: timeline.rootDir, warnings: [...new Set(warnings)], review },
  })
}

// Render untrusted titles/quotes as text rather than active Markdown links or HTML.
function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([\\`*_[\]#!|])/g, '\\$1').replace(/\r?\n/g, ' ')
}

export function renderSourceReview(arc: StoryArc): string {
  const lines = ['# Source review', '', 'Source matching checks quoted text against cited summaries and excerpts. It does not verify the truth of a source or whether it supports every claim in a summary. Claim basis is model supplied. Review narration before publishing; formatted prose and video speech are not independently fact checked.', '', '## Coverage and warnings', '']
  for (const warning of arc.metadata.warnings ?? []) lines.push(`- ${escape(warning)}`)
  if (!arc.metadata.review) lines.push('- No local source review is available. Re-narrate the timeline to generate one.')
  for (const entry of arc.metadata.review?.beats ?? []) {
    lines.push('', `## Beat ${entry.beatIndex + 1}: ${escape(arc.beats[entry.beatIndex]?.title ?? '')}`, '', `Status: ${entry.status}.`, '')
    for (const source of entry.sources) {
      lines.push(`- Source ${escape(source.eventId)}${source.path ? ` — ${escape(source.path)}` : ''}: ${escape(source.date)}. ${escape(source.dateMeaning)}.`)
      for (const ref of source.references) lines.push(`  - ${escape(ref)}`)
    }
    for (const match of entry.matchedEvidence) lines.push(`- Matched text (${match.eventIds.map(escape).join(', ')}): “${escape(match.text)}”`)
    for (const text of entry.unmatchedEvidence) lines.push(`- Unmatched evidence: “${escape(text)}”`)
    for (const note of entry.notes) lines.push(`- Review: ${escape(note)}`)
  }
  return lines.join('\n') + '\n'
}
