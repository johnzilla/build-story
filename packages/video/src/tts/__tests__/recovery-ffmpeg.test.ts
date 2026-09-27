import { expect, it, vi } from 'vitest'
import { execFile, spawnSync } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type OpenAI from 'openai'
import { generateSceneAudio, prepareSpeechChunks } from '../generate.js'
import { inspectWav } from '../cache.js'
import { getFfmpegPath, getFfprobePath } from '../ffmpeg.js'

const ffmpeg = getFfmpegPath()
const ffprobe = getFfprobePath()
const available = [ffmpeg, ffprobe].every(bin => spawnSync(bin, ['-version'], { timeout: 5000 }).status === 0)
const exec = promisify(execFile)
it.skipIf(!available)('resumes real decoded chunks and joins valid audio in a path with spaces and an apostrophe', async () => {
  const dir = await mkdtemp(join(tmpdir(), "buildstory John's audio "))
  try {
    const mp3 = join(dir, 'synthetic.mp3')
    await exec(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.2', '-ar', '24000', '-ac', '1', mp3], { timeout: 10000 })
    const bytes = await readFile(mp3)
    const create = vi.fn().mockImplementation(async () => new Response(bytes))
    create.mockImplementationOnce(async () => new Response(bytes)).mockRejectedValueOnce(new Error('Interrupted second request'))
    const client = { audio: { speech: { create } } } as unknown as OpenAI
    const text = Array.from({ length: 200 }, (_, i) => `Decision ${i}: we compared the alternatives. `).join('')
    const output = join(dir, 'scene.wav')
    const opts = { voice: 'nova', speed: 1 }
    await expect(generateSceneAudio(client, text, output, opts)).rejects.toThrow('Interrupted second request')
    create.mockClear()
    await generateSceneAudio(client, text, output, opts)
    const count = prepareSpeechChunks(text).length
    expect(create).toHaveBeenCalledTimes(count - 1)
    const audio = inspectWav(await readFile(output))
    expect(audio!.durationSeconds).toBeCloseTo(count * 0.2, 3)
    const { stdout } = await exec(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', output], { timeout: 10000 })
    expect(Number(stdout.trim())).toBeCloseTo(audio!.durationSeconds, 4)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}, 30000)
