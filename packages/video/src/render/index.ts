import { createHash } from 'node:crypto'
import { withConcurrency } from '../tts/concurrency.js'
import { normalizeSceneAudio } from './loudness.js'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getFfmpegPath } from '../tts/ffmpeg.js'
import { VIDEO_FPS } from '../timing.js'
import { writeFile, copyFile, mkdir, mkdtemp, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import type { StoryArc } from '@buildstory/core'
import { sanitizeStoryArc, StoryArcSchema } from '@buildstory/core'
import type { AudioManifest } from '../tts/types.js'
import { generateSRT } from './srt.js'
import { findChrome } from '../preflight.js'

const execFileAsync = promisify(execFile)

export interface RenderProgress {
  renderedFrames: number
  totalFrames: number
  progress: number
}

export interface RenderOptions {
  captions?: boolean
  normalizeLoudness?: boolean
  outputPath: string
  srtPath: string
  /** Render the first/last beats as title cards (default true). */
  showTitleCard?: boolean
  /** Render the second-to-last beat as a stats card (default true). */
  showStatsCard?: boolean
  /**
   * Path to the Chrome/Chromium binary Remotion should use. Pass the value
   * preflight discovered so rendering uses the same browser preflight verified,
   * instead of relying on Remotion's independent resolution.
   */
  browserExecutable?: string
  onProgress?: (progress: RenderProgress) => void
}

// Resolve the composition entry point relative to this file's package root.
// tsup bundles everything into a single dist/index.js, so import.meta.url
// points to packages/video/dist/index.js. Go up one level to package root.
// The Remotion bundler needs the TypeScript source entry (it runs its own webpack/esbuild pass).
function resolveCompositionEntry(): string {
  const thisFile = fileURLToPath(import.meta.url)
  const thisDir = path.dirname(thisFile)

  // From dist/index.js → go up 1 level to package root
  // From src/render/index.ts (dev) → go up 2 levels to package root
  const packageRoot = thisDir.includes('/dist')
    ? path.resolve(thisDir, '..')
    : path.resolve(thisDir, '../..')

  return path.resolve(packageRoot, 'src/render/composition/index.ts')
}

export async function renderVideo(
  storyArc: StoryArc,
  audioManifest: AudioManifest,
  options: RenderOptions,
): Promise<void> {
  storyArc = StoryArcSchema.parse(sanitizeStoryArc(storyArc))
  // Validate timing and captions before expensive bundling or rendering.
  const srt = generateSRT(storyArc.beats, audioManifest, VIDEO_FPS)
  // Always supply an installed browser to BOTH renderer calls. Omitting it
  // lets Remotion download and extract a browser archive implicitly.
  const browserExecutable = options.browserExecutable ?? await findChrome()
  if (!browserExecutable) {
    throw new Error('An installed Chrome/Chromium is required. Set CHROME_PATH or PUPPETEER_EXECUTABLE_PATH; automatic browser downloads are disabled.')
  }
  const entryPoint = resolveCompositionEntry()

  // Step 1: Bundle the Remotion composition entry point
  const bundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        // Source uses Node ESM .js specifiers; the bundle compiles TS directly.
        extensionAlias: { ...config.resolve?.extensionAlias, '.js': ['.ts', '.tsx', '.js'] },
      },
    }),
  })

  // Remotion's <Audio> only accepts http/https URLs served by its dev server.
  // Copy audio files into the webpack bundle's public directory so they're served as static assets.
  const audioPublicDir = path.join(bundleLocation, 'audio')
  await mkdir(audioPublicDir, { recursive: true })

  const copies = new Map<string, Promise<void>>()
  const audioManifestForRemotion: typeof audioManifest = {
    ...audioManifest,
    scenes: await withConcurrency(
      audioManifest.scenes.map((scene) => async () => {
        const filename = `${createHash('sha256').update(scene.filePath).digest('hex').slice(0, 24)}.wav`
        let task = copies.get(filename)
        if (!task) {
          task = options.normalizeLoudness === false ? copyFile(scene.filePath, path.join(audioPublicDir, filename))
            : normalizeSceneAudio(scene.filePath, path.join(audioPublicDir, filename), scene.durationSeconds)
          copies.set(filename, task)
        }
        await task
        return { ...scene, filePath: `/audio/${filename}` }
      }), 2,
    ),
  }

  const inputProps = {
    storyArc,
    audioManifest: audioManifestForRemotion,
    fps: VIDEO_FPS,
    captions: options.captions ?? true,
    showTitleCard: options.showTitleCard ?? true,
    showStatsCard: options.showStatsCard ?? true,
  }

  // Step 2: Resolve composition metadata (durationInFrames from calculateMetadata)
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'BuildStory',
    inputProps,
    browserExecutable,
  })

  // Preserve PCM through mixing. Remotion's raw AAC intermediate loses
  // encoder-delay metadata, so encode AAC once while assembling the final MP4.
  await mkdir(path.dirname(options.outputPath), { recursive: true })
  const workDir = await mkdtemp(path.join(path.dirname(options.outputPath), '.buildstory-render-'))
  try {
    const videoPath = path.join(workDir, 'video.mp4')
    const audioPath = path.join(workDir, 'audio.wav')
    const finalPath = path.join(workDir, 'final.mp4')
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      audioCodec: 'pcm-16',
      separateAudioTo: audioPath,
      enforceAudioTrack: true,
      outputLocation: videoPath,
      inputProps,
      browserExecutable,
      onProgress: (p) => {
        options.onProgress?.({
          renderedFrames: p.renderedFrames,
          totalFrames: composition.durationInFrames,
          progress: p.progress,
        })
      },
    })
    await execFileAsync(getFfmpegPath(), [
      '-y', '-i', videoPath, '-i', audioPath,
      '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart',
      '-t', String(composition.durationInFrames / VIDEO_FPS), finalPath,
    ], { timeout: 300_000, killSignal: 'SIGKILL' })
    await rename(finalPath, options.outputPath)
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }

  // Step 4: Generate SRT subtitles (REND-06)
  await writeFile(options.srtPath, srt, 'utf-8')
}
