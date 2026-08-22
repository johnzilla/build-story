import type { TranscriptSource, TranscriptSession, TranscriptFilter } from '@buildstory/core'
import { createClaudeCodeTranscriptSource } from './transcript-claude-code.js'
import { createPiTranscriptSource } from './transcript-pi.js'

export interface TranscriptConfig {
  enabled?: boolean
  /** Which harnesses to read. Default: all known harnesses. */
  harnesses?: string[]
  /** Override Claude Code's session dir (default ~/.claude/projects). */
  claudeCodePath?: string
  /** Override pi's session dir (default ~/.pi/agent/sessions). */
  piPath?: string
  since?: string
  until?: string
}

export const KNOWN_HARNESSES = ['claude-code', 'pi'] as const
type KnownHarness = (typeof KNOWN_HARNESSES)[number]

function buildOne(name: string, config: TranscriptConfig): TranscriptSource | null {
  switch (name) {
    case 'claude-code':
      return createClaudeCodeTranscriptSource(
        config.claudeCodePath ? { projectsDir: config.claudeCodePath } : undefined,
      )
    case 'pi':
      return createPiTranscriptSource(config.piPath ? { sessionsDir: config.piPath } : undefined)
    default:
      return null
  }
}

/** Fan out over several harness sources, merging and re-sorting their sessions. */
function composite(sources: TranscriptSource[]): TranscriptSource {
  return {
    harness: sources.map((s) => s.harness).join('+'),
    async listSessions(filter: TranscriptFilter): Promise<TranscriptSession[]> {
      const results = await Promise.all(
        sources.map((s) => s.listSessions(filter).catch(() => [] as TranscriptSession[])),
      )
      return results.flat().sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? ''))
    },
  }
}

/**
 * Build a TranscriptSource from config, fanning out across the selected
 * harnesses. Returns `source: null` when transcripts are disabled or nothing
 * resolves. `unknown` lists any configured harness names we don't recognize
 * (so the caller can warn rather than silently ignore them).
 */
export function createTranscriptSource(config: TranscriptConfig | undefined): {
  source: TranscriptSource | null
  harnesses: string[]
  unknown: string[]
} {
  if (!config?.enabled) return { source: null, harnesses: [], unknown: [] }

  const names =
    config.harnesses && config.harnesses.length > 0 ? config.harnesses : [...KNOWN_HARNESSES]
  const unknown = names.filter((n) => !KNOWN_HARNESSES.includes(n as KnownHarness))
  const sources = names
    .map((n) => buildOne(n, config))
    .filter((s): s is TranscriptSource => s !== null)

  if (sources.length === 0) return { source: null, harnesses: [], unknown }
  return { source: composite(sources), harnesses: sources.map((s) => s.harness), unknown }
}
