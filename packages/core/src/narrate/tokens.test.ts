import { describe, it, expect } from 'vitest'
import { estimateTokens, guardTokens, buildTimelinePayload } from './tokens.js'
import type { Timeline } from '../types/timeline.js'

const makeTimeline = (overrides: Partial<Timeline> = {}): Timeline => ({
  version: '1',
  rootDir: '/test',
  scannedAt: '2026-01-01T00:00:00Z',
  dateRange: { start: '2026-01-01', end: '2026-01-31' },
  events: [],
  ...overrides,
})

describe('estimateTokens()', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('returns Math.ceil(length / 4) for "hello world" (11 chars = ceil(11/4) = 3)', () => {
    expect(estimateTokens('hello world')).toBe(3)
  })

  it('returns 1 for a 4-char string', () => {
    expect(estimateTokens('abcd')).toBe(1)
  })

  it('returns 2 for a 5-char string (ceil(5/4) = 2)', () => {
    expect(estimateTokens('abcde')).toBe(2)
  })

  it('returns 25 for a 100-char string', () => {
    expect(estimateTokens('a'.repeat(100))).toBe(25)
  })
})

describe('guardTokens()', () => {
  it('does NOT throw when estimated tokens are under the limit', () => {
    // 300 chars = 75 tokens, limit = 100
    const payload = 'a'.repeat(300)
    expect(() => guardTokens(payload, 100)).not.toThrow()
  })

  it('does NOT throw when estimated tokens equal the limit', () => {
    // 400 chars = 100 tokens, limit = 100
    const payload = 'a'.repeat(400)
    expect(() => guardTokens(payload, 100)).not.toThrow()
  })

  it('throws when estimated tokens exceed the limit', () => {
    // 300 chars = 75 tokens, limit = 10
    const payload = 'a'.repeat(300)
    expect(() => guardTokens(payload, 10)).toThrow()
  })

  it('error message contains "estimated" and "exceeds limit"', () => {
    const payload = 'a'.repeat(300)
    expect(() => guardTokens(payload, 10)).toThrowError(/estimated.*exceeds limit|exceeds limit.*estimated/i)
  })

  it('error message includes the estimated count and the limit value', () => {
    const payload = 'a'.repeat(300) // 75 tokens
    try {
      guardTokens(payload, 10)
      expect.fail('expected to throw')
    } catch (e) {
      expect(String(e)).toContain('75')
      expect(String(e)).toContain('10')
    }
  })
})

describe('buildTimelinePayload()', () => {
  it('returns a JSON string', () => {
    const timeline = makeTimeline()
    const result = buildTimelinePayload(timeline)
    expect(typeof result).toBe('string')
    expect(() => JSON.parse(result)).not.toThrow()
  })

  it('does NOT include rawContent in the output', () => {
    const timeline = makeTimeline({
      events: [
        {
          id: 'evt-1',
          date: '2026-01-01',
          source: 'file',
          path: '.planning/phases/01-scaffold/01-01-PLAN.md',
          summary: 'Test event',
          metadata: {},
          dateConfidence: 'exact',
          rawContent: 'THIS SHOULD NOT APPEAR IN PAYLOAD',
        },
      ],
    })
    const result = buildTimelinePayload(timeline)
    expect(result).not.toContain('rawContent')
    expect(result).not.toContain('THIS SHOULD NOT APPEAR IN PAYLOAD')
  })

  it('includes id, date, source, summary in the output', () => {
    const timeline = makeTimeline({
      events: [
        {
          id: 'evt-1',
          date: '2026-01-01',
          source: 'file',
          summary: 'Test event summary',
          metadata: {},
          dateConfidence: 'exact',
          rawContent: 'raw',
        },
      ],
    })
    const result = buildTimelinePayload(timeline)
    expect(result).toContain('evt-1')
    expect(result).toContain('Test event summary')
    expect(result).toContain('2026-01-01')
  })
})
