import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, readdirSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import { getFfmpegPath, getFfprobePath } from './tts/ffmpeg.js'

const execFileAsync = promisify(execFile)

export interface PreflightResult {
  ok: boolean
  failures: string[]
  /** Path to the Chrome/Chromium binary that was discovered, if any. */
  chromePath?: string
}

/**
 * Locate a headless-Chrome-compatible browser binary.
 *
 * Search order:
 *   1. PUPPETEER_EXECUTABLE_PATH env var (caller knows best)
 *   2. CHROME_PATH env var
 *   3. Puppeteer cache (~/.cache/puppeteer/chrome/<version>/<platform>/...) —
 *      this is where `npx puppeteer browsers install chrome` puts it
 *   4. Platform-specific OS install paths (macOS .app bundles)
 *   5. PATH lookup for google-chrome / chromium binaries
 *
 * Returns the binary path if found, otherwise null.
 */
async function findChrome(): Promise<string | null> {
  // 1 + 2. Explicit env-var overrides
  for (const envVar of ['PUPPETEER_EXECUTABLE_PATH', 'CHROME_PATH'] as const) {
    const p = process.env[envVar]
    if (p && existsSync(p)) return p
  }

  // 3. Puppeteer cache — `npx puppeteer browsers install chrome` lands here.
  // Layout: ~/.cache/puppeteer/chrome/<version>/<platform-dir>/<binary>
  //   macOS:   chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing
  //   macOS:   chrome-mac-x64/...
  //   Linux:   chrome-linux64/chrome
  //   Windows: chrome-win64/chrome.exe
  const puppeteerCacheRoot = join(homedir(), '.cache', 'puppeteer', 'chrome')
  if (existsSync(puppeteerCacheRoot)) {
    let versions: string[] = []
    try {
      versions = readdirSync(puppeteerCacheRoot)
    } catch {
      // unreadable cache — fall through
    }
    for (const version of versions) {
      const versionDir = join(puppeteerCacheRoot, version)
      let platformDirs: string[] = []
      try {
        platformDirs = readdirSync(versionDir)
      } catch {
        continue
      }
      for (const pd of platformDirs) {
        const candidates = [
          // macOS app-bundle binary
          join(versionDir, pd, 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
          // Linux binary
          join(versionDir, pd, 'chrome'),
          // Windows binary
          join(versionDir, pd, 'chrome.exe'),
        ]
        for (const c of candidates) {
          if (existsSync(c)) return c
        }
      }
    }
  }

  // 4. macOS system-installed Chrome / Chromium
  if (platform() === 'darwin') {
    const macPaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
      '/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ]
    for (const p of macPaths) {
      if (existsSync(p)) return p
    }
  }

  // 5. PATH lookup for Linux/Windows distro installs
  const pathNames = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']
  for (const name of pathNames) {
    try {
      const { stdout } = await execFileAsync('which', [name])
      const trimmed = stdout.trim()
      if (trimmed) return trimmed
    } catch {
      // not found, try next
    }
  }

  return null
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

  // 2. Check ffmpeg AND ffprobe are available. Both are used by the TTS stage
  //    (ffmpeg: mp3→wav conversion; ffprobe: audio-duration measurement), so a
  //    missing ffmpeg would only surface mid-render — check it up front.
  const ffmpegPath = getFfmpegPath()
  try {
    await execFileAsync(ffmpegPath, ['-version'])
  } catch {
    failures.push(
      `ffmpeg not found at "${ffmpegPath}". Install FFmpeg or set FFMPEG_PATH env var. https://ffmpeg.org/download.html`
    )
  }

  const ffprobePath = getFfprobePath()
  try {
    await execFileAsync(ffprobePath, ['-version'])
  } catch {
    failures.push(
      `ffprobe not found at "${ffprobePath}". Install FFmpeg or set FFPROBE_PATH env var. https://ffmpeg.org/download.html`
    )
  }

  // 3. Check headless Chrome is available
  const chromePath = await findChrome()
  if (!chromePath) {
    failures.push(
      'Headless Chrome not found. Install via `npx puppeteer browsers install chrome`, ' +
        'or set PUPPETEER_EXECUTABLE_PATH / CHROME_PATH to an existing Chrome/Chromium binary. ' +
        'Searched: $PUPPETEER_EXECUTABLE_PATH, $CHROME_PATH, ~/.cache/puppeteer/chrome/*, ' +
        '/Applications/Google Chrome.app (macOS), PATH for google-chrome|chromium.'
    )
  }

  // 4. Check OPENAI_API_KEY for TTS
  if (!opts.openaiApiKey) {
    failures.push(
      'OPENAI_API_KEY not set. Required for TTS audio generation.'
    )
  }

  // Only include chromePath when found — exactOptionalPropertyTypes forbids an
  // explicit `undefined` for the optional `chromePath?: string` field.
  return chromePath
    ? { ok: failures.length === 0, failures, chromePath }
    : { ok: failures.length === 0, failures }
}
