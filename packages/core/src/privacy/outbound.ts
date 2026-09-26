import type { Timeline } from '../types/timeline.js'
import type { StoryArc } from '../types/story.js'
import { isSecretField, redactSecrets } from './redact.js'

/** A project label, never the directory of the person running the CLI. */
export function projectLabel(root: string): string {
  const label = root.replace(/\\/g, '/').replace(/\/+$/, '').split('/').pop()
  return redactSecrets(label && label !== '.' && label !== '..' ? label : 'project')
}

/** Best-effort text scrubbing; relative repo paths and web links remain useful. */
export function sanitizeOutboundText(text: string): string {
  return redactSecrets(text).replace(
    /https?:\/\/[^\s"'<>`]+|file:\/\/[^\s"'<>`]+|(^|[\s"'`(=:])(?:[A-Za-z]:[\\/]|\\\\|~\/|\/)[^\s"'<>`)]+/gm,
    (match, prefix: string | undefined) => {
      if (/^https?:\/\//.test(match)) return match
      return `${prefix ?? ''}[LOCAL_PATH]`
    },
  )
}

/** Sanitize values before JSON serialization, so quotes/escapes cannot bypass it. */
export function sanitizeOutboundValue<T>(value: T): T {
  function visit(input: unknown): unknown {
    if (typeof input === 'string') return sanitizeOutboundText(input)
    if (Array.isArray(input)) return input.map(visit)
    if (input instanceof Date) return input.toISOString()
    if (input && typeof input === 'object') {
      return Object.fromEntries(Object.entries(input).flatMap(([key, child]) => {
        // These identify the local machine, not the development decision.
        if (/^(cwd|rootdir|homedir)$/i.test(key)) return []
        return [[sanitizeOutboundText(key), isSecretField(key) ? '[REDACTED]' : visit(child)]]
      }))
    }
    return input
  }
  return visit(value) as T
}

export function sanitizeTimeline(timeline: Timeline): Timeline {
  // Drop rawContent before traversing: it never belongs in provider inputs.
  const events = timeline.events.map(({ rawContent: _rawContent, ...event }) => ({
    ...event,
    rawContent: '',
  }))
  const sanitized = sanitizeOutboundValue({ ...timeline, events })
  return { ...sanitized, rootDir: projectLabel(timeline.rootDir) }
}

export function sanitizeStoryArc(arc: StoryArc): StoryArc {
  return {
    ...sanitizeOutboundValue(arc),
    metadata: {
      ...sanitizeOutboundValue(arc.metadata),
      sourceTimeline: projectLabel(arc.metadata.sourceTimeline),
    },
  }
}
