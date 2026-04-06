import { describe, it, expect, vi } from 'vitest'
import type { StoryArc } from '../types/story.js'
import type { LLMProvider } from '../narrate/providers/interface.js'

const makeArc = (overrides: Partial<StoryArc> = {}): StoryArc => ({
  version: '1',
  beats: [
    {
      type: 'idea',
      title: 'Initial concept',
      summary: 'The project started with a spark of an idea.',
      evidence: ['evidence item'],
      sourceEventIds: ['evt-1'],
      significance: 2,
    },
  ],
  metadata: {
    generatedAt: '2026-01-01T00:00:00Z',
    style: 'technical',
    sourceTimeline: '/test',
  },
  ...overrides,
})

const makeMockProvider = (generateFormatReturn = 'Generated text output'): LLMProvider => ({
  extractStoryArc: vi.fn(),
  generateFormat: vi.fn().mockResolvedValue(generateFormatReturn),
  synthesizeArcs: vi.fn(),
})

// Import format after setup
const { format } = await import('./index.js')

describe('format()', () => {
  it('calls provider.generateFormat with correct arguments', async () => {
    const arc = makeArc()
    const provider = makeMockProvider('some output text')

    await format(arc, 'outline', provider)

    expect(provider.generateFormat).toHaveBeenCalledOnce()
    const [calledArc, calledFormatType, calledPrompt] = (provider.generateFormat as ReturnType<typeof vi.fn>).mock
      .calls[0] as [StoryArc, string, string]
    expect(calledArc).toBe(arc)
    expect(calledFormatType).toBe('outline')
    expect(typeof calledPrompt).toBe('string')
    expect(calledPrompt.length).toBeGreaterThan(0)
  })

  it('appends metadata footer with word count, reading time, style, and format', async () => {
    const arc = makeArc()
    const provider = makeMockProvider('Hello world this is a test')

    const result = await format(arc, 'blog', provider)

    expect(result).toContain('---')
    expect(result).toContain('Word count:')
    expect(result).toContain('Reading time:')
    expect(result).toContain('Style: technical')
    expect(result).toContain('Format: blog')
  })

  it('calculates word count correctly for known input', async () => {
    const arc = makeArc()
    // 5 words exactly
    const provider = makeMockProvider('one two three four five')

    const result = await format(arc, 'outline', provider)

    expect(result).toContain('Word count: 5')
  })

  it('calculates reading time = 1 for 150 words (ceil(150/200) = 1)', async () => {
    const arc = makeArc()
    // Generate a string of exactly 150 words
    const words = Array.from({ length: 150 }, (_, i) => `word${i}`).join(' ')
    const provider = makeMockProvider(words)

    const result = await format(arc, 'thread', provider)

    expect(result).toContain('Reading time: ~1 min')
  })

  it('calculates reading time = 2 for 250 words (ceil(250/200) = 2)', async () => {
    const arc = makeArc()
    // Generate a string of exactly 250 words
    const words = Array.from({ length: 250 }, (_, i) => `word${i}`).join(' ')
    const provider = makeMockProvider(words)

    const result = await format(arc, 'blog', provider)

    expect(result).toContain('Reading time: ~2 min')
  })

  it('uses ceil for reading time — 201 words = 2 min', async () => {
    const arc = makeArc()
    const words = Array.from({ length: 201 }, (_, i) => `word${i}`).join(' ')
    const provider = makeMockProvider(words)

    const result = await format(arc, 'outline', provider)

    expect(result).toContain('Reading time: ~2 min')
  })

  it('returns the generated text with footer appended (not replaced)', async () => {
    const arc = makeArc()
    const generatedText = 'This is the main content of the format output.'
    const provider = makeMockProvider(generatedText)

    const result = await format(arc, 'video-script', provider)

    expect(result).toContain(generatedText)
    expect(result.startsWith(generatedText)).toBe(true)
  })

  it('metadata footer includes format type matching the argument passed', async () => {
    const arc = makeArc()
    const provider = makeMockProvider('some text')

    const threadResult = await format(arc, 'thread', provider)
    expect(threadResult).toContain('Format: thread')

    const scriptResult = await format(arc, 'video-script', provider)
    expect(scriptResult).toContain('Format: video-script')
  })

  it('metadata footer includes style from arc.metadata.style', async () => {
    const arc = makeArc({ metadata: { generatedAt: '2026-01-01T00:00:00Z', style: 'pitch', sourceTimeline: '/test' } })
    const provider = makeMockProvider('text')

    const result = await format(arc, 'outline', provider)

    expect(result).toContain('Style: pitch')
  })
})
