import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export function getFfprobePath(): string {
  return process.env['FFPROBE_PATH'] ?? 'ffprobe'
}

export async function measureAudioDuration(filePath: string): Promise<number> {
  const ffprobePath = getFfprobePath()
  const { stdout } = await execFileAsync(ffprobePath, [
    '-v', 'quiet',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    filePath,
  ])
  const duration = parseFloat(stdout.trim())
  if (isNaN(duration)) throw new Error(`ffprobe returned non-numeric duration for ${filePath}`)
  return duration
}
