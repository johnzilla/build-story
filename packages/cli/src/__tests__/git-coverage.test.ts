import { describe, it, expect, vi, beforeEach } from 'vitest'
const { raw, revparse } = vi.hoisted(() => ({ raw: vi.fn(), revparse: vi.fn() }))
vi.mock('simple-git', () => ({ simpleGit: () => ({ raw, revparse }) }))
import { createGitSource } from '../adapters/git-source.js'

beforeEach(() => {
  vi.resetAllMocks()
  revparse.mockResolvedValue('true')
})
describe('git coverage disclosure', () => {
  it('reports shallow history and a reached cap without claiming definitive truncation', async () => {
    raw.mockResolvedValue('\x1eabc\x1f2026-01-01\x1fAuthor\x1fSubject\x1f\x1f')
    const source = await createGitSource('/project')
    expect(await source?.getCommits?.({ max: 1 })).toHaveLength(1)
    expect(source?.getCommitWarnings?.().join(' ')).toContain('Shallow repository')
    expect(source?.getCommitWarnings?.().join(' ')).toContain('older history may be omitted')
    expect(source?.getCommitWarnings?.().join(' ')).toContain('current HEAD ancestry')
  })
  it('reports a failed history read and resets warnings after a successful retry', async () => {
    revparse.mockResolvedValue('false')
    raw.mockRejectedValueOnce(new Error('private local error')).mockResolvedValueOnce('')
    const source = await createGitSource('/project')
    expect(await source?.getCommits?.()).toEqual([])
    expect(source?.getCommitWarnings?.().join(' ')).toContain('could not be read')
    expect(source?.getCommitWarnings?.().join(' ')).not.toContain('private local error')
    await source?.getCommits?.()
    expect(source?.getCommitWarnings?.().join(' ')).not.toContain('could not be read')
  })
})
