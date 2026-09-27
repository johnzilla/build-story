import { describe, it, expect, vi } from 'vitest'
import { narrate } from '../narrate/index.js'
import { buildNarrationPreview } from '../narrate/prepare.js'
import { renderSourceReview } from '../narrate/review.js'
import { applyEditorialReview } from '../narrate/editorial.js'
import type { Timeline } from '../types/timeline.js'
import type { StoryArc } from '../types/story.js'
import type { LLMProvider } from '../narrate/providers/interface.js'

const timeline: Timeline = {
  version: '1', rootDir: '/project', scannedAt: '', dateRange: { start: '', end: '' },
  events: [{ id: 'c1', date: '2026-01-01', source: 'git-commit', dateConfidence: 'exact', summary: 'Chose local storage for offline use.', rawContent: '', metadata: {} }],
}
const arc: StoryArc = {
  version: '1', beats: [{ type: 'decision', title: 'Local storage', summary: 'Chose local storage for offline use.', evidence: ['Chose local storage for offline use.'], sourceEventIds: ['c1'], significance: 3, claimBasis: 'documented' }],
  metadata: { generatedAt: '', style: 'story', sourceTimeline: 'project' },
}
function provider(): LLMProvider {
  return { extractStoryArc: vi.fn().mockResolvedValue(arc), synthesizeArcs: vi.fn().mockResolvedValue(arc), generateFormat: vi.fn(), getUsage: vi.fn() }
}
const options = { provider: 'anthropic', style: 'story', apiKey: 'test-key' } as const

describe('editorial controls', () => {
  it('uses the same sanitized brief for preview and narration, and persists runtime estimates', async () => {
    const editorial = { centralQuestion: 'Why offline? password="synthetic secret" /Users/private/project', pivotalEventIds: ['c1'], targetRuntimeSeconds: 60 }
    const preview = buildNarrationPreview(timeline, { style: 'story', editorial })
    const llm = provider()
    const result = await narrate(timeline, { ...options, editorial }, llm)
    expect(vi.mocked(llm.extractStoryArc).mock.calls[0]?.[1]).toBe(preview.requests[0]?.system)
    expect(preview.requests[0]?.system).not.toContain('synthetic secret')
    expect(preview.requests[0]?.system).not.toContain('/Users/private/project')
    expect(result.metadata.editorial).toMatchObject({ targetRuntimeSeconds: 60, compressRoutine: true, preserveOpenLoops: true, wordCount: 6, estimatedRuntimeSeconds: 3 })
    expect(result.metadata.warnings?.join(' ')).toContain('versus target 60s')
    expect(renderSourceReview(result)).toContain('Editorial brief:')
    expect(result.beats[0]?.summary).toBe(arc.beats[0]?.summary)
  })
  it('rejects absent pivotal IDs before any paid extraction', async () => {
    const llm = provider()
    await expect(narrate(timeline, { ...options, editorial: { pivotalEventIds: ['missing'] } }, llm)).rejects.toThrow('not in the timeline')
    expect(llm.extractStoryArc).not.toHaveBeenCalled()
    expect(() => buildNarrationPreview(timeline, { style: 'story', editorial: { pivotalEventIds: ['missing'] } })).toThrow('not in the timeline')
  })
  it.each([0, 9, 3601, 20.5, Infinity])('rejects invalid runtime %s without paid calls', async (targetRuntimeSeconds) => {
    const llm = provider()
    await expect(narrate(timeline, { ...options, editorial: { targetRuntimeSeconds } }, llm)).rejects.toThrow()
    expect(llm.extractStoryArc).not.toHaveBeenCalled()
  })
  it('carries the whole-story budget through chunk extraction and synthesis', async () => {
    const large = { ...timeline, events: Array.from({ length: 20 }, (_, i) => ({ ...timeline.events[0]!, id: `c${i}`, summary: 'Evidence. '.repeat(100) })) }
    const llm = provider()
    const editorial = { pivotalEventIds: ['c1', 'c19'], centralQuestion: 'Why did storage change?', targetRuntimeSeconds: 90, compressRoutine: false, preserveOpenLoops: false }
    const result = await narrate(large, { ...options, maxInputTokens: 2600, editorial }, llm)
    expect(vi.mocked(llm.extractStoryArc).mock.calls.length).toBeGreaterThan(1)
    const prompt = vi.mocked(llm.synthesizeArcs).mock.calls[0]?.[1]
    expect(prompt).toContain('TOTAL spoken beat.summary')
    expect(prompt).toContain('not a quota for each chunk')
    expect(prompt).toContain('"compressRoutine":false')
    expect(prompt).toContain('"preserveOpenLoops":false')
    expect(result.metadata.warnings?.join(' ')).toContain('pivotal source "c19" was omitted')
  })
  it('does not add an editorial brief to existing callers', async () => {
    const result = await narrate(timeline, options, provider())
    expect(result.metadata.editorial).toBeUndefined()
    expect(buildNarrationPreview(timeline, options).requests[0]?.system).not.toContain('## Editorial brief')
  })
  it('uses spoken summaries, not duration hints or evidence, to estimate runtime', () => {
    const result = applyEditorialReview({ ...arc, beats: [{ ...arc.beats[0]!, summary: Array(130).fill('word').join(' '), duration_seconds: 999 }] }, { targetRuntimeSeconds: 60 })
    expect(result.metadata.editorial?.estimatedRuntimeSeconds).toBe(60)
    expect(result.metadata.warnings).toEqual([])
  })
})
