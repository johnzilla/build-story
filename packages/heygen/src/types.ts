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

export interface HeyGenScene {
  character: {
    type: 'avatar'
    avatar_id: string
    avatar_style?: 'normal' | 'circle' | 'closeUp'
  }
  voice: {
    type: 'text'
    input_text: string
    voice_id: string
    speed?: number
  }
  background: {
    type: 'color'
    value: string // hex e.g. "#1E3A5F"
  }
}

export const AdaptOptionsSchema = z.object({
  avatarId: z.string().min(1),
  voiceId: z.string().min(1),
  speed: z.number().min(0.5).max(2.0).optional(),
  avatarStyle: z.enum(['normal', 'circle', 'closeUp']).optional(),
})

export type AdaptOptions = z.infer<typeof AdaptOptionsSchema>

export interface AdaptResult {
  chunks: HeyGenScene[][] // one sub-array per API call (max 10 scenes each)
  warnings: string[] // non-fatal notices (e.g., truncation)
}
