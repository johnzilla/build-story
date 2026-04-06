import { TimelineSchema } from '../types/timeline.js'
import type { Timeline, TimelineEvent } from '../types/timeline.js'
import type { GitSource } from '../types/git-source.js'

// djb2 hash — deterministic, no crypto import needed
function djb2Hash(input: string): number {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ (input.charCodeAt(i) | 0)
    hash = hash >>> 0 // force unsigned 32-bit
  }
  return hash
}

export function generateEventId(
  source: 'file' | 'git-commit' | 'git-tag',
  path: string,
  date: string,
): string {
  const input = `${source}:${path}:${date}`
  const hash = djb2Hash(input)
  const prefix = source === 'file' ? 'file' : source === 'git-tag' ? 'tag' : 'commit'
  return `${prefix}-${hash.toString(16).padStart(8, '0')}`
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
      evt.id ?? generateEventId(evt.source as 'file' | 'git-commit' | 'git-tag', evt.path ?? '', evt.date)
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
