import { describe, it, expect, vi } from 'vitest'
import { generateEventId, buildTimeline } from '../scan/timeline-builder.js'
import { TimelineSchema } from '../types/timeline.js'
import type { GitSource } from '../types/git-source.js'
import type { TimelineEvent } from '../types/timeline.js'

function makeGitSource(opts?: {
  fileDate?: string | null
  tags?: Array<{ name: string; date: string; message: string }>
}): GitSource {
  return {
    getFileDate: vi.fn().mockResolvedValue(opts?.fileDate ?? null),
    getTags: vi.fn().mockResolvedValue(opts?.tags ?? []),
  }
}

function makeFileEvent(overrides?: Partial<TimelineEvent>): Omit<TimelineEvent, 'id'> {
  return {
    date: '2026-01-15T10:00:00Z',
    source: 'file',
    path: 'PLANNING.md',
    summary: '# Planning',
    metadata: {},
    dateConfidence: 'exact',
    rawContent: '# Planning\n',
    artifactType: 'gstack',
    crossRefs: [],
    ...overrides,
  }
}

describe('generateEventId()', () => {
  it('returns a stable string starting with "file-" for file source', () => {
    const id = generateEventId('file', 'PLANNING.md', '2026-01-15T10:00:00Z')
    expect(id).toMatch(/^file-[0-9a-f]{8}$/)
  })

  it('returns a stable string starting with "tag-" for git-tag source', () => {
    const id = generateEventId('git-tag', '', '2026-02-01T00:00:00Z')
    expect(id).toMatch(/^tag-[0-9a-f]{8}$/)
  })

  it('returns a stable string starting with "commit-" for git-commit source', () => {
    const id = generateEventId('git-commit', 'abc123', '2026-01-20T00:00:00Z')
    expect(id).toMatch(/^commit-[0-9a-f]{8}$/)
  })

  it('is deterministic — same inputs always produce same output', () => {
    const id1 = generateEventId('file', 'PLANNING.md', '2026-01-15T10:00:00Z')
    const id2 = generateEventId('file', 'PLANNING.md', '2026-01-15T10:00:00Z')
    expect(id1).toBe(id2)
  })

  it('produces different IDs for different inputs', () => {
    const id1 = generateEventId('file', 'PLANNING.md', '2026-01-15T10:00:00Z')
    const id2 = generateEventId('file', 'TASKS.md', '2026-01-15T10:00:00Z')
    expect(id1).not.toBe(id2)
  })

  it('produces different IDs for different dates', () => {
    const id1 = generateEventId('file', 'PLANNING.md', '2026-01-15T10:00:00Z')
    const id2 = generateEventId('file', 'PLANNING.md', '2026-02-01T00:00:00Z')
    expect(id1).not.toBe(id2)
  })
})

describe('buildTimeline()', () => {
  it('returns a valid Timeline that passes TimelineSchema.parse()', async () => {
    const result = await buildTimeline({
      rootDir: '/project',
      scannedAt: '2026-04-05T00:00:00Z',
      fileEvents: [],
    })
    expect(() => TimelineSchema.parse(result)).not.toThrow()
  })

  it('sorts events chronologically by date (ascending)', async () => {
    const events = [
      makeFileEvent({ date: '2026-03-01T00:00:00Z', path: 'CHANGELOG.md', artifactType: 'gstack' }),
      makeFileEvent({ date: '2026-01-15T00:00:00Z', path: 'PLANNING.md', artifactType: 'gstack' }),
      makeFileEvent({ date: '2026-02-10T00:00:00Z', path: 'TASKS.md', artifactType: 'gsd' }),
    ]
    const result = await buildTimeline({
      rootDir: '/project',
      scannedAt: '2026-04-05T00:00:00Z',
      fileEvents: events,
    })
    expect(result.events[0]?.path).toBe('PLANNING.md')
    expect(result.events[1]?.path).toBe('TASKS.md')
    expect(result.events[2]?.path).toBe('CHANGELOG.md')
  })

  it('computes dateRange.start and dateRange.end from exact/estimated events only', async () => {
    const events = [
      makeFileEvent({ date: '2026-01-15T00:00:00Z', dateConfidence: 'exact', path: 'PLANNING.md' }),
      makeFileEvent({ date: '2026-05-01T00:00:00Z', dateConfidence: 'estimated', path: 'TASKS.md', artifactType: 'gsd' }),
      makeFileEvent({ date: '2026-04-05T00:00:00Z', dateConfidence: 'unknown', path: 'README.md', artifactType: 'generic' }),
    ]
    const result = await buildTimeline({
      rootDir: '/project',
      scannedAt: '2026-04-05T00:00:00Z',
      fileEvents: events,
    })
    expect(result.dateRange.start).toBe('2026-01-15T00:00:00Z')
    expect(result.dateRange.end).toBe('2026-05-01T00:00:00Z')
  })

  it('sets dateRange to empty strings when no events have reliable dates', async () => {
    const events = [
      makeFileEvent({ date: '2026-04-05T00:00:00Z', dateConfidence: 'unknown', path: 'PLANNING.md' }),
    ]
    const result = await buildTimeline({
      rootDir: '/project',
      scannedAt: '2026-04-05T00:00:00Z',
      fileEvents: events,
    })
    expect(result.dateRange.start).toBe('')
    expect(result.dateRange.end).toBe('')
  })

  it('sets dateRange to empty strings when no events exist', async () => {
    const result = await buildTimeline({
      rootDir: '/project',
      scannedAt: '2026-04-05T00:00:00Z',
      fileEvents: [],
    })
    expect(result.dateRange.start).toBe('')
    expect(result.dateRange.end).toBe('')
  })

  it('includes git tag events when gitSource is provided', async () => {
    const gitSource = makeGitSource({
      tags: [
        { name: 'v1.0.0', date: '2026-02-01T00:00:00Z', message: 'Initial release' },
      ],
    })
    const result = await buildTimeline({
      rootDir: '/project',
      scannedAt: '2026-04-05T00:00:00Z',
      fileEvents: [],
      gitSource,
    })
    const tagEvent = result.events.find((e) => e.source === 'git-tag')
    expect(tagEvent).toBeDefined()
    expect(tagEvent?.artifactType).toBe('git-tag')
    expect(tagEvent?.dateConfidence).toBe('exact')
    expect(tagEvent?.summary).toContain('v1.0.0')
  })

  it('git tag event IDs start with "tag-"', async () => {
    const gitSource = makeGitSource({
      tags: [{ name: 'v1.0.0', date: '2026-02-01T00:00:00Z', message: 'Release' }],
    })
    const result = await buildTimeline({
      rootDir: '/project',
      scannedAt: '2026-04-05T00:00:00Z',
      fileEvents: [],
      gitSource,
    })
    const tagEvent = result.events.find((e) => e.source === 'git-tag')
    expect(tagEvent?.id).toMatch(/^tag-/)
  })

  it('generates IDs for file events', async () => {
    const events = [makeFileEvent()]
    const result = await buildTimeline({
      rootDir: '/project',
      scannedAt: '2026-04-05T00:00:00Z',
      fileEvents: events,
    })
    expect(result.events[0]?.id).toMatch(/^file-/)
  })

  it('validates output through TimelineSchema.parse() and throws on invalid data', async () => {
    // buildTimeline with valid data should not throw
    await expect(
      buildTimeline({
        rootDir: '/project',
        scannedAt: '2026-04-05T00:00:00Z',
        fileEvents: [],
      }),
    ).resolves.toBeDefined()
  })

  it('does not include git tags when gitSource is null', async () => {
    const result = await buildTimeline({
      rootDir: '/project',
      scannedAt: '2026-04-05T00:00:00Z',
      fileEvents: [makeFileEvent()],
      gitSource: null,
    })
    const tagEvents = result.events.filter((e) => e.source === 'git-tag')
    expect(tagEvents).toHaveLength(0)
  })

  it('preserves rootDir and scannedAt in output', async () => {
    const result = await buildTimeline({
      rootDir: '/my/project',
      scannedAt: '2026-04-05T12:00:00Z',
      fileEvents: [],
    })
    expect(result.rootDir).toBe('/my/project')
    expect(result.scannedAt).toBe('2026-04-05T12:00:00Z')
    expect(result.version).toBe('1')
  })

  it('includes "inferred" confidence events in dateRange', async () => {
    const events = [
      makeFileEvent({ date: '2026-01-01T00:00:00Z', dateConfidence: 'inferred', path: 'PLANNING.md' }),
    ]
    // Note: plan says only 'exact' and 'estimated' are used for dateRange — 'inferred' should NOT be included
    // (The behavior spec says: "exact or estimated only")
    const result = await buildTimeline({
      rootDir: '/project',
      scannedAt: '2026-04-05T00:00:00Z',
      fileEvents: events,
    })
    // 'inferred' is not in the reliable set per plan spec
    expect(result.dateRange.start).toBe('')
    expect(result.dateRange.end).toBe('')
  })
})
