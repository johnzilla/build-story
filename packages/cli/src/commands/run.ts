import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname, basename } from 'node:path'
import chalk from 'chalk'
import ora from 'ora'
import { scan, narrate, format, createProvider } from '@buildstory/core'
import type { FormatType } from '@buildstory/core'
import { loadConfig } from '../config.js'
import { createFsSource } from '../adapters/fs-source.js'
import { createGitSource } from '../adapters/git-source.js'
import { ensureVideoPackage, ensureHeyGenPackage } from '../lazy.js'

function formatDuration(ms: number): string {
  const secs = Math.round(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const rem = secs % 60
  return `${mins}m ${rem}s`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

export async function run(
  paths: string[],
  opts: {
    config?: string
    provider: string
    style: string
    output: string
    skipVideo?: boolean
    includeText?: boolean
    dryRun?: boolean
    noTitleCard?: boolean
    noStatsCard?: boolean
    renderer?: string
  },
) {
  const pipelineStart = Date.now()

  // Eng review amendment: use --config path to determine project root
  const projectRoot = opts.config ? dirname(resolve(opts.config)) : process.cwd()
  const config = loadConfig(projectRoot)
  const rootDir = paths[0] ?? process.cwd()
  const projectName = basename(resolve(rootDir))

  console.log(chalk.bold('\n  BuildStory\n'))

  // Eng review amendment: select API key based on provider
  const provider = (config.provider ?? opts.provider) as 'anthropic' | 'openai'
  const apiKey =
    provider === 'anthropic'
      ? (process.env['ANTHROPIC_API_KEY'] ?? '')
      : (process.env['OPENAI_API_KEY'] ?? '')

  const style = (config.style ?? opts.style) as
    | 'technical'
    | 'overview'
    | 'retrospective'
    | 'pitch'
    | 'story'

  const skipVideo = opts.skipVideo ?? false
  const includeText = opts.includeText ?? false

  console.log(
    chalk.dim(`  Project: ${projectName} | Provider: ${provider} | Style: ${style}\n`),
  )

  const formatTypes: FormatType[] = ['outline', 'thread', 'blog', 'video-script']

  // Step numbering depends on mode
  // Video mode: scan(1) + narrate(2) + TTS(3) + render(4) [+ format steps if --include-text]
  // Skip-video mode: scan(1) + narrate(2) + 4 formats(3-6)
  const totalSteps = skipVideo
    ? 2 + formatTypes.length
    : includeText
      ? 2 + 2 + formatTypes.length
      : 4 // scan + narrate + TTS + render

  // Step 1: Scan
  const source = createFsSource(resolve(rootDir))
  const gitSource = await createGitSource(resolve(rootDir))

  const scanStart = Date.now()
  const scanSpinner = ora(`[1/${totalSteps}] Scanning artifacts...`).start()
  const timeline = await scan(
    source,
    {
      rootDir,
      patterns: config.scan?.patterns,
      excludes: config.scan?.excludes,
      maxDepth: config.scan?.maxDepth,
    },
    gitSource,
  )
  scanSpinner.succeed(
    chalk.green(
      `[1/${totalSteps}] Scan complete — ${timeline.events.length} events (${formatDuration(Date.now() - scanStart)})`,
    ),
  )

  const narrateOpts = { provider, style, apiKey }

  // Create ONE provider instance — pass to both narrate() and format() (no double instantiation)
  const llmProvider = createProvider(narrateOpts)

  // Step 2: Narrate
  const narrateStart = Date.now()
  const narrateSpinner = ora(`[2/${totalSteps}] Extracting story arc...`).start()
  const arc = await narrate(timeline, narrateOpts, llmProvider)
  narrateSpinner.succeed(
    chalk.green(
      `[2/${totalSteps}] Story arc extracted — ${arc.beats.length} beats (${formatDuration(Date.now() - narrateStart)})`,
    ),
  )

  // Write output directory and story-arc.json
  const outputDir = resolve(opts.output, projectName)
  await mkdir(outputDir, { recursive: true })
  await writeFile(resolve(outputDir, 'story-arc.json'), JSON.stringify(arc, null, 2))

  // Video pipeline (when not skipping video)
  let mp4Path: string | undefined
  let srtPath: string | undefined

  if (!skipVideo) {
    const renderer = opts.renderer ?? config.video?.renderer ?? 'remotion'

    if (renderer === 'heygen') {
      await ensureHeyGenPackage()
      const heygen = await import('@buildstory/heygen')

      // Satisfies HeyGenConfig -- defaulted fields are optional
      const heygenOpts = {
        apiKey: process.env['HEYGEN_API_KEY'] ?? '',
        avatarId: config.heygen?.avatarId ?? '',
        voiceId: config.heygen?.voiceId ?? '',
      }

      const preflight = await heygen.preflightHeyGenCheck(heygenOpts)
      if (!preflight.ok) {
        console.error(chalk.red('\n  Preflight check failed:\n'))
        preflight.failures.forEach((f: string) => console.error(chalk.red(`    - ${f}`)))
        console.error()
        process.exit(1)
      }

      const cost = heygen.estimateHeyGenCost(arc.beats, heygenOpts)
      console.log(
        chalk.dim(
          `  ${cost.sceneCount} scenes | avatar: ${cost.avatarId} | ~${cost.creditsRequired} credits (~$${cost.estimatedCostUSD.toFixed(2)} estimated)\n`,
        ),
      )

      if (opts.dryRun) {
        console.log(chalk.yellow('  --dry-run: Skipping HeyGen submission.\n'))
        return
      }

      console.error(chalk.red('  HeyGen video submission not yet implemented (Phase 7).'))
      process.exit(1)
    } else {
      // === Existing Remotion path (unchanged) ===
      // Lazy install check (REND-10, D-10)
      await ensureVideoPackage()

      // Dynamic import after install confirmed
      const video = await import('@buildstory/video')

      // Preflight check (REND-11, D-12)
      const openaiKey = process.env['OPENAI_API_KEY'] ?? ''
      const preflight = await video.preflightCheck({ openaiApiKey: openaiKey })
      if (!preflight.ok) {
        console.error(chalk.red('\n  Preflight check failed:\n'))
        preflight.failures.forEach((f: string) => console.error(chalk.red(`    - ${f}`)))
        console.error()
        process.exit(1)
      }

      // TTS cost estimate (REND-03, D-16)
      const costEstimate = video.estimateTTSCost(arc.beats)
      console.log(
        chalk.dim(
          `  Generating audio for ${costEstimate.sceneCount} scenes (~$${costEstimate.estimatedCostUSD.toFixed(2)} estimated)\n`,
        ),
      )

      if (opts.dryRun) {
        console.log(chalk.yellow('  --dry-run: Skipping TTS and render. Cost estimate above.\n'))
        return
      }

      // TTS (REND-02)
      const ttsVoice = config.tts?.voice ?? 'nova'
      const ttsSpeed = config.tts?.speed ?? 1.0
      const ttsConcurrency = config.tts?.concurrency ?? 2

      const ttsSpinner = ora(`[3/${totalSteps}] Generating TTS audio...`).start()
      const audioManifest = await video.orchestrateTTS(
        arc.beats,
        outputDir,
        { voice: ttsVoice, speed: ttsSpeed, apiKey: openaiKey, concurrency: ttsConcurrency },
        (completed: number, total: number) => {
          ttsSpinner.text = `[3/${totalSteps}] Generating TTS audio... ${completed}/${total} scenes`
        },
      )
      ttsSpinner.succeed(
        chalk.green(
          `[3/${totalSteps}] TTS complete — ${audioManifest.scenes.length} scenes (${audioManifest.totalDurationSeconds.toFixed(1)}s total)`,
        ),
      )

      // Render (REND-04, REND-05, D-25)
      mp4Path = resolve(outputDir, `${projectName}.mp4`)
      srtPath = resolve(outputDir, `${projectName}.srt`)

      const renderSpinner = ora(`[4/${totalSteps}] Rendering video...`).start()
      await video.renderVideo(arc, audioManifest, {
        outputPath: mp4Path,
        srtPath,
        onProgress: (p: { renderedFrames: number; totalFrames: number; progress: number }) => {
          const pct = Math.round(p.progress * 100)
          renderSpinner.text = `[4/${totalSteps}] Rendering video... ${pct}% (frame ${p.renderedFrames}/${p.totalFrames})`
        },
      })
      renderSpinner.succeed(chalk.green(`[4/${totalSteps}] Render complete`))
    }
  }

  // Text format generation: always in skip-video mode; only with --include-text in video mode
  const outputs: Record<string, string> = {}
  if (skipVideo || includeText) {
    const stepOffset = skipVideo ? 2 : 4 // after scan+narrate or after scan+narrate+TTS+render
    for (let i = 0; i < formatTypes.length; i++) {
      const ft = formatTypes[i]!
      const step = stepOffset + i + 1
      const fmtStart = Date.now()
      const fmtSpinner = ora(`[${step}/${totalSteps}] Generating ${ft}...`).start()
      outputs[ft] = await format(arc, ft, llmProvider)
      fmtSpinner.succeed(
        chalk.green(`[${step}/${totalSteps}] ${ft}.md (${formatDuration(Date.now() - fmtStart)})`),
      )
      await writeFile(resolve(outputDir, `${ft}.md`), outputs[ft] ?? '')
    }
  }

  // Final summary
  const totalTime = formatDuration(Date.now() - pipelineStart)
  const dateRange = timeline.dateRange
  const dateStart = dateRange?.start ? new Date(dateRange.start).toLocaleDateString() : '?'
  const dateEnd = dateRange?.end ? new Date(dateRange.end).toLocaleDateString() : '?'

  const artifactCounts = timeline.events.reduce(
    (acc, ev) => {
      acc[ev.artifactType] = (acc[ev.artifactType] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const usage = llmProvider.getUsage()

  console.log(chalk.bold(`\n  Done in ${totalTime}\n`))
  console.log(chalk.bold(`  Project:    `) + projectName)
  console.log(chalk.bold(`  Timeline:   `) + `${dateStart} → ${dateEnd}`)
  console.log(chalk.bold(`  Events:     `) + `${timeline.events.length} scanned`)
  console.log(
    chalk.bold(`  Artifacts:  `) +
      Object.entries(artifactCounts)
        .map(([type, count]) => `${count} ${type}`)
        .join(', '),
  )
  console.log(chalk.bold(`  Beats:      `) + `${arc.beats.length} narrative beats`)
  console.log(chalk.bold(`  API calls:  `) + `${usage.calls} (${provider})`)
  console.log(
    chalk.bold(`  Tokens:     `) +
      `${formatTokens(usage.inputTokens)} in / ${formatTokens(usage.outputTokens)} out (${formatTokens(usage.inputTokens + usage.outputTokens)} total)`,
  )
  console.log(chalk.bold(`  Output:     `) + outputDir)

  if (!skipVideo && mp4Path && srtPath) {
    console.log(chalk.bold(`  Video:      `) + mp4Path)
    console.log(chalk.bold(`  Subtitles:  `) + srtPath)
  }

  const textFiles = skipVideo || includeText ? formatTypes.map((ft) => `${ft}.md`) : []
  const allFiles = ['story-arc.json', ...textFiles, ...(mp4Path ? [`${projectName}.mp4`] : []), ...(srtPath ? [`${projectName}.srt`] : [])]
  console.log(chalk.bold(`  Files:      `) + allFiles.join(', '))
  console.log()

  return { timeline, arc, outputs }
}
