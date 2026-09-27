import { SpendBudget } from '../../budget.js'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StoryArcSchema } from '../../types/story.js'
import type { StoryArc } from '../../types/story.js'
import type { Timeline } from '../../types/timeline.js'

// Mock instances (hoisted so vi.mock factory can reference them)
const mockParse = vi.fn()
const mockCreate = vi.fn()

// Real SDK messages.parse()/create() responses always include a usage object;
// the provider reads response.usage to track token spend. Mock it realistically.
const USAGE = { input_tokens: 100, output_tokens: 50 }

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

  it('scrubs secrets and local paths at every SDK request boundary', async () => {
    mockParse.mockResolvedValue({ parsed_output: makeArc(), usage: USAGE })
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'safe output' }], usage: USAGE })
    const provider = new AnthropicProvider({ apiKey: 'test-key' })
    const secret = 'synthetic outbound value'
    const localPath = '/Users/private-reviewer/work/repo'
    const system = `Context ${localPath}; password="${secret}"`
    const timeline = makeTimeline({ rootDir: localPath, events: [{
      id: 'evt-1', date: '2026-01-01', source: 'file', summary: `password="${secret}"`,
      metadata: { apiKey: secret, cwd: localPath }, rawContent: 'RAW PRIVATE', dateConfidence: 'exact',
    }] })
    const arc = makeArc()
    arc.beats[0]!.summary = `password="${secret}"`
    arc.beats[0]!.evidence = [localPath]
    await provider.extractStoryArc(timeline, system)
    await provider.generateFormat(arc, 'blog', system)
    await provider.synthesizeArcs([arc], system)
    const requests = JSON.stringify([...mockParse.mock.calls, ...mockCreate.mock.calls])
    expect(requests).not.toContain(secret)
    expect(requests).not.toContain(localPath)
    expect(requests).not.toContain('RAW PRIVATE')
    expect(requests).toContain('[REDACTED]')
  })

  describe('extractStoryArc()', () => {
    it('calls client.messages.parse() with correct parameters including temperature:0', async () => {
      const arc = makeArc()
      mockParse.mockResolvedValue({ parsed_output: arc, usage: USAGE })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      const timeline = makeTimeline()
      await provider.extractStoryArc(timeline, 'system prompt')

      expect(mockParse).toHaveBeenCalledOnce()
      const call = mockParse.mock.calls[0]![0] as Record<string, unknown>
      expect(call['temperature']).toBe(0)
      expect(call['system']).toBe('system prompt')
      expect(call['max_tokens']).toBe(16384)
    })

    it('calls client.messages.parse() with zodOutputFormat in output_config', async () => {
      const arc = makeArc()
      mockParse.mockResolvedValue({ parsed_output: arc, usage: USAGE })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      await provider.extractStoryArc(makeTimeline(), 'system prompt')

      const call = mockParse.mock.calls[0]![0] as Record<string, unknown>
      expect(call['output_config']).toBeDefined()
    })

    it('post-validates parsed_output with StoryArcSchema.parse()', async () => {
      const arc = makeArc()
      mockParse.mockResolvedValue({ parsed_output: arc, usage: USAGE })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      const result = await provider.extractStoryArc(makeTimeline(), 'system prompt')
      expect(() => StoryArcSchema.parse(result)).not.toThrow()
    })

    it('throws descriptive error when parsed_output is null (refusal)', async () => {
      mockParse.mockResolvedValue({ parsed_output: null, usage: USAGE })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      await expect(provider.extractStoryArc(makeTimeline(), 'system prompt')).rejects.toThrow(
        'Anthropic refused to generate structured output',
      )
    })

    it('includes the user message with timeline payload', async () => {
      const arc = makeArc()
      mockParse.mockResolvedValue({ parsed_output: arc, usage: USAGE })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      const timeline = makeTimeline({ rootDir: '/my-project' })
      await provider.extractStoryArc(timeline, 'system prompt')

      const call = mockParse.mock.calls[0]![0] as Record<string, unknown>
      const messages = call['messages'] as Array<{ role: string; content: string }>
      expect(messages).toHaveLength(1)
      expect(messages[0]?.role).toBe('user')
      expect(JSON.parse(messages[0]!.content).rootDir).toBe('my-project')
      expect(messages[0]?.content).not.toContain('/my-project')
    })
  })

  describe('generateFormat()', () => {
    it('calls client.messages.create() NOT .parse() for plain text output', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Generated format text' }],
        usage: USAGE,
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
        usage: USAGE,
      })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      await provider.generateFormat(makeArc(), 'blog', 'system prompt')

      const call = mockCreate.mock.calls[0]![0] as Record<string, unknown>
      expect(call['temperature']).toBe(0)
    })

    it('serializes arc.beats as JSON in user message', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'text' }],
        usage: USAGE,
      })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      const arc = makeArc()
      await provider.generateFormat(arc, 'thread', 'system prompt')

      const call = mockCreate.mock.calls[0]![0] as Record<string, unknown>
      const messages = call['messages'] as Array<{ role: string; content: string }>
      const userContent = messages[0]?.content ?? ''
      expect(() => JSON.parse(userContent)).not.toThrow()
    })

    it('returns the text content from the response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'The generated text output' }],
        usage: USAGE,
      })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      const result = await provider.generateFormat(makeArc(), 'outline', 'system prompt')
      expect(result).toBe('The generated text output')
    })
  })

  describe('synthesizeArcs()', () => {
    it('calls client.messages.parse() for structured output during synthesis', async () => {
      const arc = makeArc()
      mockParse.mockResolvedValue({ parsed_output: arc, usage: USAGE })

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
      mockParse.mockResolvedValue({ parsed_output: merged, usage: USAGE })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      await provider.synthesizeArcs([arc1, arc2], 'system prompt')

      const call = mockParse.mock.calls[0]![0] as Record<string, unknown>
      const messages = call['messages'] as Array<{ role: string; content: string }>
      const beats = JSON.parse(messages[0]?.content ?? '[]') as unknown[]
      expect(beats).toHaveLength(2)
    })

    it('passes temperature:0 in synthesis call', async () => {
      const arc = makeArc()
      mockParse.mockResolvedValue({ parsed_output: arc, usage: USAGE })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      await provider.synthesizeArcs([arc], 'system prompt')

      const call = mockParse.mock.calls[0]![0] as Record<string, unknown>
      expect(call['temperature']).toBe(0)
    })

    it('throws descriptive error when synthesis returns null', async () => {
      mockParse.mockResolvedValue({ parsed_output: null, usage: USAGE })

      const provider = new AnthropicProvider({ apiKey: 'test-key' })
      await expect(provider.synthesizeArcs([makeArc()], 'system prompt')).rejects.toThrow(
        'Anthropic refused to generate structured output during arc synthesis',
      )
    })
  })
})


describe('per-request budget enforcement', () => {
  beforeEach(() => { mockParse.mockReset(); mockCreate.mockReset() })
  it.each(['extract', 'synthesize', 'format'])('blocks %s before its SDK request', async (operation) => {
    const provider = new AnthropicProvider({ apiKey: 'test', budget: new SpendBudget(0.0001) })
    const result = operation === 'extract' ? provider.extractStoryArc(makeTimeline(), 'prompt')
      : operation === 'synthesize' ? provider.synthesizeArcs([makeArc()], 'prompt')
        : provider.generateFormat(makeArc(), 'blog', 'prompt')
    await expect(result).rejects.toThrow('--max-cost')
    expect(mockParse).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })
  it('rechecks the next extraction and retains the first call’s reported usage', async () => {
    const budget = new SpendBudget(.30)
    const provider = new AnthropicProvider({ apiKey: 'test', budget })
    mockParse.mockResolvedValue({ parsed_output: makeArc(), usage: { input_tokens: 100, output_tokens: 12000 } })
    await provider.extractStoryArc(makeTimeline(), 'prompt')
    await expect(provider.extractStoryArc(makeTimeline(), 'prompt')).rejects.toThrow('--max-cost')
    expect(mockParse).toHaveBeenCalledTimes(1)
    expect(budget.snapshot()[0]?.basis).toBe('usage')
    expect(mockParse.mock.calls[0]![0].max_tokens).toBe(16384)
  })
  it('keeps the reservation on a lost response', async () => {
    const budget = new SpendBudget(1)
    mockParse.mockRejectedValue(new Error('Connection lost'))
    const provider = new AnthropicProvider({ apiKey: 'test', budget })
    await expect(provider.extractStoryArc(makeTimeline(), 'prompt')).rejects.toThrow('Connection lost')
    expect(budget.snapshot()[0]?.basis).toBe('unknown')
    expect(budget.snapshot()[0]?.usd).toBeGreaterThan(0)
  })
})


it('aborts a stalled SDK response without retrying and retains uncertain spending', async () => {
  vi.useFakeTimers()
  try {
    mockParse.mockClear().mockImplementationOnce((_request, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
    }))
    const budget = new SpendBudget(10)
    const provider = new AnthropicProvider({ apiKey: 'test', budget })
    const caught = provider.extractStoryArc(makeTimeline(), 'test prompt').catch(e => e)
    await vi.advanceTimersByTimeAsync(600_000)
    expect(await caught).toMatchObject({ message: expect.stringContaining('timed out') })
    expect(mockParse).toHaveBeenCalledOnce()
    expect(budget.snapshot()[0]?.basis).toBe('unknown')
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})
