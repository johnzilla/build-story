import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { normalizeSceneAudio } from '../loudness.js'
import { getFfmpegPath, getFfprobePath } from '../../tts/ffmpeg.js'
let available = true
try { execFileSync(getFfmpegPath(), ['-version'], { stdio: 'ignore' }); execFileSync(getFfprobePath(), ['-version'], { stdio: 'ignore' }) } catch { available = false }
it.skipIf(!available)('normalizes a quiet signal near target, preserves duration, and leaves the source untouched', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'buildstory-loudness-'))
  try {
    const source = join(dir, 'quiet.wav'), output = join(dir, 'normal.wav')
    execFileSync(getFfmpegPath(), ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3:sample_rate=24000', '-af', 'volume=0.1', '-c:a', 'pcm_s16le', source], { stdio: 'ignore' })
    const before = await readFile(source)
    await normalizeSceneAudio(source, output, 3)
    expect(await readFile(source)).toEqual(before)
    const duration = Number(execFileSync(getFfprobePath(), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', output], { encoding: 'utf8' }))
    expect(duration).toBeCloseTo(3, 2)
    const stats = spawnSync(getFfmpegPath(), ['-hide_banner', '-i', output, '-af', 'loudnorm=I=-16:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' })
    expect(stats.status).toBe(0)
    const measured = JSON.parse(stats.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)![0])
    expect(Math.abs(Number(measured.input_i) + 16)).toBeLessThan(0.6)
    expect((await readFile(output)).length).toBeGreaterThan(1000)
  } finally { await rm(dir, { recursive: true, force: true }) }
}, 20000)
it('rejects invalid duration before invoking FFmpeg', async () => {
  await expect(normalizeSceneAudio('unused', 'unused', NaN)).rejects.toThrow('Invalid normalization duration')
})
