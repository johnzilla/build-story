import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface PreflightResult {
  ok: boolean
  failures: string[]
}

export async function preflightCheck(opts: {
  openaiApiKey?: string
  skipRemotionCheck?: boolean
}): Promise<PreflightResult> {
  const failures: string[] = []

  // 1. Check Remotion is installed (unless skipped for dry-run)
  if (!opts.skipRemotionCheck) {
    try {
      await import('remotion')
    } catch {
      failures.push(
        '@buildstory/video dependencies not installed. Run: pnpm --filter @buildstory/video install'
      )
    }
  }

  // 2. Check ffprobe is available
  const ffprobePath = process.env['FFPROBE_PATH'] ?? 'ffprobe'
  try {
    await execFileAsync(ffprobePath, ['-version'])
  } catch {
    failures.push(
      `ffprobe not found at "${ffprobePath}". Install FFmpeg or set FFPROBE_PATH env var. https://ffmpeg.org/download.html`
    )
  }

  // 3. Check headless Chrome is available (D-11)
  const chromeCandidates = [
    process.env['PUPPETEER_EXECUTABLE_PATH'],
    process.env['CHROME_PATH'],
  ].filter(Boolean) as string[]

  // Also check common system paths
  const systemPaths = [
    'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
  ]

  let chromeFound = false
  for (const candidate of [...chromeCandidates, ...systemPaths]) {
    try {
      await execFileAsync('which', [candidate])
      chromeFound = true
      break
    } catch {
      // not found, try next
    }
  }

  if (!chromeFound) {
    failures.push(
      'Headless Chrome not found. Install: npx puppeteer browsers install chrome'
    )
  }

  // 4. Check OPENAI_API_KEY for TTS (D-12)
  if (!opts.openaiApiKey) {
    failures.push(
      'OPENAI_API_KEY not set. Required for TTS audio generation.'
    )
  }

  return { ok: failures.length === 0, failures }
}
