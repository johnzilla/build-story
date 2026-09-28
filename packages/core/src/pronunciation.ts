import { z } from 'zod'
import type { StoryArc } from './types/story.js'
import { sanitizeOutboundText, sanitizeStoryArc } from './privacy/outbound.js'

export const PronunciationsSchema = z.record(z.string().trim().min(1).max(100), z.string().trim().min(1).max(200))
  .refine(rules => Object.keys(rules).length <= 50, 'At most 50 pronunciation rules')

/** Literal, case-sensitive whole terms; longest match wins, replacements never recurse. */
export function applyPronunciations(input: StoryArc, rules?: Record<string, string>): StoryArc {
  if (!rules || !Object.keys(rules).length) return input
  const arc = sanitizeStoryArc(input)
  const validated = PronunciationsSchema.parse(rules)
  const keys = Object.keys(validated).sort((a, b) => b.length - a.length)
  const escaped = keys.map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${escaped.join('|')})(?![\\p{L}\\p{N}_])`, 'gu')
  return { ...arc, beats: arc.beats.map(beat => ({ ...beat,
    speechText: sanitizeOutboundText(beat.summary.replace(pattern, term => validated[term]!)),
  })) }
}
