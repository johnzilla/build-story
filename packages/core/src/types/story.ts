import { z } from 'zod'

export const BeatTypeSchema = z.enum([
  'idea',
  'goal',
  'attempt',
  'obstacle',
  'pivot',
  'side_quest',
  'decision',
  'result',
  'open_loop',
])

export const StoryBeatSchema = z.object({
  type: BeatTypeSchema,
  title: z.string(),
  summary: z.string(),
  evidence: z.array(z.string()),
  sourceEventIds: z.array(z.string()),
  significance: z.union([z.literal(1), z.literal(2), z.literal(3)]),
})

export const StoryArcSchema = z.object({
  version: z.literal('1'),
  beats: z.array(StoryBeatSchema),
  metadata: z.object({
    generatedAt: z.string(),
    style: z.string(),
    sourceTimeline: z.string(),
  }),
})

export const FormatTypeSchema = z.enum(['outline', 'thread', 'blog', 'video-script'])

export type BeatType = z.infer<typeof BeatTypeSchema>
export type StoryBeat = z.infer<typeof StoryBeatSchema>
export type StoryArc = z.infer<typeof StoryArcSchema>
export type FormatType = z.infer<typeof FormatTypeSchema>
