import type { StoryBeat } from '@buildstory/core'
import type { HeyGenConfig, HeyGenCostEstimate } from './types.js'

const CREDITS_PER_MINUTE = 1
const USD_PER_CREDIT = 0.99

export function estimateHeyGenCost(
  beats: StoryBeat[],
  opts: HeyGenConfig,
): HeyGenCostEstimate {
  const totalSeconds = beats.reduce((sum, b) => {
    if (b.duration_seconds !== undefined) return sum + b.duration_seconds
    const words = b.summary.split(/\s+/).length
    return sum + (words / 150) * 60
  }, 0)
  const estimatedMinutes = totalSeconds / 60
  const creditsRequired = Math.ceil(estimatedMinutes * CREDITS_PER_MINUTE)
  return {
    sceneCount: beats.length,
    estimatedMinutes,
    creditsRequired,
    estimatedCostUSD: creditsRequired * USD_PER_CREDIT,
    avatarId: opts.avatarId,
    voiceId: opts.voiceId,
  }
}
