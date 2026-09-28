import { describe, it, expect } from 'vitest'
import { EvidenceVisualSchema } from '../types/visual.js'
import { StoryArcSchema, type StoryArc } from '../types/story.js'
import type { Timeline } from '../types/timeline.js'
import { reviewStoryArc } from '../narrate/review.js'

const text = 'We chose local storage for offline use.'
const arc: StoryArc = { version: '1', beats: [{ type: 'decision', title: 'Storage', summary: 'The full spoken narration.', displayText: 'Offline by design', evidence: [text], sourceEventIds: ['c1'], significance: 3, visual: { kind: 'quote', panels: [{ label: 'evidence', text, sourceEventId: 'c1' }] } }], metadata: { generatedAt: '', style: 'story', sourceTimeline: 'project' } }
const timeline: Timeline = { version: '1', rootDir: 'project', scannedAt: '', dateRange: { start: '', end: '' }, events: [{ id: 'c1', date: '2026-01-01', source: 'git-commit', summary: text, metadata: {}, dateConfidence: 'exact', rawContent: 'Private unshared text.' }] }

describe('evidence visual validation', () => {
  it.each(['quote', 'error', 'architecture', 'comparison', 'outcome'] as const)('retains source-matched %s panels without changing speech', kind => {
    const input = structuredClone(arc)
    input.beats[0]!.visual!.kind = kind
    const result = reviewStoryArc(input, timeline)
    expect(result.beats[0]?.visual?.kind).toBe(kind)
    expect(result.beats[0]?.summary).toBe('The full spoken narration.')
    expect(result.metadata.review?.beats[0]?.matchedEvidence).toContainEqual({ text, eventIds: ['c1'] })
  })
  it.each(['Missing source quote.', 'Private unshared text.', '[REDACTED] private information'])('drops unsupported visual text: %s', value => {
    const input = structuredClone(arc)
    input.beats[0]!.visual!.panels[0]!.text = value
    const result = reviewStoryArc(input, timeline)
    expect(result.beats[0]?.visual).toBeUndefined()
    expect(result.metadata.warnings?.join(' ')).toContain('Evidence visual omitted')
    expect(result.beats[0]?.summary).toBe(arc.beats[0]?.summary)
  })
  it('rejects uncited visual sources even when they exist in the timeline', () => {
    const input = structuredClone(arc)
    input.beats[0]!.visual!.panels[0]!.sourceEventId = 'other'
    expect(reviewStoryArc(input, { ...timeline, events: [...timeline.events, { ...timeline.events[0]!, id: 'other' }] }).beats[0]?.visual).toBeUndefined()
  })
  it('attaches only locators of matching excerpts, not the first excerpt in a source', () => {
    const source = { ...timeline.events[0]!, excerpts: [
      { text: 'Unrelated earlier passage.', topics: ['problem' as const], truncated: false, locator: { kind: 'lines' as const, startLine: 1, endLine: 2 } },
      { text, topics: ['decision' as const], truncated: false, locator: { kind: 'lines' as const, startLine: 20, endLine: 22 } },
    ] }
    const result = reviewStoryArc(arc, { ...timeline, events: [source] })
    expect(result.metadata.review?.beats[0]?.matchedEvidence.find(match => match.references)?.references).toEqual(['Scanned lines 20-22'])
  })
  it('does not normalize code whitespace into a false diff match', () => {
    const input = structuredClone(arc)
    input.beats[0]!.visual = { kind: 'diff', panels: [{ label: 'evidence', sourceEventId: 'c1', text: '-old value\n+new value' }] }
    const different = { ...timeline, events: [{ ...timeline.events[0]!, summary: '-old value +new value' }] }
    expect(reviewStoryArc(input, different).beats[0]?.visual).toBeUndefined()
    different.events[0]!.summary = '-old value\r\n+new value'
    expect(reviewStoryArc(input, different).beats[0]?.visual).toBeDefined()
  })
  it('bounds panel count, text, and lines, and rejects executable or unknown shape fields', () => {
    const visual = arc.beats[0]!.visual!
    expect(() => EvidenceVisualSchema.parse({ ...visual, url: 'https://example.com' })).toThrow()
    expect(() => EvidenceVisualSchema.parse({ ...visual, kind: 'html' })).toThrow()
    expect(() => EvidenceVisualSchema.parse({ ...visual, panels: Array(3).fill(visual.panels[0]) })).toThrow()
    for (const value of ['x'.repeat(361), 'line\n'.repeat(9)]) {
      expect(() => EvidenceVisualSchema.parse({ ...visual, panels: [{ ...visual.panels[0], text: value }] })).toThrow()
    }
    expect(() => StoryArcSchema.parse({ ...arc, beats: [{ ...arc.beats[0], displayText: 'x'.repeat(241) }] })).toThrow()
  })
})
