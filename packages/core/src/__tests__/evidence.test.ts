import { describe, expect, it } from 'vitest'
import { extractExcerpts, MAX_EXCERPTS } from '../scan/evidence.js'
import { parseArtifact } from '../scan/artifact-parser.js'
import { scan } from '../scan/index.js'
import { buildCommitEvents } from '../scan/commit-source.js'
import { buildTranscriptEvents } from '../scan/transcript-source.js'
import { buildNarrationPreview } from '../narrate/prepare.js'
import { buildTimelinePayload } from '../narrate/tokens.js'
import { TimelineSchema } from '../types/timeline.js'
import type { ArtifactSource } from '../types/source.js'

const content = '# Design\n\n## Problem\n\nWrites were slow under load.\n\n## Alternatives\n\nWe compared a queue with a direct write.\n\n## Decision\n\nWe chose a queue because retries must survive restarts.\n\n## Outcome\n\nThe retry tests passed after a forced restart.\n'
const source: ArtifactSource = { readFile: async () => content, glob: async () => ['docs/design.md'] }

it('retains bounded decision prose alongside the existing heading summary', async () => {
  const parsed = await parseArtifact(content, 'docs/design.md', source, new Set())
  expect(parsed.summary).toContain('## Decision')
  expect(parsed.summary).not.toContain('retries must survive')
  expect(parsed.excerpts).toHaveLength(4)
  expect(parsed.excerpts[2]).toMatchObject({ text: 'We chose a queue because retries must survive restarts.', topics: ['decision'], section: 'Design / Decision', locator: { kind: 'lines', startLine: 13, endLine: 13 } })
  expect(parsed.rawContent).toBe(content)
})

it('extracts meaningful prose even without headings', () => {
  expect(extractExcerpts('We rejected polling because it was too slow.')[0]?.topics).toEqual(['problem', 'alternative', 'decision'])
})

it('includes decision paragraphs in lists and blockquotes without duplicate excerpts', () => {
  const excerpts = extractExcerpts('- We chose SQLite because a local file is enough.\n\n> We chose SQLite because a local file is enough.\n\n- Tests passed.')
  expect(excerpts).toHaveLength(2)
})

it('reserves room for alternatives, choices, and late outcomes', () => {
  const many = Array.from({ length: 20 }, (_, i) => `Problem ${i}: a request failed.`).join('\n\n') + '\n\nWe compared SQLite and Postgres.\n\nWe chose SQLite.\n\nThe load tests passed.'
  const excerpts = extractExcerpts(many)
  expect(excerpts).toHaveLength(MAX_EXCERPTS)
  expect(excerpts.map(e => e.text)).toContain('The load tests passed.')
  expect(excerpts.map(e => e.text)).toContain('We compared SQLite and Postgres.')
  expect(excerpts.map(e => e.text)).toContain('We chose SQLite.')
  const lines = excerpts.map(e => e.locator.kind === 'lines' ? e.locator.startLine : 0)
  expect(lines).toEqual([...lines].sort((a, b) => a - b))
})

it('redacts secrets and local paths before enforcing excerpt limits', () => {
  const text = 'We chose a local cache because ' + 'x'.repeat(300) + ' password="' + 'private-value '.repeat(100) + '" under /Users/alice/private-project.'
  const excerpt = extractExcerpts(text)[0]!
  expect(excerpt.text).toContain('[REDACTED]')
  expect(excerpt.text).not.toContain('private-value')
  expect(excerpt.text).not.toContain('/Users/alice')
  expect(Array.from(excerpt.text).length).toBeLessThanOrEqual(400)
})

it('bounds Unicode passages and marks truncation without splitting surrogate pairs', () => {
  const excerpt = extractExcerpts('We chose ' + '😀'.repeat(500))[0]!
  expect(Array.from(excerpt.text)).toHaveLength(400)
  expect(excerpt.truncated).toBe(true)
  expect(excerpt.text.endsWith('…')).toBe(true)
  expect(excerpt.text).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/)
})

it.each(['---', '---json', '---javascript', '+++'])('excludes %s frontmatter while preserving scanned line references', fence => {
  const closing = fence.startsWith('---') ? '---' : '+++'
  const excerpts = extractExcerpts(`${fence}\nDecision = "FRONTMATTER_SENTINEL"\n${closing}\n\nWe chose SQLite.`)
  expect(excerpts).toHaveLength(1)
  expect(excerpts[0]!.locator).toEqual({ kind: 'lines', startLine: 5, endLine: 5 })
  expect(JSON.stringify(excerpts)).not.toContain('FRONTMATTER_SENTINEL')
})

it('excludes code blocks, raw HTML, and unterminated frontmatter', () => {
  expect(extractExcerpts('```js\n// We chose CODE_SENTINEL\n```\n\n<div>We chose HTML_SENTINEL</div>')).toEqual([])
  expect(extractExcerpts('---\nDecision: UNTERMINATED_SENTINEL')).toEqual([])
})

it('does not invent evidence for routine prose', () => {
  expect(extractExcerpts('# Welcome\n\nHello from the project.')).toEqual([])
})

it('preserves late commit rationale beyond the summary body limit', () => {
  const body = 'Routine maintenance. '.repeat(80) + '\n\nWe chose a queue because it preserves retries.'
  const event = buildCommitEvents([{ hash: 'abc123', date: '2026-09-27', author: 'Alice', subject: 'Update storage', body, files: [], insertions: 0, deletions: 0 }])[0]!
  expect(event.summary).not.toContain('preserves retries')
  expect(event.excerpts?.[0]).toMatchObject({ text: 'We chose a queue because it preserves retries.', locator: { kind: 'lines', startLine: 5, endLine: 5 } })
})

it('retains speaker/turn attribution and omits private thinking and tool output', () => {
  const event = buildTranscriptEvents([{ id: 'session-1', harness: 'test', startedAt: '2026-09-27', turns: [
    { role: 'user', kind: 'message', text: 'We considered Redis as an alternative.' },
    { role: 'agent', kind: 'thought', text: 'We chose PRIVATE_THOUGHT.' },
    { role: 'tool', kind: 'tool_result', text: 'Tests passed TOOL_SENTINEL.' },
    { role: 'agent', kind: 'message', text: 'We chose SQLite because it runs locally.', timestamp: '2026-09-27T12:00:00Z' },
  ] }])[0]!
  expect(event.excerpts).toHaveLength(2)
  expect(event.excerpts?.[1]?.locator).toEqual({ kind: 'turn', turnIndex: 4, role: 'agent', timestamp: '2026-09-27T12:00:00Z' })
  expect(JSON.stringify(event.excerpts)).not.toMatch(/PRIVATE_THOUGHT|TOOL_SENTINEL/)
})

it('selects evidence from later conversation turns beyond the summary cutoff', () => {
  const event = buildTranscriptEvents([{ id: 'late', harness: 'test', startedAt: '2026-09-27', turns: [
    ...Array.from({ length: 20 }, () => ({ role: 'user' as const, kind: 'message' as const, text: 'Continue please.' })),
    { role: 'user', kind: 'message', text: 'We chose SQLite because offline use matters.' },
  ] }])[0]!
  expect(event.summary).not.toContain('offline use matters')
  expect(event.excerpts?.[0]?.locator).toMatchObject({ kind: 'turn', turnIndex: 21 })
})

describe('evidence in provider inputs', () => {
  it('carries scanned excerpts through schema validation and previews without rawContent', async () => {
    const timeline = TimelineSchema.parse(await scan(source, { rootDir: '/private/project' }))
    const preview = buildNarrationPreview(timeline, { style: 'story' })
    const payload = JSON.parse(preview.requests[0]!.user)
    expect(payload.events[0].excerpts).toHaveLength(4)
    expect(payload.events[0].rawContent).toBeUndefined()
    expect(preview.requests[0]!.system).toContain('not proof that an action happened')
    expect(preview.requests[0]!.user).toBe(buildTimelinePayload(timeline))
  })

  it('supports old timelines without excerpts and sanitizes imported excerpt text again', async () => {
    const timeline = await scan(source, { rootDir: '/private/project' })
    delete timeline.events[0]!.excerpts
    expect(TimelineSchema.safeParse(timeline).success).toBe(true)
    timeline.events[0]!.excerpts = [{ text: 'We chose password="imported secret".', topics: ['decision'], truncated: false, locator: { kind: 'lines', startLine: 1, endLine: 1 } }]
    expect(buildTimelinePayload(timeline)).not.toContain('imported secret')
    expect(buildTimelinePayload(timeline)).toContain('[REDACTED]')
  })
})
