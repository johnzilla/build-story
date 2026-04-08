import { writeFile, copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import type { StoryArc } from '@buildstory/core'
import type { AudioManifest } from '../tts/types.js'
import { generateSRT } from './srt.js'

export interface RenderProgress {
  renderedFrames: number
  totalFrames: number
  progress: number
}

export interface RenderOptions {
  outputPath: string
  srtPath: string
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
  const entryPoint = resolveCompositionEntry()

  // Step 1: Bundle the Remotion composition entry point
  const bundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => config,
  })

  // Remotion's <Audio> only accepts http/https URLs served by its dev server.
  // Copy audio files into the webpack bundle's public directory so they're served as static assets.
  const audioPublicDir = path.join(bundleLocation, 'audio')
  await mkdir(audioPublicDir, { recursive: true })

  const audioManifestForRemotion: typeof audioManifest = {
    ...audioManifest,
    scenes: await Promise.all(
      audioManifest.scenes.map(async (scene) => {
        const filename = path.basename(scene.filePath)
        await copyFile(scene.filePath, path.join(audioPublicDir, filename))
        return { ...scene, filePath: `/audio/${filename}` }
      }),
    ),
  }

  const inputProps = {
    storyArc,
    audioManifest: audioManifestForRemotion,
    fps: 30,
  }

  // Step 2: Resolve composition metadata (durationInFrames from calculateMetadata)
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'BuildStory',
    inputProps,
  })

  // Step 3: Render MP4 (H.264 + AAC per REND-05)
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: options.outputPath,
    inputProps,
    onProgress: (p) => {
      options.onProgress?.({
        renderedFrames: p.renderedFrames,
        totalFrames: composition.durationInFrames,
        progress: p.progress,
      })
    },
  })

  // Step 4: Generate SRT subtitles (REND-06)
  const srt = generateSRT(storyArc.beats, audioManifest.scenes)
  await writeFile(options.srtPath, srt, 'utf-8')
}
