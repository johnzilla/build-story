import { z } from 'zod'

/** Literal source text only; no HTML, URLs to fetch, or executable diagrams. */
export const EvidenceVisualSchema = z.object({
  kind: z.enum(['quote', 'diff', 'error', 'architecture', 'comparison', 'outcome']),
  panels: z.array(z.object({
    label: z.enum(['evidence', 'before', 'after', 'alternative', 'chosen', 'observed', 'expected']),
    text: z.string().trim().min(12).max(360).regex(/^(?:[^\n]*\n){0,7}[^\n]*$/, 'At most 8 lines per evidence panel'),
    sourceEventId: z.string().min(1).max(200),
  }).strict()).min(1).max(2),
}).strict()
export type EvidenceVisual = z.infer<typeof EvidenceVisualSchema>
