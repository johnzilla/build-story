import { describe, it, expect } from 'vitest'
import { parsePiSession } from '../adapters/transcript-pi.js'

// Records shaped per pi's packages/coding-agent/docs/session-format.md.
function line(obj: unknown): string {
  return JSON.stringify(obj)
}

const REPO = '/home/user/build-story'

const SAMPLE = [
  // session header — carries cwd + session id (cwd appears ONLY here)
  line({ type: 'session', version: 1, id: 'pi-sess-1', timestamp: '2026-03-01T09:00:00Z', cwd: REPO }),
  // human prompt as a plain string
  line({
    type: 'message',
    id: 'a1',
    parentId: null,
    timestamp: '2026-03-01T09:00:10Z',
    message: { role: 'user', content: 'Add a pi transcript adapter' },
  }),
  // assistant with thinking + text + toolCall
  line({
    type: 'message',
    id: 'b2',
    parentId: 'a1',
    timestamp: '2026-03-01T09:00:20Z',
    message: {
      role: 'assistant',
      model: 'claude-sonnet-4-5',
      provider: 'anthropic',
      content: [
        { type: 'thinking', thinking: 'internal pi reasoning' },
        { type: 'text', text: 'Building it now.' },
        { type: 'toolCall', id: 't1', name: 'edit_file', arguments: {} },
      ],
    },
  }),
  // human prompt as an array of text blocks (the other allowed shape)
  line({
    type: 'message',
    id: 'c3',
    parentId: 'b2',
    timestamp: '2026-03-01T09:05:00Z',
    message: { role: 'user', content: [{ type: 'text', text: 'Now add tests' }] },
  }),
  // tool result — must be skipped
  line({
    type: 'message',
    id: 'd4',
    parentId: 'c3',
    timestamp: '2026-03-01T09:05:05Z',
    message: { role: 'toolResult', toolCallId: 't1', toolName: 'edit_file', content: [], isError: false },
  }),
].join('\n')

describe('parsePiSession()', () => {
  it('reads the header for id/cwd and extracts human + agent turns', () => {
    const s = parsePiSession(SAMPLE, 'fallback')
    expect(s).not.toBeNull()
    expect(s?.id).toBe('pi-sess-1')
    expect(s?.harness).toBe('pi')
    expect(s?.cwd).toBe(REPO)
    expect(s?.model).toBe('claude-sonnet-4-5')
    expect(s?.startedAt).toBe('2026-03-01T09:00:00Z')
    expect(s?.endedAt).toBe('2026-03-01T09:05:05Z')

    const kinds = s?.turns.map((t) => `${t.role}:${t.kind}`)
    expect(kinds).toContain('user:message')
    expect(kinds).toContain('agent:thought')
    expect(kinds).toContain('agent:message')
    expect(kinds).toContain('agent:tool_call')
  })

  it('captures both string and array-of-text user prompts, skips tool results', () => {
    const s = parsePiSession(SAMPLE, 'fb')
    const userTexts = s?.turns.filter((t) => t.role === 'user').map((t) => t.text)
    expect(userTexts).toEqual(['Add a pi transcript adapter', 'Now add tests'])
    // toolResult produced no turn
    expect(s?.turns.some((t) => t.role === 'tool')).toBe(false)
  })

  it('normalizes a Unix-ms wrapper timestamp to ISO', () => {
    const ms = Date.UTC(2026, 2, 1, 9, 0, 0) // 2026-03-01T09:00:00Z
    const withMs = [
      line({ type: 'session', id: 'p', timestamp: '2026-03-01T09:00:00Z', cwd: REPO }),
      line({ type: 'message', id: 'a', parentId: null, timestamp: ms, message: { role: 'user', content: 'hi' } }),
    ].join('\n')
    const s = parsePiSession(withMs, 'fb')
    expect(s?.turns[0]?.timestamp).toBe('2026-03-01T09:00:00.000Z')
  })

  it('falls back to model_change when no assistant model is present', () => {
    const withModelChange = [
      line({ type: 'session', id: 'p', timestamp: '2026-03-01T09:00:00Z', cwd: REPO }),
      line({ type: 'model_change', id: 'm', parentId: null, timestamp: '2026-03-01T09:00:01Z', provider: 'anthropic', modelId: 'claude-opus-4-8' }),
      line({ type: 'message', id: 'a', parentId: 'm', timestamp: '2026-03-01T09:00:02Z', message: { role: 'user', content: 'go' } }),
    ].join('\n')
    expect(parsePiSession(withModelChange, 'fb')?.model).toBe('claude-opus-4-8')
  })

  it('redacts secrets in turn text', () => {
    const withSecret = [
      line({ type: 'session', id: 'p', timestamp: '2026-03-01T09:00:00Z', cwd: REPO }),
      line({ type: 'message', id: 'a', parentId: null, timestamp: '2026-03-01T09:00:02Z', message: { role: 'user', content: 'token sk-ant-abcdefghijklmnopqrstuvwxyz012345' } }),
    ].join('\n')
    const s = parsePiSession(withSecret, 'fb')
    expect(s?.turns[0]?.text).toContain('[REDACTED]')
    expect(s?.turns[0]?.text).not.toContain('sk-ant-abcdefghijklmnop')
  })

  it('returns null when there are no useful turns', () => {
    const headerOnly = line({ type: 'session', id: 'p', timestamp: '2026-03-01T09:00:00Z', cwd: REPO })
    expect(parsePiSession(headerOnly, 'fb')).toBeNull()
  })

  it('uses fallback id when the header lacks one', () => {
    const noId = [
      line({ type: 'session', timestamp: '2026-03-01T09:00:00Z', cwd: REPO }),
      line({ type: 'message', id: 'a', parentId: null, timestamp: '2026-03-01T09:00:02Z', message: { role: 'user', content: 'hi' } }),
    ].join('\n')
    expect(parsePiSession(noId, '20260301_uuid')?.id).toBe('20260301_uuid')
  })
})
