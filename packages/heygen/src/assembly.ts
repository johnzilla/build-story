import { writeFile, unlink } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { spawn } from 'node:child_process'

export async function concatMp4s(
  chunkPaths: string[],
  outputPath: string,
  workDir: string,
  ffmpegBin = process.env['FFMPEG_PATH'] ?? 'ffmpeg',
): Promise<void> {
  // Chunk names are generated internally; relative names avoid user-path quoting.
  const listContent = chunkPaths.map((p) => `file '${basename(p)}'`).join('\n')
  const listPath = join(workDir, 'concat-list.txt')
  await writeFile(listPath, listContent)

  const args = ['-nostdin', '-f', 'concat', '-safe', '1', '-i', listPath, '-c', 'copy', '-y', outputPath]

  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpegBin, args, { stdio: ['ignore', 'ignore', 'pipe'] })
      let stderr = ''
      let timedOut = false
      // Drain diagnostics continuously but retain only a bounded tail.
      proc.stderr?.on('data', (data: Buffer) => { stderr = (stderr + data.toString()).slice(-8192) })
      const timer = setTimeout(() => {
        timedOut = true
        proc.kill('SIGKILL')
      }, 300_000)
      proc.on('close', (code) => {
        clearTimeout(timer)
        if (timedOut) reject(new Error('FFmpeg concat timed out after 300s; completed chunks retained for retry.'))
        else if (code === 0) resolve()
        else reject(new Error(`FFmpeg concat exited with code ${code}: ${stderr}`))
      })
      proc.on('error', (error) => { clearTimeout(timer); reject(error) })
    })
  } finally {
    await unlink(listPath).catch(() => {})
  }
}
