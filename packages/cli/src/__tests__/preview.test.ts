import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { narrateCommand } from '../commands/narrate.js'
import { renderCommand } from '../commands/render.js'
import { run } from '../commands/run.js'
import { writePayloadPreview } from '../preview.js'

vi.mock('../config.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../config.js')>(),
  loadConfig: () => ({}),
}))

let dir: string
const secret = 'synthetic private preview value'
const root = '/Users/private-preview-person/repo'
const fetchMock = vi.fn(() => { throw new Error('Preview must never use the network') })

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'buildstory-preview-'))
  vi.stubGlobal('fetch', fetchMock)
  for (const key of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'HEYGEN_API_KEY']) vi.stubEnv(key, '')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  fetchMock.mockClear()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  await rm(dir, { recursive: true, force: true })
})

describe('offline payload previews', () => {
  it('previews an imported timeline without keys or network calls', async () => {
    const input = join(dir, 'timeline.json')
    const output = join(dir, 'preview.json')
    await writeFile(input, JSON.stringify({
      version: '1', rootDir: root, scannedAt: '2026-09-26',
      dateRange: { start: '', end: '' },
      events: [{ id: 'one', date: '2026-09-26', source: 'file', summary: 'A decision',
        dateConfidence: 'exact', rawContent: 'RAW PRIVATE', metadata: { password: secret, cwd: root } }],
    }))
    await narrateCommand(input, { output: dir, previewPayload: output })
    const text = await readFile(output, 'utf8')
    expect(text).not.toContain(secret)
    expect(text).not.toContain(root)
    expect(text).not.toContain('RAW PRIVATE')
    expect(JSON.parse(text).requests).toHaveLength(1)
    expect(fetchMock).not.toHaveBeenCalled()
    expect((await stat(output)).mode & 0o777).toBe(0o600)
  })

  it.each(['remotion', 'heygen'])('previews %s narration without preflight or credentials', async (renderer) => {
    const input = join(dir, 'arc.json')
    const output = join(dir, 'preview.json')
    await writeFile(input, JSON.stringify({ version: '1',
      metadata: { generatedAt: '', style: 'story', sourceTimeline: root },
      beats: [{ type: 'decision', title: 'A choice', summary: `password="${secret}"`,
        evidence: [], sourceEventIds: [], significance: 2 }],
    }))
    await renderCommand(input, { output: dir, renderer, previewPayload: output })
    const text = await readFile(output, 'utf8')
    expect(text).not.toContain(secret)
    expect(text).not.toContain(root)
    expect(text).toContain('[REDACTED]')
    expect(JSON.parse(text).requests).toHaveLength(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stops run after previewing scanned content', async () => {
    await writeFile(join(dir, 'README.md'), `---json\n${JSON.stringify({ password: secret })}\n---\n# Decision\n`)
    const output = join(dir, 'preview.json')
    const result = await run(dir, { output: dir, previewPayload: output })
    expect(result?.arc).toBeUndefined()
    expect(await readFile(output, 'utf8')).not.toContain(secret)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses to overwrite an existing input or preview file', async () => {
    const output = join(dir, 'existing.json')
    await writeFile(output, 'keep this file')
    await expect(writePayloadPreview(output, {})).rejects.toThrow()
    expect(await readFile(output, 'utf8')).toBe('keep this file')
  })
})
