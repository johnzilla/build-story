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
  return { id, harness: 'claude-code', startedAt: turns[0]?.timestamp, turns }
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
})
