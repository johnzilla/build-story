import { readFile, mkdir } from 'node:fs/promises'
import { resolve, dirname, basename } from 'node:path'
import chalk from 'chalk'
import ora from 'ora'
import type { StoryArc } from '@buildstory/core'
import { StoryArcSchema } from '@buildstory/core'
import { loadConfig } from '../config.js'
import { ensureVideoPackage } from '../lazy.js'

export async function renderCommand(
  storyArcPath: string,
  opts: {
    config?: string
    output: string
    dryRun?: boolean
    noTitleCard?: boolean
    noStatsCard?: boolean
  },
): Promise<void> {
  const projectRoot = opts.config ? dirname(resolve(opts.config)) : process.cwd()
  const config = loadConfig(projectRoot)

  // Load and validate story arc (T-04-09: parse through Zod schema)
  const raw = await readFile(resolve(storyArcPath), 'utf-8')
  const storyArc: StoryArc = StoryArcSchema.parse(JSON.parse(raw))

  const projectName = storyArc.metadata.sourceTimeline
    ? basename(storyArc.metadata.sourceTimeline)
    : 'project'

  console.log(chalk.bold('\n  BuildStory Render\n'))
  console.log(chalk.dim(`  Story: ${storyArc.beats.length} beats | Source: ${projectName}\n`))

  // Lazy install check (REND-10, D-10)
  await ensureVideoPackage()

  // Dynamic import after install confirmed
  const video = await import('@buildstory/video')

  // Preflight (REND-11, D-12)
  const openaiKey = process.env['OPENAI_API_KEY'] ?? ''
  const preflight = await video.preflightCheck({ openaiApiKey: openaiKey })
  if (!preflight.ok) {
    console.error(chalk.red('\n  Preflight check failed:\n'))
    preflight.failures.forEach((f: string) => console.error(chalk.red(`    - ${f}`)))
    console.error()
    process.exit(1)
  }

  // TTS cost estimate (REND-03, D-16)
  const costEstimate = video.estimateTTSCost(storyArc.beats)
  console.log(
    chalk.dim(
      `  Generating audio for ${costEstimate.sceneCount} scenes (~$${costEstimate.estimatedCostUSD.toFixed(2)} estimated)\n`,
    ),
  )

  if (opts.dryRun) {
    console.log(chalk.yellow('  --dry-run: Skipping TTS and render. Cost estimate above.\n'))
    return
  }

  const outputDir = resolve(opts.output, projectName)
  await mkdir(outputDir, { recursive: true })

  // TTS (REND-02)
  const ttsVoice = config.tts?.voice ?? 'nova'
  const ttsSpeed = config.tts?.speed ?? 1.15
  const ttsConcurrency = config.tts?.concurrency ?? 2

  const ttsSpinner = ora(`[1/2] Generating TTS audio...`).start()
  const audioManifest = await video.orchestrateTTS(
    storyArc.beats,
    outputDir,
    { voice: ttsVoice, speed: ttsSpeed, apiKey: openaiKey, concurrency: ttsConcurrency },
    (completed: number, total: number) => {
      ttsSpinner.text = `[1/2] Generating TTS audio... ${completed}/${total} scenes`
    },
  )
  ttsSpinner.succeed(
    chalk.green(
      `[1/2] TTS complete — ${audioManifest.scenes.length} scenes (${audioManifest.totalDurationSeconds.toFixed(1)}s total)`,
    ),
  )

  // Render (REND-04, REND-05, D-25)
  const outputPath = resolve(outputDir, `${projectName}.mp4`)
  const srtPath = resolve(outputDir, `${projectName}.srt`)

  const renderSpinner = ora(`[2/2] Rendering video...`).start()
  await video.renderVideo(storyArc, audioManifest, {
    outputPath,
    srtPath,
    onProgress: (p: { renderedFrames: number; totalFrames: number; progress: number }) => {
      const pct = Math.round(p.progress * 100)
      renderSpinner.text = `[2/2] Rendering video... ${pct}% (frame ${p.renderedFrames}/${p.totalFrames})`
    },
  })
  renderSpinner.succeed(chalk.green(`[2/2] Render complete`))

  console.log(chalk.bold(`\n  Output:`))
  console.log(`    Video: ${outputPath}`)
  console.log(`    Subtitles: ${srtPath}`)
  console.log()
}
