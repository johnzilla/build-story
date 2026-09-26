import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { SpendBudget } from '@buildstory/core'
import { run } from '../commands/run.js'

const state = vi.hoisted(() => ({ budget: undefined as SpendBudget | undefined, formats: 0, failNarration: false }))
vi.mock('../config.js', async (original) => ({ ...await original<typeof import('../config.js')>(), loadConfig: () => ({}) }))
vi.mock('../adapters/git-source.js', () => ({ createGitSource: async () => undefined }))
vi.mock('@buildstory/core', async (original) => ({
  ...await original<typeof import('@buildstory/core')>(),
  scan: async () => ({ version: '1', rootDir: '/test', events: [], dateRange: { start: '', end: '' } }),
  createProvider: (options: { budget: SpendBudget }) => {
    state.budget = options.budget
    return { getUsage: () => ({ calls: 1, inputTokens: 100, outputTokens: 50 }) }
  },
  narrate: async () => {
    const charge = state.budget!.reserve('narration', 0.3)
    if (state.failNarration) throw new Error('Lost response')
    charge.settle(0.1, 'usage')
    return { version: '1', beats: [], metadata: {} }
  },
  format: async () => {
    const charge = state.budget!.reserve('format', 0.3)
    state.formats++
    charge.settle(0.2, 'usage')
    return 'Completed format'
  },
}))
let directory: string
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'buildstory-budget-'))
  state.formats = 0
  state.failNarration = false
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(async () => {
  vi.restoreAllMocks()
  await rm(directory, { recursive: true, force: true })
})
it('keeps completed outputs and reports spend when the next request is blocked', async () => {
  const result = await run(directory, { output: directory, skipVideo: true, maxCost: '0.5' })
  expect(state.formats).toBe(1)
  expect(result?.outputs).toEqual({ outline: 'Completed format' })
  expect(await readFile(join(directory, basename(directory), 'outline.md'), 'utf8')).toBe('Completed format')
  expect(vi.mocked(console.log).mock.calls.flat().join('\n')).toContain('Accounted total: $0.3000')
})
it('reports an uncertain reservation even when narration fails', async () => {
  state.failNarration = true
  await expect(run(directory, { output: directory, skipVideo: true, maxCost: '0.5' })).rejects.toThrow('Lost response')
  expect(vi.mocked(console.log).mock.calls.flat().join('\n')).toContain('Uncertain requests (reserved): $0.3000')
})
