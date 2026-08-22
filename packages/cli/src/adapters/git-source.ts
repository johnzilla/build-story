import { simpleGit } from 'simple-git'
import type {
  GitSource,
  CommitRecord,
  CommitFileChange,
  GetCommitsOptions,
} from '@buildstory/core'
import { redactSecrets } from './redact.js'

// Control characters as delimiters — safe because commit fields never contain them.
const RS = '\x1e' // record separator: precedes each commit
const US = '\x1f' // field separator: between fields, and after the body (so the
// body — which may contain newlines — is unambiguously delimited from the
// --numstat block that git appends on the following lines).

const COMMIT_FORMAT = `${RS}%H${US}%aI${US}%an${US}%s${US}%b${US}`

/** Default cap on commits pulled when the caller doesn't specify one. */
const DEFAULT_MAX_COMMITS = 500

function parseNumstat(raw: string): CommitFileChange[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line): CommitFileChange | null => {
      const cols = line.split('\t')
      if (cols.length < 3) return null
      // Binary files show "-" for both counts.
      const insertions = cols[0] === '-' ? 0 : Number.parseInt(cols[0] ?? '', 10) || 0
      const deletions = cols[1] === '-' ? 0 : Number.parseInt(cols[1] ?? '', 10) || 0
      const path = cols.slice(2).join('\t')
      return { path, insertions, deletions }
    })
    .filter((x): x is CommitFileChange => x !== null)
}

/**
 * Parse the raw output of `git log --numstat --pretty=format:<COMMIT_FORMAT>`
 * into normalized CommitRecords. Pure and exported for testing.
 */
export function parseCommitLog(raw: string): CommitRecord[] {
  if (raw.trim().length === 0) return []

  return raw
    .split(RS)
    .filter((chunk) => chunk.trim().length > 0)
    .map((chunk): CommitRecord => {
      const [hash = '', date = '', author = '', subject = '', body = '', numstat = ''] =
        chunk.split(US)
      const files = parseNumstat(numstat)
      const insertions = files.reduce((sum, f) => sum + f.insertions, 0)
      const deletions = files.reduce((sum, f) => sum + f.deletions, 0)
      return {
        hash: hash.trim(),
        date: date.trim(),
        author: author.trim(),
        // Redact secrets from free-text message fields at ingress (parity with
        // the file and transcript sources).
        subject: redactSecrets(subject.trim()),
        body: redactSecrets(body.trim()),
        files,
        insertions,
        deletions,
      }
    })
    .filter((commit) => commit.hash.length > 0)
}

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
              name: redactSecrets(name ?? ''),
              date: date ?? '',
              message: redactSecrets(message ?? ''),
            }
          })
      } catch {
        return []
      }
    },

    getCommits: async (options?: GetCommitsOptions): Promise<CommitRecord[]> => {
      const args = ['log', `--pretty=format:${COMMIT_FORMAT}`, '--numstat']
      if (!options?.includeMerges) args.push('--no-merges')
      args.push(`--max-count=${options?.max ?? DEFAULT_MAX_COMMITS}`)
      if (options?.since) args.push(`--since=${options.since}`)
      if (options?.paths && options.paths.length > 0) args.push('--', ...options.paths)

      try {
        const raw = await git.raw(args)
        return parseCommitLog(raw)
      } catch {
        return []
      }
    },
  }
}
