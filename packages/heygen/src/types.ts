import { z } from 'zod'

export const HeyGenOptionsSchema = z.object({
  apiKey: z.string().min(1),
  avatarId: z.string().min(1),
  voiceId: z.string().min(1),
  width: z.number().default(1280),
  height: z.number().default(720),
  speed: z.number().min(0.5).max(2.0).default(1.0),
  timeoutSeconds: z.number().default(600),
})

/** Full output type -- all fields required (after Zod defaults applied). Used for Phase 7 API submission. */
export type HeyGenOptions = z.infer<typeof HeyGenOptionsSchema>

/** Input type -- fields with Zod defaults are optional. Used by preflight and cost estimation. */
export type HeyGenConfig = z.input<typeof HeyGenOptionsSchema>

export interface HeyGenCostEstimate {
  sceneCount: number
  estimatedMinutes: number
  creditsRequired: number
  estimatedCostUSD: number
  avatarId: string
  voiceId: string
}

export interface PreflightResult {
  ok: boolean
  failures: string[]
}
