import type { TimelineEvent } from '../types/timeline.js'
import type { TranscriptSession } from '../types/transcript.js'
import { generateEventId } from './timeline-builder.js'

/**
 * Build `transcript` timeline events from normalized agent sessions.
 *
 * The narration LLM only sees an event's `summary` and `metadata`
 * (`buildTimelinePayload` strips `rawContent`), so the narrative substance —
 * the human decision trail (what was asked, redirected, decided) — goes in
 * `summary`. Agent reasoning stays in `rawContent` for provenance.
 *
 * One event per session, dated at the session start. The narrator correlates
 * transcripts with commits implicitly: all events share one sorted timeline.
 */

/** Max user turns quoted in a summary before collapsing to a count. */
const MAX_TURNS_IN_SUMMARY = 12
/** Max characters kept per quoted user turn. */
const MAX_TURN_CHARS = 240
/** Max characters of agent text kept in rawContent per turn. */
const MAX_AGENT_CHARS = 500

function truncate(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length <= max ? t : `${t.slice(0, max).trimEnd()}…`
}

function buildTranscriptSummary(session: TranscriptSession): string {
  const userTurns = session.turns.filter((t) => t.role === 'user' && t.text.trim().length > 0)

  const header =
    `Agent session (${session.harness}` +
    (session.model ? `, ${session.model}` : '') +
    `) — ${userTurns.length} human turn${userTurns.length === 1 ? '' : 's'}`

  if (userTurns.length === 0) {
    return `${header}. No human prompts recorded.`
  }

  const shown = userTurns
    .slice(0, MAX_TURNS_IN_SUMMARY)
    .map((t, i) => `${i + 1}. ${truncate(t.text, MAX_TURN_CHARS)}`)
  const remaining = userTurns.length - shown.length
  const more = remaining > 0 ? `\n(+${remaining} more)` : ''

  return `${header}. What the developer asked for, in order:\n${shown.join('\n')}${more}`
}

function buildTranscriptRawContent(session: TranscriptSession): string {
  // Fuller record for provenance (not sent to the LLM): human prompts plus the
  // agent's spoken text (not its verbose internal thoughts).
  return session.turns
    .filter((t) => (t.role === 'user' && t.kind === 'message') || (t.role === 'agent' && t.kind === 'message'))
    .map((t) => `[${t.role}] ${truncate(t.text, MAX_AGENT_CHARS)}`)
    .join('\n')
}

export function buildTranscriptEvents(sessions: TranscriptSession[]): TimelineEvent[] {
  return sessions
    .filter((s) => s.id !== '' && (s.startedAt ?? '') !== '')
    .map((session) => {
      const date = session.startedAt as string
      const userTurns = session.turns.filter((t) => t.role === 'user').length
      const agentTurns = session.turns.filter((t) => t.role === 'agent' && t.kind === 'message').length
      const toolCalls = session.turns.filter((t) => t.kind === 'tool_call').length

      return {
        id: generateEventId('transcript', session.id, date),
        date,
        source: 'transcript' as const,
        summary: buildTranscriptSummary(session),
        metadata: {
          sessionId: session.id,
          harness: session.harness,
          ...(session.model ? { model: session.model } : {}),
          ...(session.cwd ? { cwd: session.cwd } : {}),
          userTurns,
          agentTurns,
          toolCalls,
        },
        dateConfidence: 'exact' as const,
        rawContent: buildTranscriptRawContent(session),
        artifactType: 'transcript' as const,
        crossRefs: [],
      }
    })
}
