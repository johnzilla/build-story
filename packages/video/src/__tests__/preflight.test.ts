import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync, readdirSync } from 'node:fs'

// Mock fs / os / child_process so findChrome's search order is exercised without
// touching the real machine.
vi.mock('node:fs', () => ({ existsSync: vi.fn(), readdirSync: vi.fn() }))
vi.mock('node:os', () => ({ homedir: vi.fn(() => '/home/u'), platform: vi.fn(() => 'linux') }))
vi.mock('node:child_process', () => ({
  // promisify(execFile) → rejects (as if `which` found nothing) unless a test
  // overrides existsSync earlier in the search order.
  execFile: vi.fn((_file: string, _args: string[], cb: (e: Error) => void) => cb(new Error('not found'))),
}))

const { findChrome } = await import('../preflight.js')

const mockExists = vi.mocked(existsSync)
const mockReaddir = vi.mocked(readdirSync)

describe('findChrome (preflight path logic)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env['PUPPETEER_EXECUTABLE_PATH']
    delete process.env['CHROME_PATH']
    mockExists.mockReturnValue(false)
    mockReaddir.mockReturnValue([] as unknown as ReturnType<typeof readdirSync>)
  })

  it('returns the env-var override when it points at an existing binary', async () => {
    process.env['CHROME_PATH'] = '/opt/chrome'
    mockExists.mockImplementation((p) => p === '/opt/chrome')
    expect(await findChrome()).toBe('/opt/chrome')
  })

  it('ignores an env-var override that does not exist on disk', async () => {
    process.env['PUPPETEER_EXECUTABLE_PATH'] = '/nope/chrome'
    mockExists.mockReturnValue(false)
    // Falls through to the other search steps, which also find nothing → null.
    expect(await findChrome()).toBeNull()
  })

  it('discovers a binary in the puppeteer cache (linux layout)', async () => {
    const cacheRoot = '/home/u/.cache/puppeteer/chrome'
    const binary = '/home/u/.cache/puppeteer/chrome/119.0/chrome-linux64/chrome'
    mockExists.mockImplementation((p) => p === cacheRoot || p === binary)
    mockReaddir.mockImplementation((dir) => {
      if (dir === cacheRoot) return ['119.0'] as unknown as ReturnType<typeof readdirSync>
      if (dir === '/home/u/.cache/puppeteer/chrome/119.0')
        return ['chrome-linux64'] as unknown as ReturnType<typeof readdirSync>
      return [] as unknown as ReturnType<typeof readdirSync>
    })
    expect(await findChrome()).toBe(binary)
  })

  it('returns null when nothing is found anywhere', async () => {
    mockExists.mockReturnValue(false)
    expect(await findChrome()).toBeNull()
  })
})
