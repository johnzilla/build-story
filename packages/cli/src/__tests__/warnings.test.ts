import { describe, it, expect } from 'vitest'
import type { Timeline, TimelineEvent } from '@buildstory/core'
import { claudeDirWarning } from '../warnings.js'

const event = (overrides: Partial<TimelineEvent>): TimelineEvent => ({
  id: 'e',
  date: '2026-01-01',
  source: 'file',
  summary: 's',
  metadata: {},
  dateConfidence: 'exact',
  rawContent: '',
  artifactType: 'generic',
  crossRefs: [],
  ...overrides,
})

const timeline = (events: TimelineEvent[]): Timeline => ({
  version: '1',
  rootDir: '/p',
  scannedAt: '2026-01-01T00:00:00Z',
  dateRange: { start: '2026-01-01', end: '2026-01-01' },
  events,
})

describe('claudeDirWarning', () => {
  it('warns (with count) when files under .claude/ were scanned', () => {
    const w = claudeDirWarning(
      timeline([
        event({ id: 'a', path: '.claude/commands/foo.md' }),
        event({ id: 'b', path: '.claude/notes.md' }),
        event({ id: 'c', path: 'README.md' }),
      ]),
    )
    expect(w).toContain('2 file(s) under .claude/')
    expect(w).toContain('scan.excludes')
  })

  it('returns null when no .claude/ files were scanned', () => {
    expect(claudeDirWarning(timeline([event({ path: 'docs/x.md' })]))).toBeNull()
  })

  it('ignores non-file events even if a path happens to start with .claude/', () => {
    expect(
      claudeDirWarning(timeline([event({ source: 'git-commit', path: '.claude/x.md' })])),
    ).toBeNull()
  })
})
