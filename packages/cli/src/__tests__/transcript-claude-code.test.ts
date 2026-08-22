import { describe, it, expect } from 'vitest'
import { parseClaudeCodeSession } from '../adapters/transcript-claude-code.js'
import { sessionMatchesProject } from '../adapters/transcript-shared.js'

// Records shaped like real Claude Code .jsonl lines.
function line(obj: unknown): string {
  return JSON.stringify(obj)
}

const REPO = '/home/user/build-story'

const SAMPLE = [
  line({ type: 'queue-operation', operation: 'x', sessionId: 's1' }), // noise
  line({
    type: 'user',
    sessionId: 's1',
    cwd: REPO,
    timestamp: '2026-02-01T10:00:00Z',
    message: { role: 'user', content: 'Add git commits as timeline events' },
  }),
  line({
    type: 'assistant',
    sessionId: 's1',
    cwd: `${REPO}/packages/core`,
    timestamp: '2026-02-01T10:00:05Z',
    message: {
      role: 'assistant',
      model: 'claude-opus-4-8',
      content: [
        { type: 'thinking', thinking: 'internal reasoning' },
        { type: 'text', text: 'On it.' },
        { type: 'tool_use', name: 'Edit', input: {} },
      ],
    },
  }),
  line({
    type: 'user',
    sessionId: 's1',
    cwd: REPO,
    timestamp: '2026-02-01T10:01:00Z',
    message: { role: 'user', content: [{ type: 'tool_result', content: 'ok' }] }, // tool result → skipped
  }),
].join('\n')

describe('parseClaudeCodeSession()', () => {
  it('extracts human prompts, agent turns, model, cwd, and time span', () => {
    const s = parseClaudeCodeSession(SAMPLE, 'fallback')
    expect(s).not.toBeNull()
    expect(s?.id).toBe('s1')
    expect(s?.harness).toBe('claude-code')
    expect(s?.model).toBe('claude-opus-4-8')
    // shallowest cwd wins (repo root, not the subdir a tool ran in)
    expect(s?.cwd).toBe(REPO)
    expect(s?.startedAt).toBe('2026-02-01T10:00:00Z')

    const kinds = s?.turns.map((t) => `${t.role}:${t.kind}`)
    expect(kinds).toContain('user:message')
    expect(kinds).toContain('agent:thought')
    expect(kinds).toContain('agent:message')
    expect(kinds).toContain('agent:tool_call')
    // the tool_result user record is not a turn
    expect(s?.turns.filter((t) => t.role === 'user')).toHaveLength(1)
  })

  it('skips harness noise and malformed lines', () => {
    const s = parseClaudeCodeSession(`not json\n${SAMPLE}\n{"type":"mode","mode":"x"}`, 'fb')
    expect(s).not.toBeNull()
    expect(s?.turns.length).toBeGreaterThan(0)
  })

  it('redacts secrets from turn text', () => {
    const withSecret = line({
      type: 'user',
      sessionId: 's2',
      cwd: REPO,
      timestamp: '2026-02-01T10:00:00Z',
      message: { role: 'user', content: 'my key is sk-ant-abcdefghijklmnopqrstuvwxyz012345' },
    })
    const s = parseClaudeCodeSession(withSecret, 'fb')
    expect(s?.turns[0]?.text).toContain('[REDACTED]')
    expect(s?.turns[0]?.text).not.toContain('sk-ant-abcdefghijklmnopqrstuvwxyz')
  })

  it('falls back to the given id when no sessionId present', () => {
    const noId = line({
      type: 'user',
      cwd: REPO,
      timestamp: '2026-02-01T10:00:00Z',
      message: { role: 'user', content: 'hello' },
    })
    expect(parseClaudeCodeSession(noId, 'file-uuid')?.id).toBe('file-uuid')
  })

  it('returns null for a session with no useful turns', () => {
    const onlyNoise = line({ type: 'mode', mode: 'x', sessionId: 's' })
    expect(parseClaudeCodeSession(onlyNoise, 'fb')).toBeNull()
  })
})

describe('sessionMatchesProject()', () => {
  it('matches equal paths', () => {
    expect(sessionMatchesProject(REPO, REPO)).toBe(true)
  })
  it('matches a session cwd under the project', () => {
    expect(sessionMatchesProject(`${REPO}/packages/core`, REPO)).toBe(true)
  })
  it('matches a project under the session cwd', () => {
    expect(sessionMatchesProject(REPO, `${REPO}/packages/core`)).toBe(true)
  })
  it('rejects unrelated paths and undefined', () => {
    expect(sessionMatchesProject('/other/repo', REPO)).toBe(false)
    expect(sessionMatchesProject(undefined, REPO)).toBe(false)
    // guards against prefix false-positives like /home/user/build-story-2
    expect(sessionMatchesProject(`${REPO}-2`, REPO)).toBe(false)
  })
})
