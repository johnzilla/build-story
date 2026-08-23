import type { HeyGenConfig, PreflightResult } from './types.js'

// A cheap authenticated GET used only to validate the API key before the
// expensive video submission. remaining_quota returns a tiny payload and, more
// importantly, a 401/403 for a bad key.
const VALIDATE_URL = 'https://api.heygen.com/v1/user/remaining_quota'
const VALIDATE_TIMEOUT_MS = 15_000

/**
 * Validate the API key against a cheap endpoint. Returns a failure message only
 * on a clear auth rejection (401/403); transient failures (network, timeout,
 * 5xx) are swallowed so an offline machine or a HeyGen outage doesn't block a
 * render the key may well be fine for.
 */
async function validateApiKey(apiKey: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(new DOMException(`Request timed out after ${VALIDATE_TIMEOUT_MS}ms`, 'TimeoutError')),
    VALIDATE_TIMEOUT_MS,
  )
  try {
    const res = await fetch(VALIDATE_URL, {
      headers: { 'X-Api-Key': apiKey },
      signal: controller.signal,
    })
    if (res.status === 401 || res.status === 403) {
      return `HeyGen API key rejected (HTTP ${res.status}). Check HEYGEN_API_KEY.`
    }
    return null
  } catch {
    // Transient — don't block preflight on it.
    return null
  } finally {
    clearTimeout(timer)
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
  if (opts.apiKey) {
    const keyFailure = await validateApiKey(opts.apiKey)
    if (keyFailure) failures.push(keyFailure)
  }

  return { ok: failures.length === 0, failures }
}
