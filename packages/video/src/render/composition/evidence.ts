import type { StoryArc, StoryBeat, EvidenceVisual } from '@buildstory/core'

type ReviewBeat = NonNullable<StoryArc['metadata']['review']>['beats'][number]

/** Recheck saved matches so simple edits cannot silently keep stale evidence panels. */
export function evidenceForBeat(beat: StoryBeat, review: ReviewBeat | undefined): EvidenceVisual | undefined {
  if (!beat.visual || !review) return undefined
  return beat.visual.panels.every(panel => beat.sourceEventIds.includes(panel.sourceEventId) &&
    review.matchedEvidence.some(match => match.text === panel.text && match.eventIds.includes(panel.sourceEventId)))
    ? beat.visual : undefined
}

export function sourceCaption(eventId: string, review: ReviewBeat | undefined, text?: string): string {
  const source = review?.sources.find(source => source.eventId === eventId)
  if (!source) return eventId
  return [source.path ?? source.references.find(ref => ref.startsWith('Commit ')) ?? eventId,
    review?.matchedEvidence.find(match => match.text === text && match.eventIds.includes(eventId) && match.references?.length)?.references?.[0]].filter(Boolean).join(' · ')
}
