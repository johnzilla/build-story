import { describe, it, expect, vi } from 'vitest'
import { reviewStoryArc, renderSourceReview } from '../narrate/review.js'
import { GeneratedStoryArcSchema, StoryArcSchema, type StoryArc, type StoryBeat } from '../types/story.js'
import { TimelineSchema, type Timeline, type TimelineEvent } from '../types/timeline.js'
import { buildTimeline } from '../scan/timeline-builder.js'
import { chunkTimeline } from '../narrate/chunker.js'
import { buildTimelinePayload } from '../narrate/tokens.js'
import { scan } from '../scan/index.js'
import type { ArtifactSource } from '../types/source.js'

const event: TimelineEvent = {
  id: 'c1', date: '2026-01-01T00:00:00Z', dateConfidence: 'exact', source: 'git-commit',
  summary: 'We chose SQLite because offline use matters.', metadata: { hash: 'abc123' }, rawContent: 'private raw-only content',
  excerpts: [{ text: 'The alternative required a server.', topics: ['alternative'], truncated: false, locator: { kind: 'lines', startLine: 4, endLine: 4 } }],
}
const timeline: Timeline = {
  version: '1', rootDir: '/private/project', scannedAt: '2026-01-02', dateRange: { start: event.date, end: event.date },
  events: [event], coverage: { commitCount: 1, warnings: [] },
}
const beat: StoryBeat = { type: 'decision', title: 'Offline storage', summary: 'SQLite was chosen.', evidence: [event.summary], sourceEventIds: ['c1'], significance: 2, claimBasis: 'documented' }
function arc(beats: StoryBeat[] = [beat]): StoryArc {
  return { version: '1', beats, metadata: { generatedAt: '', style: 'story', sourceTimeline: 'project' } }
}

describe('local source review', () => {
  it('matches quotes to cited sources and retains commit and line references without raw content', () => {
    const reviewed = reviewStoryArc(arc([{ ...beat, evidence: ['“We chose SQLite because offline use matters.”', 'The alternative required a server.'] }]), timeline)
    expect(reviewed.metadata.review?.beats[0]?.status).toBe('source-matched')
    expect(reviewed.metadata.review?.beats[0]?.matchedEvidence).toHaveLength(2)
    const report = renderSourceReview(reviewed)
    expect(report).toContain('Commit abc123')
    expect(report).toContain('Scanned lines 4-4')
    expect(report).toContain('does not verify the truth')
    expect(report).not.toContain('private raw-only')
    expect(report).not.toContain('/private/project')
  })
  it('cannot use uncited text, raw content, short fragments, placeholders, or unrelated source IDs as support', () => {
    const reviewed = reviewStoryArc(arc([{ ...beat, evidence: ['private raw-only content', 'SQLite', 'Unknown claim about speed', '[REDACTED]'], sourceEventIds: ['c1', 'fake'] }]), timeline)
    expect(reviewed.beats[0]?.sourceEventIds).toEqual(['c1'])
    expect(reviewed.metadata.review?.beats[0]?.unmatchedEvidence).toHaveLength(4)
    expect(reviewed.metadata.review?.beats[0]?.status).toBe('needs-review')
    const uncited = reviewStoryArc(arc([{ ...beat, sourceEventIds: [] }]), timeline)
    expect(uncited.metadata.review?.beats[0]?.matchedEvidence).toEqual([])
    expect(uncited.metadata.warnings?.join(' ')).toContain('unsupported')
  })
  it('recomputes supplied audits, keeps model warnings, and identifies inference even with matching quotes', () => {
    const input = reviewStoryArc(arc(), timeline)
    input.beats[0] = { ...beat, evidence: [], claimBasis: 'inference' }
    input.metadata.warnings = ['Source author disputes this result']
    const reviewed = reviewStoryArc(input, timeline)
    expect(reviewed.metadata.review?.beats[0]?.matchedEvidence).toEqual([])
    expect(reviewed.metadata.review?.beats[0]?.status).toBe('inference')
    expect(reviewed.metadata.warnings).toContain('Source author disputes this result')
  })
  it('accepts old schemas but does not silently classify old claims or coverage', () => {
    const { claimBasis: _basis, ...oldBeat } = beat
    const { coverage: _coverage, ...oldTimeline } = timeline
    const reviewed = reviewStoryArc(StoryArcSchema.parse(arc([oldBeat])), TimelineSchema.parse(oldTimeline))
    expect(reviewed.metadata.warnings?.join(' ')).toContain('unclassified')
    expect(reviewed.metadata.warnings?.join(' ')).toContain('coverage is unknown')
  })
  it('flags reverse chronology using instants, without reordering editorial beats', () => {
    const later = { ...event, id: 'c2', date: '2026-01-01T01:00:00-05:00' }
    const reviewed = reviewStoryArc(arc([{ ...beat, sourceEventIds: ['c2'] }, beat]), { ...timeline, events: [event, later] })
    expect(reviewed.beats[0]?.sourceEventIds).toEqual(['c2'])
    expect(reviewed.metadata.review?.beats[1]?.notes.join(' ')).toContain('chronology')
  })
  it.each([
    { source: 'file', dateConfidence: 'exact', date: event.date, expected: 'Latest file commit' },
    { source: 'transcript', dateConfidence: 'exact', date: event.date, expected: 'Session start' },
    { source: 'file', dateConfidence: 'estimated', date: event.date, expected: 'estimated source date' },
    { source: 'git-commit', dateConfidence: 'exact', date: 'invalid', expected: 'Invalid date' },
  ] as const)('discloses uncertain decision dates: $expected', ({ expected, ...data }) => {
    const reviewed = reviewStoryArc(arc(), { ...timeline, events: [{ ...event, ...data }] })
    expect(reviewed.metadata.review?.beats[0]?.notes.join(' ')).toContain(expected)
    expect(reviewed.metadata.review?.beats[0]?.status).toBe('needs-review')
  })
  it('sorts offsets by actual time and excludes invalid dates from date ranges', async () => {
    const later = { ...event, id: 'later', date: '2026-01-01T01:00:00-05:00' }
    const earlier = { ...event, id: 'earlier', date: '2026-01-01T03:00:00Z' }
    const result = await buildTimeline({ rootDir: 'project', scannedAt: '', fileEvents: [later, earlier, { ...event, id: 'invalid', date: 'bad' }] })
    expect(result.events.filter(e => e.id !== 'invalid').map(e => e.id)).toEqual(['earlier', 'later'])
    expect(result.dateRange).toEqual({ start: earlier.date, end: later.date })
  })
  it('preserves coverage in every chunk and outbound payload', () => {
    const input = { ...timeline, coverage: { commitCount: 15, warnings: ['Shallow history'] }, events: Array.from({ length: 15 }, (_, i) => ({ ...event, id: `c${i}` })) }
    const chunks = chunkTimeline(input, 450)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) expect(JSON.parse(buildTimelinePayload(chunk)).coverage).toEqual(input.coverage)
  })
  it('excludes local reviews from provider response schemas', () => {
    const reviewed = reviewStoryArc(arc(), timeline)
    expect(GeneratedStoryArcSchema.parse(reviewed).metadata).not.toHaveProperty('review')
  })
  it('escapes source content in review markdown', () => {
    const reviewed = reviewStoryArc(arc([{ ...beat, title: '<script>[click](file:///etc/passwd)' }]), timeline)
    expect(renderSourceReview(reviewed)).not.toContain('<script>')
    expect(renderSourceReview(reviewed)).not.toContain('[click](')
  })
})

describe('scan coverage', () => {
  const source: ArtifactSource = { readFile: vi.fn(), glob: vi.fn().mockResolvedValue([]), resolveRef: () => null }
  it('distinguishes disabled and unavailable commit sources', async () => {
    expect((await scan(source, { rootDir: '.', commits: { enabled: false } })).coverage?.warnings).toContain('Commit collection was disabled.')
    expect((await scan(source, { rootDir: '.' })).coverage?.warnings).toContain('Commit history is unavailable from this source.')
  })
  it('discloses source limitations and filters', async () => {
    const git = { getFileDate: async () => null, getTags: async () => [], getCommits: async () => [], getCommitWarnings: () => ['Shallow repository'] }
    const result = await scan(source, { rootDir: '.', commits: { since: '2026-01-01', paths: ['src'] } }, git)
    expect(result.coverage?.warnings.join(' ')).toContain('Shallow repository')
    expect(result.coverage?.warnings.join(' ')).toContain('Merge commits were excluded')
    expect(result.coverage?.warnings.join(' ')).toContain('since 2026-01-01')
    expect(result.coverage?.warnings.join(' ')).toContain('paths: src')
  })
})
