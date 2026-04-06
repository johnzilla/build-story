import { describe, it, expect, vi } from 'vitest'
import {
  scan,
  narrate,
  format,
  TimelineSchema,
  TimelineEventSchema,
  StoryArcSchema,
  StoryBeatSchema,
} from '../index.js'
import type { ArtifactSource, ScanOptions, NarrateOptions, FormatType, LLMProvider } from '../index.js'

// Minimal in-memory ArtifactSource for testing
const emptySource: ArtifactSource = {
  readFile: async (_path: string) => '',
  glob: async (_patterns: string[], _options?: { cwd?: string; ignore?: string[] }) => [],
}

const emptyArc = StoryArcSchema.parse({
  version: '1',
  beats: [],
  metadata: {
    generatedAt: new Date().toISOString(),
    style: 'technical',
    sourceTimeline: '/test',
  },
})

// Mock LLMProvider for narrate() and format() tests
// (real implementations make SDK calls; tests use injected mocks)
const makeMockProvider = (): LLMProvider => ({
  extractStoryArc: vi.fn().mockResolvedValue(emptyArc),
  generateFormat: vi.fn().mockResolvedValue(''),
  synthesizeArcs: vi.fn().mockResolvedValue(emptyArc),
})

describe('scan()', () => {
  it('returns a valid Timeline object that passes TimelineSchema.parse()', async () => {
    const options: ScanOptions = { rootDir: '/test' }
    const result = await scan(emptySource, options)
    expect(() => TimelineSchema.parse(result)).not.toThrow()
  })

  it('result has version "1" and empty events array', async () => {
    const options: ScanOptions = { rootDir: '/test' }
    const result = await scan(emptySource, options)
    expect(result.version).toBe('1')
    expect(result.events).toEqual([])
  })
})

describe('narrate()', () => {
  it('returns a valid StoryArc object that passes StoryArcSchema.parse()', async () => {
    const timeline = TimelineSchema.parse({
      version: '1',
      rootDir: '/test',
      scannedAt: new Date().toISOString(),
      dateRange: { start: '', end: '' },
      events: [],
    })
    const options: NarrateOptions = {
      provider: 'anthropic',
      style: 'technical',
      apiKey: 'test-key',
    }
    // Inject a mock provider to avoid real SDK calls in unit tests
    const provider = makeMockProvider()
    const result = await narrate(timeline, options, provider)
    expect(() => StoryArcSchema.parse(result)).not.toThrow()
  })

  it('result has version "1" and empty beats array', async () => {
    const timeline = TimelineSchema.parse({
      version: '1',
      rootDir: '/test',
      scannedAt: new Date().toISOString(),
      dateRange: { start: '', end: '' },
      events: [],
    })
    const options: NarrateOptions = {
      provider: 'openai',
      style: 'overview',
      apiKey: 'test-key',
    }
    const provider = makeMockProvider()
    const result = await narrate(timeline, options, provider)
    expect(result.version).toBe('1')
    expect(result.beats).toEqual([])
  })
})

describe('format()', () => {
  it('returns a string', async () => {
    const arc = emptyArc
    const formatType: FormatType = 'outline'
    // Inject a mock provider to avoid real SDK calls in unit tests
    const provider = makeMockProvider()
    const result = await format(arc, formatType, provider)
    expect(typeof result).toBe('string')
  })
})

describe('exports', () => {
  it('scan, narrate, format are exported from barrel', () => {
    expect(typeof scan).toBe('function')
    expect(typeof narrate).toBe('function')
    expect(typeof format).toBe('function')
  })

  it('TimelineSchema, StoryArcSchema are exported', () => {
    expect(TimelineSchema).toBeDefined()
    expect(TimelineEventSchema).toBeDefined()
    expect(StoryArcSchema).toBeDefined()
    expect(StoryBeatSchema).toBeDefined()
  })
})

describe('ESLint boundary rule (schema validation)', () => {
  it('TimelineEventSchema includes dateConfidence field', () => {
    const validEvent = TimelineEventSchema.parse({
      id: 'evt-1',
      date: '2026-01-01',
      source: 'file',
      summary: 'test event',
      metadata: {},
      dateConfidence: 'exact',
      rawContent: '',
    })
    expect(validEvent.dateConfidence).toBe('exact')
  })
})
