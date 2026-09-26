import { describe, it, expect, vi } from 'vitest'
import { redactSecrets } from './redact.js'
import { sanitizeOutboundValue, sanitizeOutboundText, sanitizeTimeline, sanitizeStoryArc } from './outbound.js'
import { buildTimelinePayload } from '../narrate/tokens.js'
import { buildNarrationPreview } from '../narrate/prepare.js'
import { narrate } from '../narrate/index.js'
import { format } from '../format/index.js'
import type { Timeline } from '../types/timeline.js'
import type { StoryArc } from '../types/story.js'
import type { LLMProvider } from '../narrate/providers/interface.js'

const privateRoot = '/Users/private-person/work/private-project'
const secret = 'synthetic private value'
const timeline: Timeline = {
  version: '1', rootDir: privateRoot, scannedAt: '2026-09-26',
  dateRange: { start: '2026-09-01', end: '2026-09-26' },
  events: [{
    id: 'evt-1', date: '2026-09-01', source: 'file', dateConfidence: 'exact',
    path: 'docs/decision.md',
    summary: `Changed config: ${JSON.stringify({ password: secret })}`,
    metadata: { cwd: privateRoot, nested: [{ apiKey: secret, attempts: 3 }] },
    rawContent: 'RAW CONTENT MUST STAY LOCAL', crossRefs: ['docs/plan.md'],
  }],
}
const arc: StoryArc = {
  version: '1',
  metadata: { generatedAt: '2026-09-26', style: 'story', sourceTimeline: privateRoot },
  beats: [{
    type: 'decision', title: 'Config change', summary: `password="${secret}"`,
    evidence: [`Read ${privateRoot}/docs/decision.md`], sourceEventIds: ['evt-1'], significance: 2,
  }],
}

describe('privacy policy', () => {
  it.each(['password', 'api_key', 'apiKey', 'accessToken', 'AWS_SECRET_ACCESS_KEY', 'authorization'])(
    'redacts quoted %s values including escapes and spaces', (key) => {
      const value = 'fake "quoted" value, with spaces\\and escapes'
      const result = redactSecrets(JSON.stringify({ [key]: value, normal: 'keep me' }))
      expect(JSON.parse(result)).toEqual({ [key]: '[REDACTED]', normal: 'keep me' })
      expect(redactSecrets(result)).toBe(result)
    },
  )

  it('redacts single-quoted values and unquoted assignments', () => {
    expect(redactSecrets("password='fake long value' token=synthetic-value"))
      .toBe("password='[REDACTED]' token=[REDACTED]")
  })

  it('removes URL credentials but keeps ordinary web links', () => {
    expect(sanitizeOutboundText('https://person:synthetic-pass@example.com/docs'))
      .toBe('https://[REDACTED]@example.com/docs')
    expect(sanitizeOutboundText('cwd:/Users/private-person/repo')).toBe('cwd:[LOCAL_PATH]')
  })

  it('redacts structured sensitive values of any type without changing the input', () => {
    const value = { password: ['one', 'two'], nested: { refreshToken: { value: secret } }, count: 3 }
    expect(sanitizeOutboundValue(value)).toEqual({ password: '[REDACTED]', nested: { refreshToken: '[REDACTED]' }, count: 3 })
    expect(value.password).toEqual(['one', 'two'])
  })

  it.each([privateRoot, 'C:\\Users\\private-person\\repo', '\\\\private-server\\share\\repo', '~/private/repo', 'file:///Users/private-person/repo'])(
    'removes local paths in text: %s', (path) => {
      const result = sanitizeOutboundText(`Read ${path} then docs/decision.md https://example.com/docs`)
      expect(result).not.toContain(path)
      expect(result).toContain('docs/decision.md https://example.com/docs')
    },
  )

  it('sanitizes imported timelines at the payload boundary', () => {
    const payload = JSON.parse(buildTimelinePayload(timeline))
    const text = JSON.stringify(payload)
    expect(text).not.toContain(secret)
    expect(text).not.toContain(privateRoot)
    expect(text).not.toContain('RAW CONTENT')
    expect(text).not.toContain('rawContent')
    expect(payload.rootDir).toBe('private-project')
    expect(payload.events[0].id).toBe('evt-1')
    expect(payload.events[0].path).toBe('docs/decision.md')
    expect(payload.events[0].metadata.nested[0].apiKey).toBe('[REDACTED]')
    expect(payload.events[0].metadata).not.toHaveProperty('cwd')
    expect(timeline.events[0]!.rawContent).toBe('RAW CONTENT MUST STAY LOCAL')
  })

  it('is idempotent for sanitized timelines and story arcs', () => {
    expect(sanitizeTimeline(sanitizeTimeline(timeline))).toEqual(sanitizeTimeline(timeline))
    expect(sanitizeStoryArc(sanitizeStoryArc(arc))).toEqual(sanitizeStoryArc(arc))
  })

  it('previews the exact extraction prompts and sanitizes custom-provider inputs', async () => {
    const preview = buildNarrationPreview(timeline, { style: 'story' })
    const provider: LLMProvider = {
      extractStoryArc: vi.fn().mockResolvedValue(arc),
      synthesizeArcs: vi.fn(), generateFormat: vi.fn().mockResolvedValue('Safe output'),
      getUsage: vi.fn(),
    }
    const result = await narrate(timeline, { style: 'story', provider: 'openai', apiKey: 'test-only' }, provider)
    const [sentTimeline, system] = vi.mocked(provider.extractStoryArc).mock.calls[0]!
    expect(preview.requests[0]).toEqual({ system, user: buildTimelinePayload(sentTimeline) })
    for (const value of [preview, sentTimeline, system, result]) {
      expect(JSON.stringify(value)).not.toContain(secret)
      expect(JSON.stringify(value)).not.toContain(privateRoot)
      expect(JSON.stringify(value)).not.toContain('RAW CONTENT')
    }
    await format(arc, 'blog', provider)
    expect(JSON.stringify(vi.mocked(provider.generateFormat).mock.calls)).not.toContain(secret)
    expect(JSON.stringify(vi.mocked(provider.generateFormat).mock.calls)).not.toContain(privateRoot)
  })
})
