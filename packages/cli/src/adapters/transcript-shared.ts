import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import fg from 'fast-glob'
import type { TranscriptSession, TranscriptTurn, TranscriptFilter } from '@buildstory/core'
import { redactSecrets } from './redact.js'

// Shared building blocks for per-harness transcript adapters (Claude Code, pi,
// and future harnesses). Each adapter supplies a pure `parse(content, id)`
// function; everything else — discovery, redaction, project/date filtering — is
// identical and lives here.

/** Build a redacted, normalized turn. */
export function makeTurn(
  role: TranscriptTurn['role'],
  kind: TranscriptTurn['kind'],
  text: string,
  timestamp: string | undefined,
  toolName?: string,
): TranscriptTurn {
  return {
    role,
    kind,
    text: redactSecrets(text),
    ...(timestamp ? { timestamp } : {}),
    ...(toolName ? { toolName } : {}),
  }
}

/** Normalize a timestamp (ISO string or Unix-ms number) to an ISO string. */
export function toIso(ts: unknown): string | undefined {
  if (typeof ts === 'string' && ts.trim().length > 0) return ts
  if (typeof ts === 'number' && Number.isFinite(ts)) return new Date(ts).toISOString()
  return undefined
}

/** Expand a leading `~/` to the user's home directory. */
export function expandTilde(p: string): string {
  return p.startsWith('~/') ? join(homedir(), p.slice(2)) : p
}

function normalizePath(p: string): string {
  return p.replace(/\/+$/, '')
}

/** True when a session's cwd and the target project path are the same tree. */
export function sessionMatchesProject(
  sessionCwd: string | undefined,
  projectPath: string,
): boolean {
  if (sessionCwd === undefined) return false
  const a = normalizePath(sessionCwd)
  const b = normalizePath(projectPath)
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)
}

/**
 * Discover and parse every `*.jsonl` under `dir`, keeping sessions that match
 * the project path and date window. `parse` is the harness-specific line parser.
 */
export async function collectSessions(
  dir: string,
  parse: (content: string, fallbackId: string) => TranscriptSession | null,
  filter: TranscriptFilter,
): Promise<TranscriptSession[]> {
  let files: string[]
  try {
    files = await fg('**/*.jsonl', {
      cwd: dir,
      absolute: true,
      onlyFiles: true,
      suppressErrors: true,
    })
  } catch {
    return []
  }

  const sessions: TranscriptSession[] = []
  for (const file of files) {
    let content: string
    try {
      content = await readFile(file, 'utf8')
    } catch {
      continue
    }
    const fallbackId = file.split('/').pop()?.replace(/\.jsonl$/, '') ?? file
    const session = parse(content, fallbackId)
    if (session === null) continue
    if (filter.projectPath && !sessionMatchesProject(session.cwd, filter.projectPath)) continue
    if (filter.since && (session.startedAt ?? '') < filter.since) continue
    if (filter.until && (session.startedAt ?? '') > filter.until) continue
    sessions.push(session)
  }

  sessions.sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? ''))
  return sessions
}
