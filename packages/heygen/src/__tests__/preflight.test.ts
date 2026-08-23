import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { preflightHeyGenCheck } from '../preflight.js'
import type { HeyGenConfig } from '../types.js'

const config: HeyGenConfig = { apiKey: 'test-key', avatarId: 'av', voiceId: 'vo' }

describe('preflightHeyGenCheck', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('flags missing config and does NOT call the API when the key is absent', async () => {
    const result = await preflightHeyGenCheck({ apiKey: '', avatarId: '', voiceId: '' })
    expect(result.ok).toBe(false)
    expect(result.failures.some((f) => f.includes('HEYGEN_API_KEY'))).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('passes when config is present and the key validates (HTTP 200)', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{"data":{}}', { status: 200 }))
    const result = await preflightHeyGenCheck(config)
    expect(result.ok).toBe(true)
    expect(result.failures).toEqual([])
    // Validated against the cheap endpoint with the key header.
    expect(fetch).toHaveBeenCalledOnce()
    const [, init] = vi.mocked(fetch).mock.calls[0]!
    expect((init?.headers as Record<string, string>)['X-Api-Key']).toBe('test-key')
  })

  it('fails clearly when the key is rejected (HTTP 401) — before any paid submit', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('unauthorized', { status: 401 }))
    const result = await preflightHeyGenCheck(config)
    expect(result.ok).toBe(false)
    expect(result.failures.some((f) => f.includes('rejected') && f.includes('401'))).toBe(true)
  })

  it('does not block on a transient network error (key may be fine)', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNRESET'))
    const result = await preflightHeyGenCheck(config)
    expect(result.ok).toBe(true)
    expect(result.failures).toEqual([])
  })
})
