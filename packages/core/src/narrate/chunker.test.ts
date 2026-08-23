import { describe, it, expect } from 'vitest'
import { groupByPhase, chunkTimeline } from './chunker.js'
import { buildTimelinePayload, estimateTokens, guardTokens } from './tokens.js'
import type { Timeline, TimelineEvent } from '../types/timeline.js'

const makeEvent = (overrides: Partial<TimelineEvent> & { id: string }): TimelineEvent => ({
  date: '2026-01-01',
  source: 'file',
  summary: 'Test event',
  metadata: {},
  dateConfidence: 'exact',
  rawContent: 'raw content here',
  ...overrides,
})

const makeTimeline = (events: TimelineEvent[]): Timeline => ({
  version: '1',
  rootDir: '/test',
  scannedAt: '2026-01-01T00:00:00Z',
  dateRange: { start: '2026-01-01', end: '2026-01-31' },
  events,
})

describe('groupByPhase()', () => {
  it('groups events with matching phase path under phase key', () => {
    const events = [
      makeEvent({ id: 'e1', path: '.planning/phases/01-scaffold/01-01-PLAN.md' }),
      makeEvent({ id: 'e2', path: '.planning/phases/02-scanner/02-01-PLAN.md' }),
    ]
    const result = groupByPhase(events)
    expect(result.get('01-scaffold')).toHaveLength(1)
    expect(result.get('01-scaffold')![0]!.id).toBe('e1')
    expect(result.get('02-scanner')).toHaveLength(1)
    expect(result.get('02-scanner')![0]!.id).toBe('e2')
  })

  it('puts events with no path into "ungrouped"', () => {
    const events = [
      makeEvent({ id: 'e1' }), // no path
    ]
    const result = groupByPhase(events)
    expect(result.get('ungrouped')).toHaveLength(1)
    expect(result.get('ungrouped')![0]!.id).toBe('e1')
  })

  it('puts events with path that does not match phase pattern into "ungrouped"', () => {
    const events = [
      makeEvent({ id: 'e1', path: 'README.md' }),
      makeEvent({ id: 'e2', path: 'some/other/path.md' }),
    ]
    const result = groupByPhase(events)
    expect(result.get('ungrouped')).toHaveLength(2)
  })

  it('groups multiple events from the same phase together', () => {
    const events = [
      makeEvent({ id: 'e1', path: '.planning/phases/01-scaffold/01-01-PLAN.md' }),
      makeEvent({ id: 'e2', path: '.planning/phases/01-scaffold/01-02-PLAN.md' }),
      makeEvent({ id: 'e3', path: '.planning/phases/02-scanner/02-01-PLAN.md' }),
    ]
    const result = groupByPhase(events)
    expect(result.get('01-scaffold')).toHaveLength(2)
    expect(result.get('02-scanner')).toHaveLength(1)
  })

  it('returns empty map for empty array', () => {
    const result = groupByPhase([])
    expect(result.size).toBe(0)
  })
})

describe('chunkTimeline()', () => {
  it('returns single-element array when total tokens fit within limit', () => {
    const events = [
      makeEvent({ id: 'e1', path: '.planning/phases/01-scaffold/01-01-PLAN.md', summary: 'short' }),
    ]
    const timeline = makeTimeline(events)
    // Very generous token limit
    const chunks = chunkTimeline(timeline, 100_000)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toEqual(timeline)
  })

  it('returns multiple chunks when total exceeds limit', () => {
    // Create events with large summaries across two phases
    const bigSummary = 'x'.repeat(500)
    const events = [
      makeEvent({ id: 'e1', path: '.planning/phases/01-scaffold/01-01-PLAN.md', summary: bigSummary }),
      makeEvent({ id: 'e2', path: '.planning/phases/01-scaffold/01-02-PLAN.md', summary: bigSummary }),
      makeEvent({ id: 'e3', path: '.planning/phases/02-scanner/02-01-PLAN.md', summary: bigSummary }),
      makeEvent({ id: 'e4', path: '.planning/phases/02-scanner/02-02-PLAN.md', summary: bigSummary }),
    ]
    const timeline = makeTimeline(events)
    // Very small token limit to force chunking
    const chunks = chunkTimeline(timeline, 100)
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('each chunk is a valid Timeline object with same version/rootDir/scannedAt', () => {
    const bigSummary = 'x'.repeat(500)
    const events = [
      makeEvent({ id: 'e1', path: '.planning/phases/01-scaffold/01-01-PLAN.md', summary: bigSummary }),
      makeEvent({ id: 'e2', path: '.planning/phases/02-scanner/02-01-PLAN.md', summary: bigSummary }),
    ]
    const timeline = makeTimeline(events)
    const chunks = chunkTimeline(timeline, 100)
    for (const chunk of chunks) {
      expect(chunk.version).toBe('1')
      expect(chunk.rootDir).toBe('/test')
      expect(chunk.scannedAt).toBe('2026-01-01T00:00:00Z')
    }
  })

  it('all original events are accounted for across chunks', () => {
    const bigSummary = 'x'.repeat(500)
    const events = [
      makeEvent({ id: 'e1', path: '.planning/phases/01-scaffold/01-01-PLAN.md', summary: bigSummary }),
      makeEvent({ id: 'e2', path: '.planning/phases/02-scanner/02-01-PLAN.md', summary: bigSummary }),
      makeEvent({ id: 'e3', path: '.planning/phases/03-narrator/03-01-PLAN.md', summary: bigSummary }),
    ]
    const timeline = makeTimeline(events)
    const chunks = chunkTimeline(timeline, 100)
    const allIds = chunks.flatMap((c) => c.events.map((e) => e.id))
    expect(allIds.sort()).toEqual(['e1', 'e2', 'e3'].sort())
  })

  // --- 2.7: commit-heavy timelines (commits have no phase → one giant group) ---

  /** A commit event as buildCommitEvents produces: substance in summary, no path. */
  const makeCommit = (i: number): TimelineEvent =>
    makeEvent({
      id: `commit-${i}`,
      source: 'git-commit',
      date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
      // Realistic commit payload: subject + body + a couple of changed files.
      summary:
        `feat(area-${i}): implement feature number ${i}\n\n` +
        `This commit does a moderately detailed thing worth narrating. `.repeat(4) +
        `\nFiles: src/module-${i}.ts, src/module-${i}.test.ts`,
      metadata: { insertions: i, deletions: i % 5, files: 2 },
    })

  it('splits a 300+ commit timeline into budget-fitting chunks without throwing (guard not spurious)', () => {
    const events = Array.from({ length: 320 }, (_, i) => makeCommit(i))
    const timeline = makeTimeline(events)
    const maxTokens = 8000 // small enough that 320 commits far exceed it

    // Whole timeline is well over budget...
    expect(estimateTokens(buildTimelinePayload(timeline))).toBeGreaterThan(maxTokens)

    // ...and chunking must produce several sub-chunks (commits share one phase group).
    const chunks = chunkTimeline(timeline, maxTokens)
    expect(chunks.length).toBeGreaterThan(1)

    // Every chunk fits the budget, so guardTokens never throws spuriously.
    for (const chunk of chunks) {
      const payload = buildTimelinePayload(chunk)
      expect(estimateTokens(payload)).toBeLessThanOrEqual(maxTokens)
      expect(() => guardTokens(payload, maxTokens)).not.toThrow()
    }

    // No events lost or duplicated.
    const ids = chunks.flatMap((c) => c.events.map((e) => e.id))
    expect(ids).toHaveLength(320)
    expect(new Set(ids).size).toBe(320)
  })

  it('preserves commit order across the sub-chunks', () => {
    const events = Array.from({ length: 300 }, (_, i) => makeCommit(i))
    const chunks = chunkTimeline(makeTimeline(events), 6000)
    const ids = chunks.flatMap((c) => c.events.map((e) => e.id))
    expect(ids).toEqual(events.map((e) => e.id))
  })
})
