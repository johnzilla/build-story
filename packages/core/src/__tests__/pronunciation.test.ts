import { it, expect } from 'vitest'
import { applyPronunciations, PronunciationsSchema } from '../pronunciation.js'
import type { StoryArc } from '../types/story.js'
const arc: StoryArc = { version: '1', beats: [{ type: 'idea', title: 'Storage', summary: 'SQLite uses SQL. SQLAlchemy stays unchanged. C++ works.', evidence: [], sourceEventIds: [], significance: 2 }], metadata: { generatedAt: '', style: '', sourceTimeline: 'demo' } }
it('replaces literal whole terms once, with longest matches first, and preserves captions', () => {
  const rules = { SQL: 'sequel', SQLite: 'S Q Lite', 'C++': 'C plus plus', sequel: 'not recursive' }
  const result = applyPronunciations(arc, rules)
  expect(result.beats[0]?.speechText).toBe('S Q Lite uses sequel. SQLAlchemy stays unchanged. C plus plus works.')
  expect(result.beats[0]?.summary).toBe(arc.beats[0]?.summary)
  expect(applyPronunciations(result, rules)).toEqual(result)
})
it('scrubs replacement values and rejects empty or excessive rules', () => {
  expect(applyPronunciations(arc, { SQLite: 'password="synthetic private value"' }).beats[0]?.speechText).not.toContain('synthetic private value')
  expect(() => PronunciationsSchema.parse({ SQL: '' })).toThrow()
  expect(() => PronunciationsSchema.parse(Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`word${i}`, 'word'])))).toThrow()
})
it('keeps manual speech text when no dictionary is supplied', () => {
  const input = { ...arc, beats: [{ ...arc.beats[0]!, speechText: 'Manual pronunciation.' }] }
  expect(applyPronunciations(input).beats[0]?.speechText).toBe('Manual pronunciation.')
})
