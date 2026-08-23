import { describe, it, expect } from 'vitest'
import { withConcurrency } from '../concurrency.js'

describe('withConcurrency', () => {
  it('preserves input order in results even when tasks resolve out of order', async () => {
    const tasks = [30, 10, 20].map((ms, i) => () =>
      new Promise<number>((r) => setTimeout(() => r(i), ms)),
    )
    const results = await withConcurrency(tasks, 3)
    expect(results).toEqual([0, 1, 2])
  })

  it('never runs more than `limit` tasks at once', async () => {
    let running = 0
    let peak = 0
    const tasks = Array.from({ length: 10 }, () => async () => {
      running++
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 5))
      running--
      return running
    })
    await withConcurrency(tasks, 3)
    expect(peak).toBeLessThanOrEqual(3)
  })

  it('returns [] for no tasks', async () => {
    expect(await withConcurrency([], 4)).toEqual([])
  })

  it('treats a non-positive limit as 1 (no infinite loop)', async () => {
    const tasks = [1, 2, 3].map((n) => () => Promise.resolve(n))
    expect(await withConcurrency(tasks, 0)).toEqual([1, 2, 3])
  })
})
