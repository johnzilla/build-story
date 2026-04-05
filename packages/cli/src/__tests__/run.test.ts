import { describe, it, expect } from 'vitest'
import { readFile } from 'fs/promises'
import { scan, narrate, format, TimelineSchema, StoryArcSchema } from '@buildstory/core'
import type { ArtifactSource } from '@buildstory/core'

/** Minimal ArtifactSource for testing */
function createTestSource(): ArtifactSource {
  return {
    readFile: (path: string) => readFile(path, 'utf8'),
    glob: async () => [],
  }
}

describe('pipeline integration', () => {
  it('scan -> narrate -> format completes without error', async () => {
    const source = createTestSource()
    const timeline = await scan(source, { rootDir: '.' })
    TimelineSchema.parse(timeline) // throws if invalid

    const arc = await narrate(timeline, {
      provider: 'anthropic',
      style: 'overview',
      apiKey: '',
    })
    StoryArcSchema.parse(arc) // throws if invalid

    const output = await format(arc, 'outline')
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
    const arc = await narrate(timeline, {
      provider: 'anthropic',
      style: 'overview',
      apiKey: '',
    })
    expect(arc.version).toBe('1')
    expect(Array.isArray(arc.beats)).toBe(true)
    expect(arc.metadata.style).toBe('overview')
    expect(typeof arc.metadata.generatedAt).toBe('string')
  })

  it('format returns string for all format types', async () => {
    const source = createTestSource()
    const timeline = await scan(source, { rootDir: '.' })
    const arc = await narrate(timeline, {
      provider: 'anthropic',
      style: 'technical',
      apiKey: '',
    })

    const formatTypes = ['outline', 'thread', 'blog', 'video-script'] as const
    for (const ft of formatTypes) {
      const output = await format(arc, ft)
      expect(typeof output).toBe('string')
    }
  })
})
