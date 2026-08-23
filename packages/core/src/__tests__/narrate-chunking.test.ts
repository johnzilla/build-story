import { describe, it, expect, vi } from 'vitest'
import { narrate } from '../narrate/index.js'
import { buildSystemPrompt } from '../narrate/prompts/system.js'
import { estimateTokens } from '../narrate/tokens.js'
import type { Timeline, TimelineEvent } from '../types/timeline.js'
import type { StoryArc } from '../types/story.js'
import type { LLMProvider } from '../narrate/providers/interface.js'

// A commit-only ("non-GSD") timeline: no `phases/…` paths, so the phase grouper
// puts every event in one "ungrouped" bucket. Before the size-splitter + system-
// prompt-aware budget, this dead-ended on a single over-budget chunk that
// guardTokens rejected. It must now chunk and narrate successfully.
function makeCommit(i: number): TimelineEvent {
  return {
    id: `commit-${i}`,
    date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
    source: 'git-commit',
    summary: `feat(area-${i}): ${'implement a moderately detailed change worth narrating. '.repeat(3)}`,
    metadata: { hash: `hash${i}` },
    dateConfidence: 'exact',
    rawContent: 'x',
    artifactType: 'git-commit',
    crossRefs: [],
  }
}

function makeArc(beatTitle: string): StoryArc {
  return {
    version: '1',
    beats: [
      { type: 'result', title: beatTitle, summary: 's', evidence: [], sourceEventIds: [], significance: 2 },
    ],
    metadata: { generatedAt: '2026-01-01T00:00:00Z', style: 'story', sourceTimeline: '/project' },
  }
}

describe('narrate() on an oversized non-GSD timeline (3.3)', () => {
  it('chunks and synthesizes instead of dead-ending on one "ungrouped" chunk', async () => {
    const events = Array.from({ length: 40 }, (_, i) => makeCommit(i))
    const timeline: Timeline = {
      version: '1',
      rootDir: '/project',
      scannedAt: '2026-01-01T00:00:00Z',
      dateRange: { start: '2026-01-01', end: '2026-01-28' },
      events,
    }

    // Budget = system prompt + only a little headroom, so the payload must split
    // into several chunks. Derived from the real prompt so the test is robust to
    // prompt-size changes (this is the fix: the system prompt counts against it).
    const systemTokens = estimateTokens(
      buildSystemPrompt('story', { rootDir: '/project', scannedAt: '2026-01-01T00:00:00Z' }),
    )
    const maxInputTokens = systemTokens + 400

    let extractCalls = 0
    let synthesizeCalls = 0
    const provider: LLMProvider = {
      getUsage: vi.fn().mockReturnValue({ calls: 0, inputTokens: 0, outputTokens: 0 }),
      extractStoryArc: vi.fn(async () => {
        extractCalls++
        return makeArc(`chunk beat ${extractCalls}`)
      }),
      synthesizeArcs: vi.fn(async () => {
        synthesizeCalls++
        return makeArc('synthesized')
      }),
      generateFormat: vi.fn(),
    }

    const arc = await narrate(
      timeline,
      { provider: 'anthropic', style: 'story', apiKey: 'test-key', maxInputTokens },
      provider,
    )

    // It split into multiple chunks and merged them — no dead-end, no throw.
    expect(extractCalls).toBeGreaterThan(1)
    expect(synthesizeCalls).toBe(1)
    expect(arc.beats.length).toBeGreaterThan(0)
  })
})
