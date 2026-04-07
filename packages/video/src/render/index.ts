import { writeFile } from 'node:fs/promises'
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
// tsup bundles src/index.ts → dist/index.js but keeps src/ alongside dist/
// The Remotion bundler needs the TypeScript source entry (it runs its own webpack/esbuild pass).
function resolveCompositionEntry(): string {
  const thisFile = fileURLToPath(import.meta.url)
  const thisDir = path.dirname(thisFile)

  // When running from dist/render/index.js, go up to package root then into src/
  // When running from src/render/index.ts (ts-node / vitest), path is already in src/
  const packageRoot = thisDir.includes('/dist/')
    ? path.resolve(thisDir, '../../')
    : path.resolve(thisDir, '../../')

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

  const inputProps = {
    storyArc,
    audioManifest,
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
