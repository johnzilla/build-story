import { describe, it, expect } from 'vitest'
import { buildTranscriptEvents } from '../scan/transcript-source.js'
import { TimelineEventSchema } from '../types/timeline.js'
import type { TranscriptSession, TranscriptTurn } from '../types/transcript.js'

function makeSession(overrides?: Partial<TranscriptSession>): TranscriptSession {
  const turns: TranscriptTurn[] = [
    { role: 'user', kind: 'message', text: 'Add git commits as timeline events', timestamp: '2026-02-01T10:00:00Z' },
    { role: 'agent', kind: 'thought', text: 'Long internal reasoning that should NOT appear in rawContent', timestamp: '2026-02-01T10:00:05Z' },
    { role: 'agent', kind: 'message', text: 'Done — commits now flow into the timeline.', timestamp: '2026-02-01T10:05:00Z' },
    { role: 'agent', kind: 'tool_call', text: 'tool: Edit', toolName: 'Edit', timestamp: '2026-02-01T10:02:00Z' },
    { role: 'user', kind: 'message', text: 'Now handle the pluggable sources', timestamp: '2026-02-01T10:10:00Z' },
  ]
  return {
    id: 'sess-abc',
    harness: 'claude-code',
    model: 'claude-opus-4-8',
    cwd: '/home/user/build-story',
    startedAt: '2026-02-01T10:00:00Z',
    endedAt: '2026-02-01T10:10:00Z',
    turns,
    ...overrides,
  }
}

describe('buildTranscriptEvents()', () => {
  it('produces one valid transcript event per session', () => {
    const events = buildTranscriptEvents([makeSession()])
    expect(events).toHaveLength(1)
    expect(() => TimelineEventSchema.parse(events[0])).not.toThrow()
    expect(events[0]?.source).toBe('transcript')
    expect(events[0]?.artifactType).toBe('transcript')
    expect(events[0]?.dateConfidence).toBe('exact')
    expect(events[0]?.date).toBe('2026-02-01T10:00:00Z')
  })

  it('assigns a stable session- prefixed id keyed on session id', () => {
    const a = buildTranscriptEvents([makeSession()])[0]
    const b = buildTranscriptEvents([makeSession()])[0]
    expect(a?.id).toMatch(/^session-[0-9a-f]{16}$/)
    expect(a?.id).toBe(b?.id)
  })

  it('puts the human decision trail in the LLM-visible summary', () => {
    const [event] = buildTranscriptEvents([makeSession()])
    expect(event?.summary).toContain('Add git commits as timeline events')
    expect(event?.summary).toContain('Now handle the pluggable sources')
    expect(event?.summary).toContain('claude-code')
    expect(event?.summary).toContain('claude-opus-4-8')
    // Agent's internal reasoning must not leak into the summary.
    expect(event?.summary).not.toContain('Long internal reasoning')
  })

  it('records session stats in metadata', () => {
    const [event] = buildTranscriptEvents([makeSession()])
    expect(event?.metadata).toMatchObject({
      sessionId: 'sess-abc',
      harness: 'claude-code',
      model: 'claude-opus-4-8',
      cwd: '/home/user/build-story',
      userTurns: 2,
      agentTurns: 1,
      toolCalls: 1,
    })
  })

  it('keeps thinking out of rawContent (provenance = human + agent messages only)', () => {
    const [event] = buildTranscriptEvents([makeSession()])
    expect(event?.rawContent).toContain('Add git commits')
    expect(event?.rawContent).toContain('Done — commits now flow')
    expect(event?.rawContent).not.toContain('Long internal reasoning')
  })

  it('collapses a long list of human turns with a remainder count', () => {
    const turns: TranscriptTurn[] = Array.from({ length: 20 }, (_, i) => ({
      role: 'user' as const,
      kind: 'message' as const,
      text: `ask number ${i}`,
      timestamp: '2026-02-01T10:00:00Z',
    }))
    const [event] = buildTranscriptEvents([makeSession({ turns })])
    expect(event?.summary).toContain('+8 more')
  })

  it('drops sessions with no start timestamp', () => {
    // A session with no startedAt at all (not present) — should be dropped.
    const events = buildTranscriptEvents([
      { id: 'no-start', harness: 'claude-code', turns: [{ role: 'user', kind: 'message', text: 'hi' }] },
    ])
    expect(events).toHaveLength(0)
  })
})
