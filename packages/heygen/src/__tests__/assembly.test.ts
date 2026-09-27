import { afterEach, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { spawn } from 'node:child_process'
import { unlink, writeFile } from 'node:fs/promises'
import { concatMp4s } from '../assembly.js'
vi.mock('node:child_process', () => ({ spawn: vi.fn() }))
vi.mock('node:fs/promises', () => ({ writeFile: vi.fn(), unlink: vi.fn(async () => {}) }))
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); vi.unstubAllEnvs() })

function child() {
  const proc = Object.assign(new EventEmitter(), { stderr: new EventEmitter(), kill: vi.fn() })
  vi.mocked(spawn).mockReturnValue(proc as unknown as ReturnType<typeof spawn>)
  return proc
}

it('kills stalled assembly, waits for close, and removes the concat list', async () => {
  vi.useFakeTimers()
  const proc = child()
  proc.kill.mockImplementation(() => { queueMicrotask(() => proc.emit('close', null)); return true })
  const result = concatMp4s(['/parts/chunk-0.mp4'], '/parts/assembled.mp4', '/parts').catch(e => e)
  await vi.advanceTimersByTimeAsync(300_000)
  expect(proc.kill).toHaveBeenCalledWith('SIGKILL')
  expect(await result).toMatchObject({ message: expect.stringContaining('timed out') })
  expect(unlink).toHaveBeenCalledWith('/parts/concat-list.txt')
  expect(vi.getTimerCount()).toBe(0)
})

it('drains diagnostics, bounds the error tail, and clears the deadline on failure', async () => {
  vi.useFakeTimers()
  const proc = child()
  const result = concatMp4s(['/parts/chunk-0.mp4'], '/parts/assembled.mp4', '/parts').catch(e => e)
  await vi.advanceTimersByTimeAsync(0)
  proc.stderr.emit('data', Buffer.from('x'.repeat(100_000) + 'final diagnostic'))
  proc.emit('close', 1)
  const error = await result
  expect(error.message).toContain('final diagnostic')
  expect(error.message.length).toBeLessThan(8300)
  expect(vi.getTimerCount()).toBe(0)
})

it('uses safe relative entries and honors FFMPEG_PATH with quoted output paths', async () => {
  vi.useFakeTimers()
  vi.stubEnv('FFMPEG_PATH', '/custom tools/ffmpeg')
  const proc = child()
  const dir = "/video output/John's story.parts"
  const result = concatMp4s([`${dir}/chunk-0.mp4`, `${dir}/chunk-1.mp4`], `${dir}/assembled.mp4`, dir)
  await vi.advanceTimersByTimeAsync(0)
  expect(writeFile).toHaveBeenCalledWith(`${dir}/concat-list.txt`, "file 'chunk-0.mp4'\nfile 'chunk-1.mp4'")
  expect(spawn).toHaveBeenCalledWith('/custom tools/ffmpeg', expect.arrayContaining(['-safe', '1', `${dir}/assembled.mp4`]), { stdio: ['ignore', 'ignore', 'pipe'] })
  proc.emit('close', 0)
  await result
  expect(vi.getTimerCount()).toBe(0)
})

it('cleans up on process startup failure', async () => {
  vi.useFakeTimers()
  const proc = child()
  const result = concatMp4s([], '/parts/assembled.mp4', '/parts').catch(e => e)
  await vi.advanceTimersByTimeAsync(0)
  proc.emit('error', new Error('ENOENT'))
  expect(await result).toMatchObject({ message: 'ENOENT' })
  expect(unlink).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})
