import { homedir } from 'node:os'
import { join } from 'node:path'
import type { TranscriptSource, TranscriptSession, TranscriptTurn } from '@buildstory/core'
import { makeTurn, expandTilde, collectSessions } from './transcript-shared.js'

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
        turns.push(makeTurn('user', 'message', text, ts))
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
        turns.push(makeTurn('agent', 'thought', block.thinking, ts))
      } else if (block.type === 'text' && typeof block.text === 'string') {
        turns.push(makeTurn('agent', 'message', block.text, ts))
      } else if (block.type === 'tool_use' && typeof block.name === 'string') {
        turns.push(makeTurn('agent', 'tool_call', `tool: ${block.name}`, ts, block.name))
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
  const first = timestamps[0]
  const last = timestamps[timestamps.length - 1]
  if (first !== undefined) session.startedAt = first
  if (last !== undefined) session.endedAt = last
  return session
}

/**
 * Match a Claude Code project directory name against a project path.
 * Claude Code encodes the cwd by replacing `/` with `-`
 * (`/home/user/app` → `-home-user-app`); sessions run in subdirectories share
 * that prefix. Boundary collisions (e.g. `app` vs `app-2`) are caught by the
 * per-record cwd check in `collectSessions`.
 */
export function matchClaudeCodeDir(dirName: string, projectPath: string): boolean {
  const enc = projectPath.replace(/\/+$/, '').replace(/\//g, '-')
  return dirName === enc || dirName.startsWith(`${enc}-`)
}

/**
 * A TranscriptSource over Claude Code's on-disk session store
 * (`~/.claude/projects/<encoded-cwd>/*.jsonl`; override the base dir via
 * `opts.projectsDir`). Secrets are redacted during parse.
 */
export function createClaudeCodeTranscriptSource(opts?: {
  projectsDir?: string
}): TranscriptSource {
  const projectsDir =
    opts?.projectsDir === undefined
      ? join(homedir(), '.claude', 'projects')
      : expandTilde(opts.projectsDir)

  return {
    harness: 'claude-code',
    listSessions: (filter) =>
      collectSessions(projectsDir, parseClaudeCodeSession, filter, matchClaudeCodeDir),
  }
}
