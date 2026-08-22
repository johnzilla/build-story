import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import fg from 'fast-glob'
import type {
  TranscriptSource,
  TranscriptSession,
  TranscriptTurn,
  TranscriptFilter,
} from '@buildstory/core'
import { redactSecrets } from './redact.js'

// Claude Code stores one .jsonl per session under ~/.claude/projects/<encoded-cwd>/.
// Each line is a record; the ones we care about are type "user" (human prompts
// as a string; tool results come through as array content, which we skip) and
// type "assistant" (content is an array of thinking/text/tool_use blocks).

interface RawBlock {
  type?: string
  text?: string
  thinking?: string
  name?: string
}

interface RawRecord {
  type?: string
  timestamp?: string
  sessionId?: string
  cwd?: string
  isSidechain?: boolean
  isMeta?: boolean
  message?: { role?: string; model?: string; content?: unknown }
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function turn(
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

/**
 * Parse one Claude Code session `.jsonl` into a normalized TranscriptSession.
 * Pure (no filesystem) so it can be unit-tested against fixture content.
 * Returns null for a session with no narratively useful turns.
 */
export function parseClaudeCodeSession(
  content: string,
  fallbackId: string,
): TranscriptSession | null {
  const records = content
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l): RawRecord | null => {
      try {
        return JSON.parse(l) as RawRecord
      } catch {
        return null
      }
    })
    .filter((r): r is RawRecord => r !== null)

  const turns: TranscriptTurn[] = []
  const cwds: string[] = []
  const timestamps: string[] = []
  let sessionId = ''
  let model: string | undefined

  for (const r of records) {
    if (r.type !== 'user' && r.type !== 'assistant') continue
    if (r.isSidechain === true || r.isMeta === true) continue
    if (r.sessionId && sessionId === '') sessionId = r.sessionId
    if (r.cwd) cwds.push(r.cwd)
    const ts = asString(r.timestamp)

    if (r.type === 'user') {
      // Human prompts are string content; array content = tool results (skip).
      const text = asString(r.message?.content)
      if (text && text.trim().length > 0) {
        turns.push(turn('user', 'message', text, ts))
        if (ts) timestamps.push(ts)
      }
      continue
    }

    // assistant
    if (model === undefined && typeof r.message?.model === 'string') model = r.message.model
    const content2 = r.message?.content
    if (!Array.isArray(content2)) continue
    for (const block of content2 as RawBlock[]) {
      if (block.type === 'thinking' && typeof block.thinking === 'string') {
        turns.push(turn('agent', 'thought', block.thinking, ts))
      } else if (block.type === 'text' && typeof block.text === 'string') {
        turns.push(turn('agent', 'message', block.text, ts))
      } else if (block.type === 'tool_use' && typeof block.name === 'string') {
        turns.push(turn('agent', 'tool_call', `tool: ${block.name}`, ts, block.name))
      }
    }
    if (ts) timestamps.push(ts)
  }

  if (turns.length === 0) return null

  timestamps.sort()
  // The shallowest cwd is the repo root (tool calls may report subdirectories).
  const rootCwd = cwds.length > 0 ? cwds.reduce((a, b) => (b.length < a.length ? b : a)) : undefined

  const session: TranscriptSession = {
    id: sessionId !== '' ? sessionId : fallbackId,
    harness: 'claude-code',
    turns,
  }
  if (model !== undefined) session.model = model
  if (rootCwd !== undefined) session.cwd = rootCwd
  if (timestamps.length > 0) {
    session.startedAt = timestamps[0]
    session.endedAt = timestamps[timestamps.length - 1]
  }
  return session
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
 * A TranscriptSource over Claude Code's on-disk session store.
 *
 * Reads `~/.claude/projects/(star)(star)/*.jsonl` (override the base dir via
 * `opts.projectsDir`), normalizes each session, and returns those whose working
 * directory is within the requested project. Secret patterns are redacted from
 * every turn during parse.
 */
export function createClaudeCodeTranscriptSource(opts?: {
  projectsDir?: string
}): TranscriptSource {
  const configured = opts?.projectsDir
  const projectsDir =
    configured === undefined
      ? join(homedir(), '.claude', 'projects')
      : configured.startsWith('~/')
        ? join(homedir(), configured.slice(2))
        : configured

  return {
    harness: 'claude-code',
    async listSessions(filter: TranscriptFilter): Promise<TranscriptSession[]> {
      let files: string[]
      try {
        files = await fg('**/*.jsonl', {
          cwd: projectsDir,
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
        const session = parseClaudeCodeSession(content, fallbackId)
        if (session === null) continue
        if (filter.projectPath && !sessionMatchesProject(session.cwd, filter.projectPath)) continue
        if (filter.since && (session.startedAt ?? '') < filter.since) continue
        if (filter.until && (session.startedAt ?? '') > filter.until) continue
        sessions.push(session)
      }

      sessions.sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? ''))
      return sessions
    },
  }
}
