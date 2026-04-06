import { describe, it, expect, vi } from 'vitest'
import { readFile } from 'fs/promises'
import { scan, narrate, format, TimelineSchema, StoryArcSchema } from '@buildstory/core'
import type { ArtifactSource, LLMProvider, StoryArc } from '@buildstory/core'

/** Minimal ArtifactSource for testing */
function createTestSource(): ArtifactSource {
  return {
    readFile: (path: string) => readFile(path, 'utf8'),
    glob: async () => [],
  }
}

/** Minimal StoryArc for mock provider responses — matches StoryArcSchema exactly */
function makeArc(style: string): StoryArc {
  return {
    version: '1',
    beats: [
      {
        type: 'goal',
        title: 'Project started',
        summary: 'The project began.',
        evidence: ['README.md'],
        sourceEventIds: [],
        significance: 2,
      },
    ],
    metadata: {
      style,
      generatedAt: new Date().toISOString(),
      sourceTimeline: '.',
    },
  }
}

/** Mock LLMProvider that never makes real network calls */
function createMockProvider(style = 'overview'): LLMProvider {
  return {
    extractStoryArc: vi.fn().mockResolvedValue(makeArc(style)),
    generateFormat: vi.fn().mockResolvedValue('# Mock format output\n\nContent here.'),
    synthesizeArcs: vi.fn().mockResolvedValue(makeArc(style)),
  }
}

describe('pipeline integration', () => {
  it('scan -> narrate -> format completes without error', async () => {
    const source = createTestSource()
    const timeline = await scan(source, { rootDir: '.' })
    TimelineSchema.parse(timeline) // throws if invalid

    const mockProvider = createMockProvider('overview')
    const arc = await narrate(
      timeline,
      { provider: 'anthropic', style: 'overview', apiKey: 'test-key' },
      mockProvider,
    )
    StoryArcSchema.parse(arc) // throws if invalid

    const output = await format(arc, 'outline', mockProvider)
    expect(typeof output).toBe('string')
  })

  it('scan returns Timeline with correct shape', async () => {
    const source = createTestSource()
    const timeline = await scan(source, { rootDir: '.' })
    expect(timeline.version).toBe('1')
    expect(typeof timeline.rootDir).toBe('string')
    expect(typeof timeline.scannedAt).toBe('string')
    expect(Array.isArray(timeline.events)).toBe(true)
  })

  it('narrate returns StoryArc with correct shape', async () => {
    const source = createTestSource()
    const timeline = await scan(source, { rootDir: '.' })
    const mockProvider = createMockProvider('overview')
    const arc = await narrate(
      timeline,
      { provider: 'anthropic', style: 'overview', apiKey: 'test-key' },
      mockProvider,
    )
    expect(arc.version).toBe('1')
    expect(Array.isArray(arc.beats)).toBe(true)
    expect(arc.metadata.style).toBe('overview')
    expect(typeof arc.metadata.generatedAt).toBe('string')
  })

  it('format returns string for all format types', async () => {
    const source = createTestSource()
    const timeline = await scan(source, { rootDir: '.' })
    const mockProvider = createMockProvider('technical')
    const arc = await narrate(
      timeline,
      { provider: 'anthropic', style: 'technical', apiKey: 'test-key' },
      mockProvider,
    )

    const formatTypes = ['outline', 'thread', 'blog', 'video-script'] as const
    for (const ft of formatTypes) {
      const output = await format(arc, ft, mockProvider)
      expect(typeof output).toBe('string')
    }
  })
})
