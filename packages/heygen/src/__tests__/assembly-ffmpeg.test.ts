import { expect, it } from 'vitest'
import { execFile, spawnSync } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { concatMp4s } from '../assembly.js'

const ffmpeg = process.env['FFMPEG_PATH'] ?? 'ffmpeg'
const ffprobe = process.env['FFPROBE_PATH'] ?? 'ffprobe'
const available = [ffmpeg, ffprobe].every(bin => spawnSync(bin, ['-version'], { timeout: 5000 }).status === 0)
const exec = promisify(execFile)

it.skipIf(!available)('assembles real MP4 chunks under a path with spaces and an apostrophe', async () => {
  const dir = await mkdtemp(join(tmpdir(), "buildstory John's video "))
  try {
    const chunks = [join(dir, 'chunk-0.mp4'), join(dir, 'chunk-1.mp4')]
    for (const file of chunks) {
      await exec(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=32x32:r=10', '-t', '0.2', '-c:v', 'mpeg4', file], { timeout: 10000 })
    }
    const output = join(dir, "John's assembled video.mp4")
    await concatMp4s(chunks, output, dir, ffmpeg)
    const { stdout } = await exec(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', output], { timeout: 10000 })
    expect(Number(stdout.trim())).toBeCloseTo(0.4, 2)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}, 30000)
