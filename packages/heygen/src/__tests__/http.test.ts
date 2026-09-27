import { afterEach, expect, it, vi } from 'vitest'
import { consumeWithTimeout } from '../http.js'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('keeps the deadline active while reading a stalled JSON body after headers arrive', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(async (_url, init: RequestInit) => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"data":'))
      init.signal!.addEventListener('abort', () => controller.error(init.signal!.reason), { once: true })
    },
  }))))
  const caught = consumeWithTimeout('https://example.com', {}, 30_000, r => r.json()).catch(e => e)
  await vi.advanceTimersByTimeAsync(30_000)
  expect(await caught).toMatchObject({ name: 'TimeoutError' })
  expect(vi.getTimerCount()).toBe(0)
})

it('clears the deadline after a successful body read', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: true })))
  await expect(consumeWithTimeout('https://example.com', {}, 30_000, r => r.json())).resolves.toEqual({ ok: true })
  expect(vi.getTimerCount()).toBe(0)
})

it('cancels an unread error body and clears its timer', async () => {
  vi.useFakeTimers()
  const cancel = vi.fn()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ cancel }), { status: 503 })))
  await expect(consumeWithTimeout('https://example.com', {}, 30_000, async () => { throw new Error('HTTP 503') })).rejects.toThrow('503')
  expect(cancel).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})
