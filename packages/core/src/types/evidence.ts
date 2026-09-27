import { z } from 'zod'

export const EvidenceTopicSchema = z.enum(['problem', 'alternative', 'decision', 'outcome'])
export const SourceExcerptSchema = z.object({
  text: z.string().min(1).max(800), // up to 400 Unicode code points
  topics: z.array(EvidenceTopicSchema).min(1).max(4),
  section: z.string().max(240).optional(),
  truncated: z.boolean(),
  locator: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('lines'), startLine: z.number().int().positive(), endLine: z.number().int().positive() }),
    z.object({ kind: z.literal('turn'), turnIndex: z.number().int().positive(), role: z.enum(['user', 'agent']), timestamp: z.string().optional() }),
  ]),
})
export type EvidenceTopic = z.infer<typeof EvidenceTopicSchema>
export type SourceExcerpt = z.infer<typeof SourceExcerptSchema>
