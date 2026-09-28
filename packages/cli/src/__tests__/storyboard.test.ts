import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { StoryArc } from '@buildstory/core'
import { storyboardCommand } from '../commands/storyboard.js'
import { storyboardPage } from '../storyboard-page.js'
vi.mock('../config.js', () => ({ loadConfig: () => ({}) }))
vi.mock('openai', () => ({ default: function () { throw new Error('No API client allowed') } }))
let out: string
const arc: StoryArc = { version: '1', beats: [{ type: 'idea', title: 'Review', summary: 'Test narration', evidence: [], sourceEventIds: [], significance: 2 }], metadata: { generatedAt: '2026-09-28', style: 'story', sourceTimeline: 'project' } }
beforeEach(async () => { out = await mkdtemp(join(tmpdir(), 'storyboard-cli-')); await writeFile(join(out, 'arc.json'), JSON.stringify(arc)) })
afterEach(async () => { await rm(out, { recursive: true, force: true }) })
it('creates an offline review and preserves the input and existing reviews', async () => {
  const input = join(out, 'arc.json'), original = await readFile(input, 'utf8')
  await storyboardCommand(input, {})
  const page = await readFile(join(out, 'storyboard/storyboard.html'), 'utf8')
  expect(page).toContain('Test narration')
  expect(page).toContain('connect-src \'none\'')
  expect(page).not.toContain('audioPath')
  expect(await readFile(input, 'utf8')).toBe(original)
  expect(await readFile(join(out, 'storyboard/source-review.md'), 'utf8')).toContain('No local source review')
  await expect(storyboardCommand(input, {})).rejects.toThrow('already exists')
  expect(await readFile(join(out, 'storyboard/storyboard.html'), 'utf8')).toBe(page)
})
it.each(['0', '2', '1.5', 'bad'])('rejects scene %s before creating output', async scene => {
  await expect(storyboardCommand(join(out, 'arc.json'), { scene })).rejects.toThrow('--scene')
  await expect(readFile(join(out, 'storyboard/storyboard.html'))).rejects.toMatchObject({ code: 'ENOENT' })
})
it('embeds hostile source text as inert JSON under a nonce CSP', () => {
  const hostile = '</script><script>alert(1)</script><img src=x onerror=alert(1)>'
  const page = storyboardPage({ arc: { ...arc, beats: [{ ...arc.beats[0]!, title: hostile }] }, scenes: [], model: 'tts-1', speed: 1, voice: 'nova', pricePer1000: .015, pronunciationConfigured: false })
  expect(page).not.toContain(hostile)
  expect(page).toContain('\\u003c/script>')
  expect(page.match(/<script/g)).toHaveLength(2)
  const embedded = page.match(/id="data"[^>]*>(.*?)<\/script>/s)![1]!
  expect(JSON.parse(embedded).arc.beats[0].title).toBe(hostile)
})
it('refreshes source review from the supplied timeline before export', async () => {
  const reviewedInput = { ...arc, beats: [{ ...arc.beats[0], sourceEventIds: ['event-1', 'unknown'], evidence: ['A documented development decision.'] }] }
  await writeFile(join(out, 'arc.json'), JSON.stringify(reviewedInput))
  await writeFile(join(out, 'timeline.json'), JSON.stringify({ version: '1', rootDir: 'project', scannedAt: '', dateRange: { start: '', end: '' }, events: [{ id: 'event-1', date: '2026-09-28', source: 'git-commit', dateConfidence: 'exact', summary: 'A documented development decision.', rawContent: '', metadata: {} }] }))
  await storyboardCommand(join(out, 'arc.json'), { timeline: join(out, 'timeline.json') })
  const saved = JSON.parse(await readFile(join(out, 'storyboard/story-arc.json'), 'utf8'))
  expect(saved.beats[0].sourceEventIds).toEqual(['event-1'])
  expect(saved.metadata.review.beats[0].matchedEvidence[0].eventIds).toEqual(['event-1'])
  expect(saved.metadata.review.beats[0].notes.join(' ')).toContain('Unknown source event ID')
})
