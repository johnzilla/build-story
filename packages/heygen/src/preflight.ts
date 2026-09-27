import { consumeWithTimeout } from './http.js'
import type { HeyGenConfig, PreflightResult } from './types.js'

// A cheap authenticated GET used only to validate the API key before the
// expensive video submission. remaining_quota returns a tiny payload and, more
// importantly, a 401/403 for a bad key.
const VALIDATE_URL = 'https://api.heygen.com/v1/user/remaining_quota'
const VALIDATE_TIMEOUT_MS = 15_000

/** Verify the key before paid work; unavailable verification fails closed. */
async function validateApiKey(apiKey: string): Promise<string | null> {
  try {
    return await consumeWithTimeout(VALIDATE_URL, {
      headers: { 'X-Api-Key': apiKey },
    }, VALIDATE_TIMEOUT_MS, async (res) => {
      if (res.status === 401 || res.status === 403) {
        return `HeyGen API key rejected (HTTP ${res.status}). Check HEYGEN_API_KEY.`
      }
      if (!res.ok) return `HeyGen preflight could not verify credentials (HTTP ${res.status}). Retry before paid work.`
      return null
    })
  } catch {
    return 'HeyGen preflight could not reach the service. Retry before paid work.'
  }
}

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

  // Only reach out to HeyGen once the required config is present — validating the
  // key cheaply here means a bad key fails before any paid submission.
  if (failures.length === 0) {
    const keyFailure = await validateApiKey(opts.apiKey)
    if (keyFailure) failures.push(keyFailure)
  }

  return { ok: failures.length === 0, failures }
}
