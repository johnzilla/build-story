import { createHash } from 'node:crypto'
import { TimelineSchema } from '../types/timeline.js'
import type { Timeline, TimelineEvent } from '../types/timeline.js'
import type { GitSource } from '../types/git-source.js'

const ID_PREFIXES: Record<'file' | 'git-commit' | 'git-tag' | 'transcript', string> = {
  file: 'file',
  'git-commit': 'commit',
  'git-tag': 'tag',
  transcript: 'session',
}

/**
 * Deterministic event id: a 64-bit (16 hex chars) slice of the SHA-1 of
 * `source:path:date`. The prior 32-bit djb2 hash had a ~50% birthday-collision
 * chance around ~77k events and produced visible collisions far sooner on large
 * repos; 64 bits pushes that to ~5 billion, comfortably beyond any timeline.
 */
export function generateEventId(
  source: 'file' | 'git-commit' | 'git-tag' | 'transcript',
  path: string,
  date: string,
): string {
  const input = `${source}:${path}:${date}`
  const hash = createHash('sha1').update(input).digest('hex').slice(0, 16)
  return `${ID_PREFIXES[source]}-${hash}`
}

interface BuildTimelineInput {
  rootDir: string
  scannedAt: string
  fileEvents: Array<Omit<TimelineEvent, 'id'> & { id?: string }>
  gitSource?: GitSource | null
}

export async function buildTimeline(input: BuildTimelineInput): Promise<Timeline> {
  const { rootDir, scannedAt, fileEvents, gitSource } = input

  // 1. Assign IDs to file events that don't have them
  const eventsWithIds: TimelineEvent[] = fileEvents.map((evt) => {
    const id =
      evt.id ??
      generateEventId(
        evt.source as 'file' | 'git-commit' | 'git-tag' | 'transcript',
        evt.path ?? '',
        evt.date,
      )
    return { ...evt, id } as TimelineEvent
  })

  // 2. Fetch git tag events if gitSource is provided
  const tagEvents: TimelineEvent[] = []
  if (gitSource != null) {
    const tags = await gitSource.getTags()
    for (const tag of tags) {
      const id = generateEventId('git-tag', tag.name, tag.date)
      const summary = tag.message ? `${tag.name}: ${tag.message}` : tag.name
      tagEvents.push({
        id,
        date: tag.date,
        source: 'git-tag',
        summary,
        metadata: {},
        dateConfidence: 'exact',
        rawContent: tag.message,
        artifactType: 'git-tag',
        crossRefs: [],
      })
    }
  }

  // 3. Merge file events and tag events
  const allEvents: TimelineEvent[] = [...eventsWithIds, ...tagEvents]

  // 4. Sort chronologically by date (ascending)
  allEvents.sort((a, b) => a.date.localeCompare(b.date))

  // 5. Compute dateRange from events with dateConfidence 'exact' or 'estimated'
  const reliableEvents = allEvents.filter(
    (e) => e.dateConfidence === 'exact' || e.dateConfidence === 'estimated',
  )

  let dateRange: { start: string; end: string }
  if (reliableEvents.length === 0) {
    dateRange = { start: '', end: '' }
  } else {
    const dates = reliableEvents.map((e) => e.date).sort()
    dateRange = {
      start: dates[0] ?? '',
      end: dates[dates.length - 1] ?? '',
    }
  }

  // 6. Validate through TimelineSchema.parse() — throws on invalid data
  return TimelineSchema.parse({
    version: '1',
    rootDir,
    scannedAt,
    dateRange,
    events: allEvents,
  })
}
