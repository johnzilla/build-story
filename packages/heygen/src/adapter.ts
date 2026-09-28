import type { StoryArc, StoryBeat, BeatType } from '@buildstory/core'
import { StoryArcSchema, sanitizeStoryArc, splitNarration } from '@buildstory/core'
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

function chunkBeats<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function beatToScenes(
  beat: StoryBeat,
  opts: AdaptOptions,
): { scenes: HeyGenScene[]; warning: string | null } {
  if (!beat.summary.trim()) throw new Error(`Beat "${beat.title}" requires nonempty narration`)
  const texts = splitNarration(beat.summary, HEYGEN_CHAR_LIMIT)

  const scenes: HeyGenScene[] = texts.map((inputText) => ({
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
  }))

  const warning = texts.length > 1
    ? `Beat "${beat.title}" narration split into ${texts.length} scenes; all text retained`
    : null

  return { scenes, warning }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function adaptStoryArc(arc: StoryArc, opts: AdaptOptions): AdaptResult {
  // Validate at the boundary — throws ZodError on invalid input
  const validatedArc = sanitizeStoryArc(StoryArcSchema.parse(arc))
  const validatedOpts = AdaptOptionsSchema.parse(opts)

  const warnings: string[] = []
  if (validatedArc.beats.some(beat => beat.visual || beat.displayText)) {
    warnings.push('HeyGen uses spoken summaries only; evidence panels and separate display text require the Remotion renderer.')
  }
  const scenes: HeyGenScene[] = []

  for (const beat of validatedArc.beats) {
    const { scenes: beatScenes, warning } = beatToScenes(beat, validatedOpts)
    scenes.push(...beatScenes)
    if (warning !== null) {
      warnings.push(warning)
    }
  }

  const chunks = chunkBeats(scenes, HEYGEN_MAX_SCENES)

  return { chunks, warnings }
}
