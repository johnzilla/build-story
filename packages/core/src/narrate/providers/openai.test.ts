import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StoryArcSchema } from '../../types/story.js'
import type { StoryArc } from '../../types/story.js'
import type { Timeline } from '../../types/timeline.js'

// Mock instances (hoisted so vi.mock factory can reference them)
const mockParse = vi.fn()
const mockCreate = vi.fn()

vi.mock('openai', () => {
  const MockOpenAI = vi.fn().mockImplementation(function () {
    return {
      chat: {
        completions: {
          parse: mockParse,
          create: mockCreate,
        },
      },
    }
  })
  return { default: MockOpenAI }
})

vi.mock('openai/helpers/zod', () => ({
  zodResponseFormat: vi.fn().mockReturnValue({ type: 'json_schema', json_schema: { name: 'story_arc' } }),
}))

const makeTimeline = (overrides: Partial<Timeline> = {}): Timeline => ({
  version: '1',
  rootDir: '/test',
  scannedAt: '2026-01-01T00:00:00Z',
  dateRange: { start: '2026-01-01', end: '2026-01-31' },
  events: [],
  ...overrides,
})

const makeArc = (overrides: Partial<StoryArc> = {}): StoryArc => ({
  version: '1',
  beats: [
    {
      type: 'idea',
      title: 'Test beat',
      summary: 'A test beat summary',
      evidence: ['test evidence'],
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

// Import after mocks are set up
const { OpenAIProvider } = await import('./openai.js')

describe('OpenAIProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('extractStoryArc()', () => {
    it('calls client.chat.completions.parse() with zodResponseFormat', async () => {
      const arc = makeArc()
      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: arc } }],
      })

      const provider = new OpenAIProvider({ apiKey: 'test-key' })
      await provider.extractStoryArc(makeTimeline(), 'system prompt')

      expect(mockParse).toHaveBeenCalledOnce()
      const call = mockParse.mock.calls[0][0] as Record<string, unknown>
      expect(call['response_format']).toBeDefined()
    })

    it('passes temperature:0 to completions.parse()', async () => {
      const arc = makeArc()
      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: arc } }],
      })

      const provider = new OpenAIProvider({ apiKey: 'test-key' })
      await provider.extractStoryArc(makeTimeline(), 'system prompt')

      const call = mockParse.mock.calls[0][0] as Record<string, unknown>
      expect(call['temperature']).toBe(0)
    })

    it('passes system prompt as system message', async () => {
      const arc = makeArc()
      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: arc } }],
      })

      const provider = new OpenAIProvider({ apiKey: 'test-key' })
      await provider.extractStoryArc(makeTimeline(), 'my system prompt')

      const call = mockParse.mock.calls[0][0] as Record<string, unknown>
      const messages = call['messages'] as Array<{ role: string; content: string }>
      const systemMsg = messages.find((m) => m.role === 'system')
      expect(systemMsg?.content).toBe('my system prompt')
    })

    it('post-validates parsed output with StoryArcSchema.parse()', async () => {
      const arc = makeArc()
      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: arc } }],
      })

      const provider = new OpenAIProvider({ apiKey: 'test-key' })
      const result = await provider.extractStoryArc(makeTimeline(), 'system prompt')
      expect(() => StoryArcSchema.parse(result)).not.toThrow()
    })

    it('throws descriptive error when parsed is null (content filter)', async () => {
      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: null } }],
      })

      const provider = new OpenAIProvider({ apiKey: 'test-key' })
      await expect(provider.extractStoryArc(makeTimeline(), 'system prompt')).rejects.toThrow(
        'OpenAI failed to produce structured output',
      )
    })
  })

  describe('generateFormat()', () => {
    it('calls client.chat.completions.create() NOT .parse() for plain text', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Generated text' } }],
      })

      const provider = new OpenAIProvider({ apiKey: 'test-key' })
      await provider.generateFormat(makeArc(), 'outline', 'format prompt')

      expect(mockCreate).toHaveBeenCalledOnce()
      expect(mockParse).not.toHaveBeenCalled()
    })

    it('passes temperature:0 to completions.create()', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'text' } }],
      })

      const provider = new OpenAIProvider({ apiKey: 'test-key' })
      await provider.generateFormat(makeArc(), 'blog', 'system prompt')

      const call = mockCreate.mock.calls[0][0] as Record<string, unknown>
      expect(call['temperature']).toBe(0)
    })

    it('returns the text content from the response', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'The generated format text' } }],
      })

      const provider = new OpenAIProvider({ apiKey: 'test-key' })
      const result = await provider.generateFormat(makeArc(), 'thread', 'system prompt')
      expect(result).toBe('The generated format text')
    })

    it('serializes arc.beats as JSON in user message', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'text' } }],
      })

      const provider = new OpenAIProvider({ apiKey: 'test-key' })
      const arc = makeArc()
      await provider.generateFormat(arc, 'outline', 'system prompt')

      const call = mockCreate.mock.calls[0][0] as Record<string, unknown>
      const messages = call['messages'] as Array<{ role: string; content: string }>
      const userMsg = messages.find((m) => m.role === 'user')
      expect(() => JSON.parse(userMsg?.content ?? '')).not.toThrow()
    })
  })

  describe('synthesizeArcs()', () => {
    it('calls client.chat.completions.parse() for structured output', async () => {
      const arc = makeArc()
      mockParse.mockResolvedValue({
        choices: [{ message: { parsed: arc } }],
      })

      const provider = new OpenAIProvider({ apiKey: 'test-key' })
      await provider.synthesizeArcs([arc], 'system prompt')

      expect(mockParse).toHaveBeenCalledOnce()
    })

    it('merges beats from all arcs into user message', async () => {
      const arc1 = makeArc({
        beats: [{ type: 'idea', title: 'Beat 1', summary: 'S1', evidence: [], sourceEventIds: ['e1'], significance: 1 }],
      })
      const arc2 = makeArc({
        beats: [{ type: 'result', title: 'Beat 2', summary: 'S2', evidence: [], sourceEventIds: ['e2'], significance: 3 }],
      })
      const merged = makeArc()
      mockParse.mockResolvedValue({ choices: [{ message: { parsed: merged } }] })

      const provider = new OpenAIProvider({ apiKey: 'test-key' })
      await provider.synthesizeArcs([arc1, arc2], 'system prompt')

      const call = mockParse.mock.calls[0][0] as Record<string, unknown>
      const messages = call['messages'] as Array<{ role: string; content: string }>
      const userMsg = messages.find((m) => m.role === 'user')
      const beats = JSON.parse(userMsg?.content ?? '[]') as unknown[]
      expect(beats).toHaveLength(2)
    })

    it('passes temperature:0 in synthesis call', async () => {
      const arc = makeArc()
      mockParse.mockResolvedValue({ choices: [{ message: { parsed: arc } }] })

      const provider = new OpenAIProvider({ apiKey: 'test-key' })
      await provider.synthesizeArcs([arc], 'system prompt')

      const call = mockParse.mock.calls[0][0] as Record<string, unknown>
      expect(call['temperature']).toBe(0)
    })

    it('throws descriptive error when synthesis returns null', async () => {
      mockParse.mockResolvedValue({ choices: [{ message: { parsed: null } }] })

      const provider = new OpenAIProvider({ apiKey: 'test-key' })
      await expect(provider.synthesizeArcs([makeArc()], 'system prompt')).rejects.toThrow(
        'OpenAI failed to produce structured output',
      )
    })
  })
})
