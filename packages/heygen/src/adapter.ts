import type { StoryArc, StoryBeat, BeatType } from '@buildstory/core'
import { StoryArcSchema } from '@buildstory/core'
import type { AdaptOptions, AdaptResult, HeyGenScene } from './types.js'
import { AdaptOptionsSchema } from './types.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HEYGEN_CHAR_LIMIT = 1500
const HEYGEN_MAX_SCENES = 10

const BEAT_COLOR_MAP: Record<BeatType, string> = {
  idea:       '#1E3A5F',
  goal:       '#2D5F8A',
  attempt:    '#4A90D9',
  obstacle:   '#D35400',
  pivot:      '#E74C3C',
  side_quest: '#8E44AD',
  decision:   '#F39C12',
  result:     '#27AE60',
  open_loop:  '#7F8C8D',
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function truncateSummary(text: string): { text: string; truncated: boolean } {
  if (text.length <= HEYGEN_CHAR_LIMIT) {
    return { text, truncated: false }
  }

  const slice = text.slice(0, HEYGEN_CHAR_LIMIT)

  // Search backward for the last sentence boundary (. ! ?) followed by space or end
  const boundaryRegex = /[.!?](?:\s|$)/g
  let lastBoundaryPos = -1
  let match: RegExpExecArray | null

  while ((match = boundaryRegex.exec(slice)) !== null) {
    lastBoundaryPos = match.index
  }

  if (lastBoundaryPos >= 0) {
    // Include the punctuation character (lastBoundaryPos + 1), trim trailing whitespace
    const truncated = slice.slice(0, lastBoundaryPos + 1).trimEnd()
    return { text: truncated, truncated: true }
  }

  // No sentence boundary found — hard-cut at limit
  return { text: slice, truncated: true }
}

function chunkBeats<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function beatToScene(
  beat: StoryBeat,
  opts: AdaptOptions,
): { scene: HeyGenScene; warning: string | null } {
  const { text: inputText, truncated } = truncateSummary(beat.summary)

  const scene: HeyGenScene = {
    character: {
      type: 'avatar',
      avatar_id: opts.avatarId,
      ...(opts.avatarStyle !== undefined && { avatar_style: opts.avatarStyle }),
    },
    voice: {
      type: 'text',
      input_text: inputText,
      voice_id: opts.voiceId,
      ...(opts.speed !== undefined && { speed: opts.speed }),
    },
    background: {
      type: 'color',
      value: BEAT_COLOR_MAP[beat.type],
    },
  }

  const warning = truncated
    ? `Beat "${beat.title}" summary truncated from ${beat.summary.length} to ${inputText.length} characters at sentence boundary`
    : null

  return { scene, warning }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function adaptStoryArc(arc: StoryArc, opts: AdaptOptions): AdaptResult {
  // Validate at the boundary — throws ZodError on invalid input
  const validatedArc = StoryArcSchema.parse(arc)
  const validatedOpts = AdaptOptionsSchema.parse(opts)

  const warnings: string[] = []
  const scenes: HeyGenScene[] = []

  for (const beat of validatedArc.beats) {
    const { scene, warning } = beatToScene(beat, validatedOpts)
    scenes.push(scene)
    if (warning !== null) {
      warnings.push(warning)
    }
  }

  const chunks = chunkBeats(scenes, HEYGEN_MAX_SCENES)

  return { chunks, warnings }
}
