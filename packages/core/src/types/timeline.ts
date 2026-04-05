import { z } from 'zod'

export const TimelineEventSchema = z.object({
  id: z.string(),
  date: z.string(),
  source: z.enum(['file', 'git-commit', 'git-tag']),
  path: z.string().optional(),
  summary: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  dateConfidence: z.enum(['exact', 'inferred', 'estimated', 'unknown']),
})

export const TimelineSchema = z.object({
  version: z.literal('1'),
  rootDir: z.string(),
  scannedAt: z.string(),
  dateRange: z.object({ start: z.string(), end: z.string() }),
  events: z.array(TimelineEventSchema),
})

export type Timeline = z.infer<typeof TimelineSchema>
export type TimelineEvent = z.infer<typeof TimelineEventSchema>
