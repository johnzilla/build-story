import { describe, it, expect } from 'vitest'
import { buildCommitEvents } from '../scan/commit-source.js'
import { TimelineEventSchema } from '../types/timeline.js'
import type { CommitRecord } from '../types/git-source.js'

function makeCommit(overrides?: Partial<CommitRecord>): CommitRecord {
  return {
    hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
    date: '2026-02-01T10:00:00Z',
    author: 'John Turner',
    subject: 'feat: add commit event source',
    body: 'Reconstruct the timeline from git history, not planning docs.',
    files: [
      { path: 'src/scan/commit-source.ts', insertions: 80, deletions: 0 },
      { path: 'src/scan/index.ts', insertions: 20, deletions: 12 },
    ],
    insertions: 100,
    deletions: 12,
    ...overrides,
  }
}

describe('buildCommitEvents()', () => {
  it('produces events that pass TimelineEventSchema', () => {
    const events = buildCommitEvents([makeCommit()])
    expect(events).toHaveLength(1)
    expect(() => TimelineEventSchema.parse(events[0])).not.toThrow()
  })

  it('marks events as git-commit source with exact date confidence', () => {
    const [event] = buildCommitEvents([makeCommit()])
    expect(event?.source).toBe('git-commit')
    expect(event?.artifactType).toBe('git-commit')
    expect(event?.dateConfidence).toBe('exact')
    expect(event?.date).toBe('2026-02-01T10:00:00Z')
  })

  it('assigns a stable commit- prefixed id keyed on the hash', () => {
    const [a] = buildCommitEvents([makeCommit()])
    const [b] = buildCommitEvents([makeCommit()])
    expect(a?.id).toMatch(/^commit-[0-9a-f]{16}$/)
    expect(a?.id).toBe(b?.id)
  })

  it('gives commits on the same date distinct ids (keyed on hash, not date)', () => {
    const events = buildCommitEvents([
      makeCommit({ hash: '1111111111111111111111111111111111111111' }),
      makeCommit({ hash: '2222222222222222222222222222222222222222' }),
    ])
    expect(events[0]?.id).not.toBe(events[1]?.id)
  })

  it('puts narrative substance (subject, body, files) in summary — the LLM-visible field', () => {
    const [event] = buildCommitEvents([makeCommit()])
    expect(event?.summary).toContain('feat: add commit event source')
    expect(event?.summary).toContain('Reconstruct the timeline')
    expect(event?.summary).toContain('src/scan/commit-source.ts (+80/-0)')
    expect(event?.summary).toContain('Files changed (2)')
  })

  it('exposes structured stats in metadata', () => {
    const [event] = buildCommitEvents([makeCommit()])
    expect(event?.metadata).toMatchObject({
      hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
      shortHash: 'a1b2c3d4',
      author: 'John Turner',
      filesChanged: 2,
      insertions: 100,
      deletions: 12,
    })
  })

  it('collapses long file lists in the summary but keeps the full count', () => {
    const files = Array.from({ length: 20 }, (_, i) => ({
      path: `src/file-${i}.ts`,
      insertions: 1,
      deletions: 0,
    }))
    const [event] = buildCommitEvents([makeCommit({ files })])
    expect(event?.summary).toContain('Files changed (20)')
    expect(event?.summary).toContain('+8 more')
  })

  it('handles commits with no body and no file changes', () => {
    const [event] = buildCommitEvents([
      makeCommit({ body: '', files: [], insertions: 0, deletions: 0 }),
    ])
    expect(event?.summary).toBe('feat: add commit event source')
    expect(() => TimelineEventSchema.parse(event)).not.toThrow()
  })

  it('drops records with an empty hash', () => {
    const events = buildCommitEvents([makeCommit({ hash: '' })])
    expect(events).toHaveLength(0)
  })
})
