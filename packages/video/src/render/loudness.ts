import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { copyFile } from 'node:fs/promises'
import { getFfmpegPath } from '../tts/ffmpeg.js'
const run = promisify(execFile)
const target = 'loudnorm=I=-16:TP=-1.5:LRA=11'

/** Two-pass normalization on a temporary render copy; source/cache audio stays untouched. */
export async function normalizeSceneAudio(input: string, output: string, duration: number): Promise<void> {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Invalid normalization duration')
  const options = { timeout: 120_000, killSignal: 'SIGKILL' as const, maxBuffer: 1024 * 1024 }
  const { stderr } = await run(getFfmpegPath(), ['-hide_banner', '-i', input, '-af', `${target}:print_format=json`, '-f', 'null', '-'], options)
  const json = stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0]
  if (!json) throw new Error('FFmpeg did not return loudness measurements')
  const measured = JSON.parse(json) as Record<string, string>
  // Silence has no finite integrated loudness. Do not amplify it or fabricate gain.
  if (measured['input_i'] === '-inf') { await copyFile(input, output); return }
  const fields = ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset'] as const
  if (fields.some(field => !Number.isFinite(Number(measured[field])))) throw new Error('Invalid FFmpeg loudness measurements')
  const filter = `${target}:measured_I=${measured['input_i']}:measured_TP=${measured['input_tp']}:measured_LRA=${measured['input_lra']}:measured_thresh=${measured['input_thresh']}:offset=${measured['target_offset']}:linear=true`
  await run(getFfmpegPath(), ['-y', '-i', input, '-af', filter, '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', '-t', String(duration), output], options)
}
