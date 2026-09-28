import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { beforeAll, expect, it, vi } from 'vitest'
import { parseSync } from 'subtitle'
import { reviewStoryArc, type StoryArc } from '@buildstory/core'
import { renderVideo } from '../render/index.js'
import { renderStoryboardStills } from '../render/storyboard.js'
import { findChrome } from '../preflight.js'
import { getFfmpegPath, getFfprobePath } from '../tts/ffmpeg.js'
import { createCaptionCues } from '../captions.js'
import type { AudioManifest } from '../tts/types.js'

// A regression must never turn this fixture into paid speech generation.
vi.mock('openai', () => ({ default: function () { throw new Error('Acceptance tests must not call OpenAI') } }))
const exec = promisify(execFile)
const ffmpeg = (args: string[]) => exec(getFfmpegPath(), ['-v', 'error', '-y', ...args], { timeout: 120_000, maxBuffer: 16 * 1024 * 1024, encoding: 'buffer' })
let directory: string, browser: string, arc: StoryArc, manifest: AudioManifest
const video = () => join(directory, 'acceptance.mp4')

beforeAll(async () => {
  const installed = await findChrome()
  if (!installed) throw new Error('Video acceptance requires installed Chrome/Chromium. Set CHROME_PATH; browser downloads are disabled.')
  browser = installed
  await exec(getFfmpegPath(), ['-version'])
  await exec(getFfprobePath(), ['-version'])
  const base = resolve(process.env['BUILDSTORY_ACCEPTANCE_DIR'] ?? tmpdir())
  await mkdir(base, { recursive: true })
  directory = await mkdtemp(join(base, 'buildstory-acceptance-'))
  process.stdout.write(`Acceptance artifacts: ${directory}\n`)
  const evidence = 'Local storage allowed development to continue offline.'
  arc = reviewStoryArc({ version: '1', beats: [
    { type: 'idea', title: 'Keep development moving', chapter: 'The problem', summary: 'The network disappeared. Work needed to continue.', displayText: 'Could the build work offline?', evidence: [], sourceEventIds: [], significance: 3 },
    { type: 'decision', title: 'Choose local storage', chapter: 'The decision', summary: 'Local storage worked. Sharing would come later.', displayText: 'Availability first; sharing later.', evidence: [evidence], sourceEventIds: ['decision'], significance: 3, visual: { kind: 'quote', panels: [{ label: 'evidence', text: evidence, sourceEventId: 'decision' }] } },
    { type: 'open_loop', title: 'A working path and an open question', chapter: 'What remains', summary: 'Offline saving passed. Synchronization stayed open.', displayText: 'Offline works. How should devices synchronize?', evidence: [], sourceEventIds: [], significance: 3 },
  ], metadata: { generatedAt: '2026-09-28', style: 'story', sourceTimeline: 'acceptance' } }, {
    version: '1', rootDir: 'acceptance', scannedAt: '', dateRange: { start: '', end: '' }, events: [{ id: 'decision', source: 'file', date: '2026-09-28', dateConfidence: 'exact', path: 'docs/decision.md', summary: evidence, rawContent: '', metadata: {} }],
  })
  manifest = { scenes: [], totalDurationSeconds: 6.8, silenceGapSeconds: .3, bookendSilenceSeconds: 1 }
  for (let i = 0; i < 3; i++) {
    const filePath = join(directory, `tone-${i}.wav`)
    await ffmpeg(['-f', 'lavfi', '-i', `sine=frequency=${440 + i * 220}:duration=1.2:sample_rate=24000`, '-c:a', 'pcm_s16le', filePath])
    manifest.scenes.push({ beatIndex: i, filePath, durationSeconds: 1.2, startOffsetSeconds: [1.2, 2.9, 4.6][i]! })
  }
  await writeFile(join(directory, 'fixture.json'), JSON.stringify({ storyArc: arc, audioManifest: manifest }, null, 2))
  await renderVideo(arc, manifest, { outputPath: video(), srtPath: join(directory, 'acceptance.srt'), browserExecutable: browser })
})

it('encodes a decodable 1080p H.264/AAC movie with all 204 frames and aligned stream durations', async () => {
  const { stdout } = await exec(getFfprobePath(), ['-v', 'error', '-count_frames', '-show_streams', '-of', 'json', video()], { timeout: 120_000 })
  const probe = JSON.parse(stdout)
  await writeFile(join(directory, 'probe.json'), stdout)
  const v = probe.streams.find((s: { codec_type: string }) => s.codec_type === 'video')
  const a = probe.streams.find((s: { codec_type: string }) => s.codec_type === 'audio')
  expect(v).toMatchObject({ codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1', nb_read_frames: '204' })
  expect(a.codec_name).toBe('aac')
  for (const stream of [v, a]) expect(Math.abs(Number(stream.duration) - 6.8)).toBeLessThanOrEqual(1 / 30)
  await ffmpeg(['-xerror', '-i', video(), '-f', 'null', '-'])
})

it('places synthetic audio inside the expected windows and preserves silence between scenes', async () => {
  const { stdout } = await ffmpeg(['-i', video(), '-vn', '-ac', '1', '-ar', '24000', '-f', 's16le', '-'])
  const rms = (start: number, end: number) => {
    let sum = 0, n = 0
    for (let i = Math.round(start * 24000); i < Math.round(end * 24000); i++) { sum += (stdout.readInt16LE(i * 2) / 32768) ** 2; n++ }
    return Math.sqrt(sum / n)
  }
  for (const start of [1.2, 2.9, 4.6]) expect(rms(start + .2, start + .9)).toBeGreaterThan(.01)
  for (const [start, end] of [[0, 1], [2.5, 2.8], [4.2, 4.5], [5.9, 6.7]]) expect(rms(start!, end!)).toBeLessThan(.003)
})

it('matches SRT cues to visible caption start/end frames and removes captions during padding', async () => {
  const cues = createCaptionCues(arc.beats, manifest)
  const srt = parseSync(await readFile(join(directory, 'acceptance.srt'), 'utf8')).filter(node => node.type === 'cue')
  expect(srt.map(node => node.data)).toEqual(cues.map(cue => ({ start: Math.round(cue.startFrame * 1000 / 30), end: Math.round(cue.endFrame * 1000 / 30), text: cue.text })))
  expect(cues.filter(cue => [36, 87, 138].includes(cue.startFrame))).toHaveLength(3)
  const crop = async (frame: number, region = '160:930:1600:120') => {
    const [x, y, w, h] = region.split(':')
    return (await ffmpeg(['-i', video(), '-vf', `select=eq(n\\,${frame}),crop=${w}:${h}:${x}:${y}`, '-frames:v', '1', '-pix_fmt', 'gray', '-f', 'rawvideo', '-'])).stdout
  }
  const changedInk = (a: Buffer, b: Buffer) => a.reduce((n, pixel, index) => n + Number((pixel > 160) !== (b[index]! > 160)), 0)
  const bright = (pixels: Buffer) => pixels.reduce((n, pixel) => n + Number(pixel > 200), 0)
  for (const frame of [0, 35, 72, 86, 123, 137, 174, 203]) expect(bright(await crop(frame))).toBe(0)
  for (const cue of cues) {
    expect(bright(await crop(cue.startFrame))).toBeGreaterThan(100)
    expect(bright(await crop(cue.endFrame - 1))).toBeGreaterThan(100)
  }
  for (let i = 1; i < cues.length; i++) if (cues[i]!.startFrame === cues[i - 1]!.endFrame) {
    expect(changedInk(await crop(cues[i]!.startFrame), await crop(cues[i]!.startFrame - 1))).toBeGreaterThan(100)
  }
  // The always-visible chapter/scene label must switch exactly at visual boundaries.
  for (const frame of [81, 132]) expect(changedInk(await crop(frame, '88:16:1000:32'), await crop(frame - 1, '88:16:1000:32'))).toBeGreaterThan(20)
  for (const frame of [45, 96, 147]) await ffmpeg(['-i', video(), '-vf', `select=eq(n\\,${frame})`, '-frames:v', '1', join(directory, `frame-${frame}.png`)])
})

it('rejects text that cannot fit at the readable font floor', async () => {
  const oversized = structuredClone(arc)
  oversized.beats[0]!.title = 'Unreasonably long title '.repeat(400)
  await expect(renderStoryboardStills(oversized, { outputDir: join(directory, 'overflow'), durations: [1.2, 1.2, 1.2], scenes: [0], browserExecutable: browser })).rejects.toThrow('Presentation overflow')
})
