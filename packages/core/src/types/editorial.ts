import { z } from 'zod'

export const EditorialOptionsSchema = z.object({
  centralQuestion: z.string().trim().min(1).max(1000).optional(),
  pivotalEventIds: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  targetRuntimeSeconds: z.number().int().min(10).max(3600).optional(),
  compressRoutine: z.boolean().optional(),
  preserveOpenLoops: z.boolean().optional(),
}).strict()
export type EditorialOptions = z.infer<typeof EditorialOptionsSchema>
