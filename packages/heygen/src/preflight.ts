import type { HeyGenConfig, PreflightResult } from './types.js'

export async function preflightHeyGenCheck(opts: HeyGenConfig): Promise<PreflightResult> {
  const failures: string[] = []

  if (!opts.apiKey) {
    failures.push('HEYGEN_API_KEY not set. Required for --renderer=heygen.')
  }

  if (!opts.avatarId) {
    failures.push(
      'No avatar_id configured. See https://docs.heygen.com/reference/list-avatars-v2 for available avatars.',
    )
  }

  if (!opts.voiceId) {
    failures.push(
      'No voice_id configured. See https://docs.heygen.com/reference/list-voices-v2 for available voices.',
    )
  }

  return { ok: failures.length === 0, failures }
}
