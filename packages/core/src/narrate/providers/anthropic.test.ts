import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StoryArcSchema } from '../../types/story.js'
import type { StoryArc } from '../../types/story.js'
import type { Timeline } from '../../types/timeline.js'

// Mock instances (hoisted so vi.mock factory can reference them)
const mockParse = vi.fn()
const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = vi.fn().mockImplementation(function () {
    return {
      messages: {
        parse: mockParse,
        create: mockCreate,
      },
    }
  })
  return { default: MockAnthropic }
})

vi.mock('@anthropic-ai/sdk/helpers/zod', () => ({
  zodOutputFormat: vi.fn().mockReturnValue({ type: 'zod_schema_mock' }),
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
const { AnthropicProvider } = await import('./anthropic.js')

describe('AnthropicProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('extractStoryArc()', () => {
    it('calls client.messages.parse() with correct parameters including temperature:0', async () => {
      const arc = makeArc()
      mockParse.mockResolvedValue({ parsed_output: arc })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      const timeline = makeTimeline()
      await provider.extractStoryArc(timeline, 'system prompt')

      expect(mockParse).toHaveBeenCalledOnce()
      const call = mockParse.mock.calls[0][0] as Record<string, unknown>
      expect(call['temperature']).toBe(0)
      expect(call['system']).toBe('system prompt')
      expect(call['max_tokens']).toBe(16384)
    })

    it('calls client.messages.parse() with zodOutputFormat in output_config', async () => {
      const arc = makeArc()
      mockParse.mockResolvedValue({ parsed_output: arc })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      await provider.extractStoryArc(makeTimeline(), 'system prompt')

      const call = mockParse.mock.calls[0][0] as Record<string, unknown>
      expect(call['output_config']).toBeDefined()
    })

    it('post-validates parsed_output with StoryArcSchema.parse()', async () => {
      const arc = makeArc()
      mockParse.mockResolvedValue({ parsed_output: arc })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      const result = await provider.extractStoryArc(makeTimeline(), 'system prompt')
      expect(() => StoryArcSchema.parse(result)).not.toThrow()
    })

    it('throws descriptive error when parsed_output is null (refusal)', async () => {
      mockParse.mockResolvedValue({ parsed_output: null })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      await expect(provider.extractStoryArc(makeTimeline(), 'system prompt')).rejects.toThrow(
        'Anthropic refused to generate structured output',
      )
    })

    it('includes the user message with timeline payload', async () => {
      const arc = makeArc()
      mockParse.mockResolvedValue({ parsed_output: arc })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      const timeline = makeTimeline({ rootDir: '/my-project' })
      await provider.extractStoryArc(timeline, 'system prompt')

      const call = mockParse.mock.calls[0][0] as Record<string, unknown>
      const messages = call['messages'] as Array<{ role: string; content: string }>
      expect(messages).toHaveLength(1)
      expect(messages[0]?.role).toBe('user')
      expect(messages[0]?.content).toContain('/my-project')
    })
  })

  describe('generateFormat()', () => {
    it('calls client.messages.create() NOT .parse() for plain text output', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Generated format text' }],
      })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      const arc = makeArc()
      await provider.generateFormat(arc, 'outline', 'format system prompt')

      expect(mockCreate).toHaveBeenCalledOnce()
      expect(mockParse).not.toHaveBeenCalled()
    })

    it('passes temperature:0 to messages.create()', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'text' }],
      })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      await provider.generateFormat(makeArc(), 'blog', 'system prompt')

      const call = mockCreate.mock.calls[0][0] as Record<string, unknown>
      expect(call['temperature']).toBe(0)
    })

    it('serializes arc.beats as JSON in user message', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'text' }],
      })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      const arc = makeArc()
      await provider.generateFormat(arc, 'thread', 'system prompt')

      const call = mockCreate.mock.calls[0][0] as Record<string, unknown>
      const messages = call['messages'] as Array<{ role: string; content: string }>
      const userContent = messages[0]?.content ?? ''
      expect(() => JSON.parse(userContent)).not.toThrow()
    })

    it('returns the text content from the response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'The generated text output' }],
      })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      const result = await provider.generateFormat(makeArc(), 'outline', 'system prompt')
      expect(result).toBe('The generated text output')
    })
  })

  describe('synthesizeArcs()', () => {
    it('calls client.messages.parse() for structured output during synthesis', async () => {
      const arc = makeArc()
      mockParse.mockResolvedValue({ parsed_output: arc })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      await provider.synthesizeArcs([arc, arc], 'system prompt')

      expect(mockParse).toHaveBeenCalledOnce()
    })

    it('merges beats from all arcs into a single user message', async () => {
      const arc1 = makeArc({
        beats: [{ type: 'idea', title: 'Beat 1', summary: 'Summary 1', evidence: [], sourceEventIds: ['evt-1'], significance: 1 }],
      })
      const arc2 = makeArc({
        beats: [{ type: 'result', title: 'Beat 2', summary: 'Summary 2', evidence: [], sourceEventIds: ['evt-2'], significance: 2 }],
      })
      const merged = makeArc()
      mockParse.mockResolvedValue({ parsed_output: merged })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      await provider.synthesizeArcs([arc1, arc2], 'system prompt')

      const call = mockParse.mock.calls[0][0] as Record<string, unknown>
      const messages = call['messages'] as Array<{ role: string; content: string }>
      const beats = JSON.parse(messages[0]?.content ?? '[]') as unknown[]
      expect(beats).toHaveLength(2)
    })

    it('passes temperature:0 in synthesis call', async () => {
      const arc = makeArc()
      mockParse.mockResolvedValue({ parsed_output: arc })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      await provider.synthesizeArcs([arc], 'system prompt')

      const call = mockParse.mock.calls[0][0] as Record<string, unknown>
      expect(call['temperature']).toBe(0)
    })

    it('throws descriptive error when synthesis returns null', async () => {
      mockParse.mockResolvedValue({ parsed_output: null })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      await expect(provider.synthesizeArcs([makeArc()], 'system prompt')).rejects.toThrow(
        'Anthropic refused to generate structured output during arc synthesis',
      )
    })
  })
})
