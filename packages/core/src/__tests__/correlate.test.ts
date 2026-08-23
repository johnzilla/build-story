import { describe, it, expect } from 'vitest'
import { correlateCommitsWithTranscripts } from '../scan/correlate.js'
import type { TimelineEvent } from '../types/timeline.js'
import type { TranscriptSession, TranscriptTurn } from '../types/transcript.js'

function commit(id: string, date: string, summary = 'did a thing'): TimelineEvent {
  return {
    id,
    date,
    source: 'git-commit',
    summary,
    metadata: { hash: id },
    dateConfidence: 'exact',
    rawContent: summary,
    artifactType: 'git-commit',
    crossRefs: [],
  }
}

function session(id: string, turns: TranscriptTurn[]): TranscriptSession {
  const s: TranscriptSession = { id, harness: 'claude-code', turns }
  const startedAt = turns[0]?.timestamp
  if (startedAt !== undefined) s.startedAt = startedAt
  return s
}

function ask(text: string, timestamp: string): TranscriptTurn {
  return { role: 'user', kind: 'message', text, timestamp }
}

describe('correlateCommitsWithTranscripts()', () => {
  it('attaches the in-window human ask to a commit as its "why"', () => {
    const commits = [commit('c1', '2026-03-01T10:00:00Z')]
    const sessions = [session('s1', [ask('Rebuild the scanner around commits', '2026-03-01T09:55:00Z')])]
    const [out] = correlateCommitsWithTranscripts(commits, sessions)
    expect(out?.summary).toContain('did a thing')
    expect(out?.summary).toContain('Why (from agent session)')
    expect(out?.summary).toContain('Rebuild the scanner around commits')
    expect(out?.metadata).toMatchObject({ sourceSessionIds: ['s1'], correlatedAsks: 1 })
  })

  it('assigns each ask to the commit whose window it falls in (not a later one)', () => {
    const commits = [commit('c1', '2026-03-01T10:00:00Z'), commit('c2', '2026-03-01T12:00:00Z')]
    const sessions = [
      session('s1', [
        ask('ask for c1', '2026-03-01T09:50:00Z'),
        ask('ask for c2', '2026-03-01T11:30:00Z'),
      ]),
    ]
    const out = correlateCommitsWithTranscripts(commits, sessions)
    expect(out[0]?.summary).toContain('ask for c1')
    expect(out[0]?.summary).not.toContain('ask for c2')
    expect(out[1]?.summary).toContain('ask for c2')
    expect(out[1]?.summary).not.toContain('ask for c1')
  })

  it('does not reach past the max look-back window', () => {
    const commits = [commit('c1', '2026-03-02T10:00:00Z')]
    // ask is ~26h before the commit; default look-back is 24h
    const sessions = [session('s1', [ask('stale, unrelated', '2026-03-01T08:00:00Z')])]
    const [out] = correlateCommitsWithTranscripts(commits, sessions)
    expect(out?.summary).not.toContain('stale, unrelated')
    expect(out?.metadata['sourceSessionIds']).toBeUndefined()
  })

  it('leaves commits with no in-window asks unchanged', () => {
    const commits = [commit('c1', '2026-03-01T10:00:00Z', 'untouched')]
    const sessions = [session('s1', [ask('much later', '2026-03-05T10:00:00Z')])]
    const [out] = correlateCommitsWithTranscripts(commits, sessions)
    expect(out?.summary).toBe('untouched')
  })

  it('quotes at most maxAsksPerCommit (closest) but counts them all', () => {
    const commits = [commit('c1', '2026-03-01T10:00:00Z')]
    const turns = Array.from({ length: 6 }, (_, i) =>
      ask(`ask ${i}`, `2026-03-01T09:${(10 + i).toString().padStart(2, '0')}:00Z`),
    )
    const [out] = correlateCommitsWithTranscripts(commits, [session('s1', turns)], {
      maxAsksPerCommit: 2,
    })
    expect(out?.summary).toContain('ask 4')
    expect(out?.summary).toContain('ask 5')
    expect(out?.summary).not.toContain('ask 0')
    expect(out?.metadata).toMatchObject({ correlatedAsks: 6 })
  })

  it('merges session ids when asks from multiple sessions fall in one window', () => {
    const commits = [commit('c1', '2026-03-01T10:00:00Z')]
    const sessions = [
      session('s1', [ask('from s1', '2026-03-01T09:40:00Z')]),
      session('s2', [ask('from s2', '2026-03-01T09:50:00Z')]),
    ]
    const [out] = correlateCommitsWithTranscripts(commits, sessions)
    expect(out?.metadata['sourceSessionIds']).toEqual(['s1', 's2'])
  })

  it('returns the input unchanged when there are no asks', () => {
    const commits = [commit('c1', '2026-03-01T10:00:00Z')]
    expect(correlateCommitsWithTranscripts(commits, [])).toEqual(commits)
  })

  it('ignores non-commit events passed through', () => {
    const file: TimelineEvent = {
      id: 'f1',
      date: '2026-03-01T10:00:00Z',
      source: 'file',
      summary: 'a file',
      metadata: {},
      dateConfidence: 'exact',
      rawContent: '',
      artifactType: 'generic',
      crossRefs: [],
    }
    const sessions = [session('s1', [ask('some ask', '2026-03-01T09:55:00Z')])]
    const [out] = correlateCommitsWithTranscripts([file], sessions)
    expect(out?.summary).toBe('a file')
  })

  // 3.5: sliding-window correlation must stay O(n+m). This exercises many
  // commits × many asks — correctness (each ask lands in exactly the right
  // window) doubles as a guard that the two-pointer logic never rescans.
  it('correlates a large commit/ask set correctly and completes quickly', () => {
    const N = 2000
    const base = Date.parse('2026-01-01T00:00:00Z')
    const hour = 3_600_000
    // Commit i at hour i; one ask 5 min before each commit (inside its window).
    const commits = Array.from({ length: N }, (_, i) =>
      commit(`c${i}`, new Date(base + i * hour).toISOString()),
    )
    const turns = Array.from({ length: N }, (_, i) =>
      ask(`ask-${i}`, new Date(base + i * hour - 5 * 60_000).toISOString()),
    )
    const sessions = [session('s1', turns)]

    const t0 = Date.now()
    const out = correlateCommitsWithTranscripts(commits, sessions)
    const elapsed = Date.now() - t0

    // Every commit gets exactly its own ask — none leaks to a neighbor.
    for (let i = 0; i < N; i++) {
      expect(out[i]?.summary).toContain(`ask-${i}`)
      if (i > 0) expect(out[i]?.summary).not.toContain(`ask-${i - 1}`)
    }
    // A quadratic scan of 2000×2000 would be far slower; this is a generous bound.
    expect(elapsed).toBeLessThan(1000)
  })
})
