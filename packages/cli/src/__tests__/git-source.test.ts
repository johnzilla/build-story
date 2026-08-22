import { describe, it, expect } from 'vitest'
import { parseCommitLog } from '../adapters/git-source.js'

const RS = '\x1e'
const US = '\x1f'

/** Build a raw git-log chunk in the exact format createGitSource requests. */
function chunk(
  hash: string,
  date: string,
  author: string,
  subject: string,
  body: string,
  numstat: string,
): string {
  return `${RS}${hash}${US}${date}${US}${author}${US}${subject}${US}${body}${US}\n${numstat}`
}

describe('parseCommitLog()', () => {
  it('returns [] for empty input', () => {
    expect(parseCommitLog('')).toEqual([])
    expect(parseCommitLog('   \n')).toEqual([])
  })

  it('parses a single commit with numstat', () => {
    const raw = chunk(
      'abc123',
      '2026-02-01T10:00:00Z',
      'John Turner',
      'feat: add thing',
      'A longer explanation.',
      '10\t2\tsrc/foo.ts\n5\t0\tsrc/bar.ts\n',
    )
    const [commit] = parseCommitLog(raw)
    expect(commit).toMatchObject({
      hash: 'abc123',
      date: '2026-02-01T10:00:00Z',
      author: 'John Turner',
      subject: 'feat: add thing',
      body: 'A longer explanation.',
      insertions: 15,
      deletions: 2,
    })
    expect(commit?.files).toEqual([
      { path: 'src/foo.ts', insertions: 10, deletions: 2 },
      { path: 'src/bar.ts', insertions: 5, deletions: 0 },
    ])
  })

  it('parses multiple commits', () => {
    const raw =
      chunk('h1', '2026-02-01T10:00:00Z', 'A', 's1', '', '1\t0\ta.ts\n') +
      chunk('h2', '2026-02-02T10:00:00Z', 'B', 's2', '', '2\t1\tb.ts\n')
    const commits = parseCommitLog(raw)
    expect(commits).toHaveLength(2)
    expect(commits[0]?.hash).toBe('h1')
    expect(commits[1]?.hash).toBe('h2')
  })

  it('keeps a multi-line body intact (delimited from numstat by the field separator)', () => {
    const body = 'Line one.\n\nLine two.\n- a bullet'
    const raw = chunk('h1', '2026-02-01T10:00:00Z', 'A', 'subject', body, '3\t1\tx.ts\n')
    const [commit] = parseCommitLog(raw)
    expect(commit?.body).toBe(body)
    expect(commit?.files).toEqual([{ path: 'x.ts', insertions: 3, deletions: 1 }])
  })

  it('treats binary "-" counts as zero', () => {
    const raw = chunk('h1', '2026-02-01T10:00:00Z', 'A', 's', '', '-\t-\tlogo.png\n')
    const [commit] = parseCommitLog(raw)
    expect(commit?.files).toEqual([{ path: 'logo.png', insertions: 0, deletions: 0 }])
    expect(commit?.insertions).toBe(0)
    expect(commit?.deletions).toBe(0)
  })

  it('handles a commit with no file changes', () => {
    const raw = chunk('h1', '2026-02-01T10:00:00Z', 'A', 'chore: empty', '', '')
    const [commit] = parseCommitLog(raw)
    expect(commit?.files).toEqual([])
    expect(commit?.subject).toBe('chore: empty')
  })

  it('preserves rename paths (tab-joined) from numstat', () => {
    const raw = chunk('h1', '2026-02-01T10:00:00Z', 'A', 's', '', '4\t2\told.ts => new.ts\n')
    const [commit] = parseCommitLog(raw)
    expect(commit?.files[0]?.path).toBe('old.ts => new.ts')
  })
})
