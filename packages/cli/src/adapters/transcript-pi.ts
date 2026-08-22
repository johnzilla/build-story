import { homedir } from 'node:os'
import { join } from 'node:path'
import type { TranscriptSource, TranscriptSession, TranscriptTurn } from '@buildstory/core'
import { makeTurn, toIso, expandTilde, collectSessions } from './transcript-shared.js'

// pi (earendil-works/pi) stores one .jsonl per session under
// ~/.pi/agent/sessions/--<encoded-cwd>--/<timestamp>_<uuid>.jsonl.
// Format per packages/coding-agent/docs/session-format.md:
//  - first line: {type:"session", version, id, timestamp, cwd}  (cwd lives ONLY here)
//  - {type:"message", id, parentId, timestamp, message: AgentMessage}
//      user      → message.content is a string OR (text|image)[]
//      assistant → message.content is (text|thinking|toolCall)[], plus message.model
//      toolResult / bashExecution / custom → skipped as narration noise
//  - content blocks: {type:"text",text} | {type:"thinking",thinking} | {type:"toolCall",name,...}
//  - timestamps are ISO on the entry wrapper (Unix-ms inside the message; toIso handles both)
//
// NOTE: pi supports non-linear (branched) sessions via id/parentId. This MVP
// reads every user turn in file order rather than walking the active branch —
// good enough for distilling "what the developer asked", refine later if needed.

interface PiBlock {
  type?: string
  text?: string
  thinking?: string
  name?: string
}

interface PiRecord {
  type?: string
  id?: string
  timestamp?: unknown
  cwd?: string
  modelId?: string
  message?: { role?: string; model?: string; content?: unknown }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** Extract plain text from a pi content field (string, or array of text blocks). */
function piText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((b) => isRecord(b) && b['type'] === 'text' && typeof b['text'] === 'string')
      .map((b) => (b as Record<string, unknown>)['text'] as string)
      .join('\n')
  }
  return ''
}

/**
 * Parse one pi session `.jsonl` into a normalized TranscriptSession.
 * Pure (no filesystem) so it can be unit-tested against fixture content.
 * Returns null for a session with no narratively useful turns.
 */
export function parsePiSession(content: string, fallbackId: string): TranscriptSession | null {
  const records = content
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l): PiRecord | null => {
      try {
        return JSON.parse(l) as PiRecord
      } catch {
        return null
      }
    })
    .filter((r): r is PiRecord => r !== null)

  const turns: TranscriptTurn[] = []
  const timestamps: string[] = []
  let sessionId = ''
  let cwd: string | undefined
  let model: string | undefined

  for (const r of records) {
    const ts = toIso(r.timestamp)
    if (ts) timestamps.push(ts)

    if (r.type === 'session') {
      if (typeof r.id === 'string' && sessionId === '') sessionId = r.id
      if (typeof r.cwd === 'string') cwd = r.cwd
      continue
    }
    if (r.type === 'model_change') {
      if (model === undefined && typeof r.modelId === 'string') model = r.modelId
      continue
    }
    if (r.type !== 'message' || !r.message) continue

    const m = r.message
    if (m.role === 'user') {
      const text = piText(m.content)
      if (text.trim().length > 0) turns.push(makeTurn('user', 'message', text, ts))
    } else if (m.role === 'assistant') {
      if (model === undefined && typeof m.model === 'string') model = m.model
      if (Array.isArray(m.content)) {
        for (const block of m.content as PiBlock[]) {
          if (block.type === 'text' && typeof block.text === 'string') {
            turns.push(makeTurn('agent', 'message', block.text, ts))
          } else if (block.type === 'thinking' && typeof block.thinking === 'string') {
            turns.push(makeTurn('agent', 'thought', block.thinking, ts))
          } else if (block.type === 'toolCall' && typeof block.name === 'string') {
            turns.push(makeTurn('agent', 'tool_call', `tool: ${block.name}`, ts, block.name))
          }
        }
      }
    }
    // toolResult / bashExecution / custom → skipped
  }

  if (turns.length === 0) return null

  timestamps.sort()
  const session: TranscriptSession = {
    id: sessionId !== '' ? sessionId : fallbackId,
    harness: 'pi',
    turns,
  }
  if (model !== undefined) session.model = model
  if (cwd !== undefined) session.cwd = cwd
  const first = timestamps[0]
  const last = timestamps[timestamps.length - 1]
  if (first !== undefined) session.startedAt = first
  if (last !== undefined) session.endedAt = last
  return session
}

/**
 * A TranscriptSource over pi's on-disk session store
 * (`~/.pi/agent/sessions/**\/*.jsonl`; override the base dir via
 * `opts.sessionsDir`). Secrets are redacted during parse.
 */
export function createPiTranscriptSource(opts?: { sessionsDir?: string }): TranscriptSource {
  const dir =
    opts?.sessionsDir === undefined
      ? join(homedir(), '.pi', 'agent', 'sessions')
      : expandTilde(opts.sessionsDir)

  return {
    harness: 'pi',
    listSessions: (filter) => collectSessions(dir, parsePiSession, filter),
  }
}
