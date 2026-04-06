import simpleGit from 'simple-git'
import type { GitSource } from '@buildstory/core'

export async function createGitSource(rootDir: string): Promise<GitSource | null> {
  const git = simpleGit(rootDir, { maxConcurrentProcesses: 4 })

  // Check if rootDir is a git repo
  try {
    await git.revparse(['--is-inside-work-tree'])
  } catch {
    // Not a git repo — return null, scan will proceed without git
    return null
  }

  return {
    getFileDate: async (relativePath: string): Promise<string | null> => {
      try {
        const log = await git.log({
          file: relativePath,
          maxCount: 1,
        })
        return log.latest?.date ?? null
      } catch {
        return null
      }
    },

    getTags: async (): Promise<Array<{ name: string; date: string; message: string }>> => {
      try {
        const raw = await git.raw([
          'tag',
          '-l',
          '--sort=-version:refname',
          '--format=%(refname:short)|%(creatordate:iso-strict)|%(contents:subject)',
        ])
        return raw
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const [name, date, message] = line.split('|')
            return {
              name: name ?? '',
              date: date ?? '',
              message: message ?? '',
            }
          })
      } catch {
        return []
      }
    },
  }
}
