import { resolveEditorial } from '../editorial.js'
import { checkOutputDirectory, checkVideoPrerequisites, requireNarrationKey } from '../preflight.js'
import { buildNarrationPreview, SpendBudget, BudgetExceededError } from '@buildstory/core'
import { writePayloadPreview } from '../preview.js'
import { writeFile, mkdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import chalk from 'chalk'
import ora from 'ora'
import { applyPronunciations, scan, narrate, format, createProvider, renderSourceReview } from '@buildstory/core'
import type { FormatType, StoryArc } from '@buildstory/core'
import { loadConfig, toScanOptions, resolveOutputDir, projectLabel } from '../config.js'
import { createFsSource } from '../adapters/fs-source.js'
import { createGitSource } from '../adapters/git-source.js'
import { createTranscriptSource } from '../adapters/transcript-registry.js'
import { ttsCostUSD } from '@buildstory/video/pricing'
import { claudeDirWarning } from '../warnings.js'
import {
  checkProvider,
  checkStyle,
  checkRenderer,
  checkVoice,
  checkSpeed,
  checkTtsModel,
  checkMaxCost,
  reportErrors,
  DEFAULT_PROVIDER,
  DEFAULT_STYLE,
  DEFAULT_RENDERER,
  DEFAULT_VOICE,
  DEFAULT_SPEED,
  DEFAULT_TTS_MODEL,
} from '../validate.js'

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
  path: string | undefined,
  opts: {
    question?: string
    pivotalEvents?: string[]
    targetRuntime?: string
    config?: string
    provider?: string
    style?: string
    output?: string
    skipVideo?: boolean
    includeText?: boolean
    dryRun?: boolean
    previewPayload?: string
    maxCost?: string
    // commander maps `--no-title-card`/`--no-stats-card` to these (default true).
    titleCard?: boolean
    statsCard?: boolean
    renderer?: string
  },
) {
  const pipelineStart = Date.now()

  const rootDir = resolve(path ?? process.cwd())
  if (!(await stat(rootDir)).isDirectory()) throw new Error(`Scan target is not a directory: ${rootDir}`)
  const config = loadConfig(rootDir, opts.config)
  const editorial = resolveEditorial(config.editorial, opts)
  const projectName = projectLabel(rootDir)

  console.log(chalk.bold('\n  BuildStory\n'))

  // Validate + resolve all inputs before any paid call. Precedence: flag >
  // buildstory.toml > built-in default. Fails fast, free, and clearly.
  const errors: string[] = []
  const provider = checkProvider(opts.provider ?? config.provider ?? DEFAULT_PROVIDER, errors)
  const style = checkStyle(opts.style ?? config.style ?? DEFAULT_STYLE, errors)
  const renderer = checkRenderer(opts.renderer ?? config.video?.renderer ?? DEFAULT_RENDERER, errors)
  const ttsVoice = checkVoice(config.tts?.voice ?? DEFAULT_VOICE, errors)
  const ttsSpeed = checkSpeed(config.tts?.speed ?? DEFAULT_SPEED, errors)
  const ttsModel = checkTtsModel(config.tts?.model ?? DEFAULT_TTS_MODEL, errors)
  const maxCost = checkMaxCost(opts.maxCost, errors)
  reportErrors(errors)

  // API key from env vars only, never logged.
  const apiKey =
    provider === 'anthropic'
      ? (process.env['ANTHROPIC_API_KEY'] ?? '')
      : (process.env['OPENAI_API_KEY'] ?? '')

  const skipVideo = opts.skipVideo ?? false
  const includeText = opts.includeText ?? false
  const heygenRenderer = renderer === 'heygen'

  console.log(
    chalk.dim(`  Project: ${projectName} | Provider: ${provider} | Style: ${style}\n`),
  )

  const formatTypes: FormatType[] = ['outline', 'thread', 'blog', 'video-script']

  // Step numbering depends on mode and renderer
  // Remotion video mode: scan(1) + narrate(2) + TTS(3) + render(4) [+ format steps if --include-text]
  // HeyGen video mode: scan(1) + narrate(2) + HeyGen(3) [+ format steps if --include-text]
  // Skip-video mode: scan(1) + narrate(2) + 4 formats(3-6)
  const totalSteps = skipVideo
    ? 2 + formatTypes.length
    : includeText
      ? 2 + (heygenRenderer ? 1 : 2) + formatTypes.length
      : heygenRenderer ? 3 : 4

  // Step 1: Scan
  const source = createFsSource(resolve(rootDir))
  const gitSource = await createGitSource(resolve(rootDir))
  const { source: transcriptSource, unknown: unknownHarnesses } = createTranscriptSource(
    config.transcripts,
  )
  if (unknownHarnesses.length > 0) {
    console.log(chalk.yellow(`  Unknown transcript harness(es) ignored: ${unknownHarnesses.join(', ')}`))
  }

  const scanStart = Date.now()
  const scanSpinner = ora(`[1/${totalSteps}] Scanning artifacts...`).start()
  const timeline = await scan(source, toScanOptions(rootDir, config), gitSource, transcriptSource)
  scanSpinner.succeed(
    chalk.green(
      `[1/${totalSteps}] Scan complete — ${timeline.events.length} events (${formatDuration(Date.now() - scanStart)})`,
    ),
  )

  const claudeWarning = claudeDirWarning(timeline)
  if (claudeWarning) console.log(chalk.yellow(`  ${claudeWarning}`))

  if (opts.previewPayload) {
    await writePayloadPreview(opts.previewPayload, {
      provider,
      ...buildNarrationPreview(timeline, { style, ...(editorial ? { editorial } : {}) }),
    })
    return { timeline, arc: undefined, outputs: {} }
  }

  // --dry-run: print a cost estimate from event count and exit BEFORE any
  // paid API calls. Accurate per-beat estimates come from `buildstory render
  // --dry-run` against an existing story-arc.json (where actual beats are
  // known); in `run --dry-run` we deliberately trade accuracy for zero spend.
  if (opts.dryRun) {
    const events = timeline.events.length
    // Empirical: scans typically yield ~1 beat per 3 events (e.g. 82 events
    // → ~28 beats in the blindjoin reference run). Used only for display.
    const estBeats = Math.max(1, Math.round(events / 3))
    const AVG_BEAT_CHARS = 150
    // Price against the TTS model that render will actually call (one source of
    // truth — @buildstory/video/pricing), not a hardcoded rate.
    const estTTSCost = ttsCostUSD(estBeats * AVG_BEAT_CHARS, ttsModel)

    console.log(chalk.dim('\n  Estimated cost (no API calls made):\n'))
    console.log(chalk.dim(`    Scan:          $0 (local filesystem) — done`))
    console.log(
      chalk.dim(
        `    Narration:     ~$0.05–0.20 (1 ${provider} call; ${events} events → ~${estBeats} beats)`,
      ),
    )
    if (!skipVideo) {
      if (heygenRenderer) {
        console.log(
          chalk.dim(
            `    HeyGen render: ~$${(estBeats * 0.5).toFixed(2)}–$${(estBeats * 1.0).toFixed(2)} (~${estBeats} scenes; depends on avatar & voice)`,
          ),
        )
      } else {
        console.log(
          chalk.dim(
            `    TTS:           ~$${estTTSCost.toFixed(2)} (OpenAI ${ttsModel}, ~${estBeats} scenes × ~${AVG_BEAT_CHARS} chars)`,
          ),
        )
        console.log(chalk.dim(`    Render:        $0 (local CPU + ffmpeg)`))
      }
    }
    if (skipVideo || includeText) {
      console.log(chalk.dim(`    Text formats:  ~$0.05–0.15 (4 ${provider} calls)`))
    }
    console.log(
      chalk.yellow(
        '\n  --dry-run: stopping before narrate. No LLM, TTS, or render calls made.\n',
      ),
    )
    return
  }

  requireNarrationKey(provider, apiKey)
  const outputDir = resolveOutputDir(opts.output, config, rootDir, projectName)
  await checkOutputDirectory(outputDir, [
    'story-arc.json', 'source-review.md', ...(skipVideo || includeText ? formatTypes.map(type => `${type}.md`) : []),
    ...(!skipVideo ? [`${projectName}.mp4`, `${projectName}.srt`] : []),
  ])
  const videoPreflight = skipVideo ? {} : await checkVideoPrerequisites(renderer, config)

  const budget = new SpendBudget(maxCost)
  const narrateOpts = { provider, style, apiKey, budget, ...(editorial ? { editorial } : {}) }
  const llmProvider = createProvider(narrateOpts)

  function printSpendReport(): void {
    const entries = budget.snapshot()
    const total = (basis: string) => entries.filter((entry) => entry.basis === basis).reduce((sum, entry) => sum + entry.usd, 0)
    const usage = llmProvider.getUsage()
    console.log(chalk.bold('\n  Spend (this run, at configured rates)'))
    console.log(chalk.dim(`    LLM reported usage: ${formatTokens(usage.inputTokens)} in / ${formatTokens(usage.outputTokens)} out, ${usage.calls} call(s) — $${total('usage').toFixed(4)}`))
    console.log(chalk.dim(`    TTS / HeyGen estimates: $${total('estimate').toFixed(4)}`))
    console.log(chalk.dim(`    Uncertain requests (reserved): $${total('unknown').toFixed(4)}`))
    console.log(chalk.dim(`    Cached audio / existing jobs reused: ${entries.filter((entry) => entry.basis === 'cached').length} ($0 new requests)`))
    console.log(chalk.bold(`    Accounted total: $${entries.reduce((sum, entry) => sum + entry.usd, 0).toFixed(4)}`) + (maxCost === undefined ? '' : ` (cap $${maxCost.toFixed(4)})`))
  }

  let arc: StoryArc | undefined
  const outputs: Record<string, string> = {}
  let activeSpinner: ReturnType<typeof ora> | undefined
  try {
    // Step 2: Narrate
    const narrateStart = Date.now()
    const narrateSpinner = activeSpinner = ora(`[2/${totalSteps}] Extracting story arc...`).start()
    arc = applyPronunciations(await narrate(timeline, narrateOpts, llmProvider), config.tts?.pronunciations)
    narrateSpinner.succeed(
      chalk.green(
        `[2/${totalSteps}] Story arc extracted — ${arc.beats.length} beats (${formatDuration(Date.now() - narrateStart)})`,
      ),
    )

    // Write output directory and story-arc.json
    await mkdir(outputDir, { recursive: true })
    await writeFile(resolve(outputDir, 'story-arc.json'), JSON.stringify(arc, null, 2))
    await writeFile(resolve(outputDir, 'source-review.md'), renderSourceReview(arc))
    if (arc.metadata.warnings?.length) {
      console.log(chalk.yellow(`  Source review: ${arc.metadata.warnings.length} notes — see source-review.md before publishing.`))
    }

    // Video pipeline (when not skipping video)
    let mp4Path: string | undefined
    let srtPath: string | undefined

    if (!skipVideo) {
      if (renderer === 'heygen') {
        // @buildstory/heygen is a hard workspace dep (always installed); the
        // dynamic import only defers loading its module graph until render time.
        const heygen = await import('@buildstory/heygen')

        // Satisfies HeyGenConfig -- defaulted fields are optional
        const heygenOpts = {
          apiKey: process.env['HEYGEN_API_KEY'] ?? '',
          avatarId: config.heygen?.avatarId ?? '',
          voiceId: config.heygen?.voiceId ?? '',
        }

        const cost = heygen.estimateHeyGenCost(arc.beats, heygenOpts)
        console.log(
          chalk.dim(
            `  ${cost.sceneCount} scenes | avatar: ${cost.avatarId} | ~${cost.creditsRequired} credits (~$${cost.estimatedCostUSD.toFixed(2)} estimated)\n`,
          ),
        )

        // HeyGen submission (HGVR-02, HGVR-03, HGVR-04)
        const { renderWithHeyGen } = heygen

        mp4Path = resolve(outputDir, `${projectName}.mp4`)

        const heygenSpinner = activeSpinner = ora(`[3/${totalSteps}] Submitting to HeyGen...`).start()

        try {
          const heygenResult = await renderWithHeyGen(
            arc,
            heygenOpts,
            mp4Path,
            (msg: string) => { heygenSpinner.text = `[3/${totalSteps}] ${msg}` },
            budget,
          )

          heygenSpinner.succeed(chalk.green(`[3/${totalSteps}] HeyGen render complete`))
          mp4Path = heygenResult.videoPath

          if (heygenResult.warnings.length > 0) {
            console.log(chalk.yellow('\n  Warnings:'))
            heygenResult.warnings.forEach((w: string) => console.log(chalk.yellow(`    - ${w}`)))
          }
        } catch (err) {
          heygenSpinner.fail(chalk.red(`[3/${totalSteps}] HeyGen render failed`))
          if (err instanceof Error) {
            console.error(chalk.red(`\n  ${err.message}\n`))
          }
          throw err
        }
      } else {
        // === Remotion path ===
        // @buildstory/video is a hard workspace dep; the dynamic import only defers
        // loading its heavy module graph (Remotion) until render time.
        const video = await import('@buildstory/video')

        const openaiKey = process.env['OPENAI_API_KEY'] ?? ''
        // TTS cost estimate (REND-03, D-16) — priced at the validated model.
        const costEstimate = video.estimateTTSCost(arc.beats, ttsModel)
        console.log(
          chalk.dim(
            `  Generating audio for ${costEstimate.sceneCount} scenes (~$${costEstimate.estimatedCostUSD.toFixed(2)} estimated)\n`,
          ),
        )

        // TTS (REND-02) — voice/speed/model validated above; concurrency here.
        const ttsConcurrency = config.tts?.concurrency ?? 2

        const ttsSpinner = activeSpinner = ora(`[3/${totalSteps}] Generating TTS audio...`).start()
        const audioManifest = await video.orchestrateTTS(
          arc.beats,
          outputDir,
          { voice: ttsVoice, speed: ttsSpeed, apiKey: openaiKey, concurrency: ttsConcurrency, model: ttsModel, budget },
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

        // Card visibility: CLI --no-*-card forces off; else config; else on.
        const showTitleCard = opts.titleCard === false ? false : (config.render?.titleCard ?? true)
        const showStatsCard = opts.statsCard === false ? false : (config.render?.statsCard ?? true)

        const renderSpinner = activeSpinner = ora(`[4/${totalSteps}] Rendering video...`).start()
        await video.renderVideo(arc, audioManifest, {
          outputPath: mp4Path,
          srtPath,
          showTitleCard,
          showStatsCard,
          captions: config.render?.captions ?? true,
          normalizeLoudness: config.render?.normalizeLoudness ?? true,
          // Use the Chrome/Chromium preflight already located, so a machine where
          // preflight passes always renders (no second, divergent discovery).
          ...(videoPreflight.chromePath ? { browserExecutable: videoPreflight.chromePath } : {}),
          onProgress: (p: { renderedFrames: number; totalFrames: number; progress: number }) => {
            const pct = Math.round(p.progress * 100)
            renderSpinner.text = `[4/${totalSteps}] Rendering video... ${pct}% (frame ${p.renderedFrames}/${p.totalFrames})`
          },
        })
        renderSpinner.succeed(chalk.green(`[4/${totalSteps}] Render complete`))
      }
    }

    // Text format generation: always in skip-video mode; only with --include-text in video mode
    if (skipVideo || includeText) {
      const stepOffset = skipVideo ? 2 : heygenRenderer ? 3 : 4 // after scan+narrate, scan+narrate+HeyGen, or scan+narrate+TTS+render
      for (let i = 0; i < formatTypes.length; i++) {
        const ft = formatTypes[i]!
        const step = stepOffset + i + 1
        const fmtStart = Date.now()
        const fmtSpinner = activeSpinner = ora(`[${step}/${totalSteps}] Generating ${ft}...`).start()
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
        const key = ev.artifactType ?? 'unknown'
        acc[key] = (acc[key] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

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
    console.log(chalk.bold(`  Output:     `) + outputDir)

    if (!skipVideo && mp4Path && srtPath) {
      console.log(chalk.bold(`  Video:      `) + mp4Path)
      console.log(chalk.bold(`  Subtitles:  `) + srtPath)
    }

    const textFiles = Object.keys(outputs).map((ft) => `${ft}.md`)
    const allFiles = ['story-arc.json', 'source-review.md', ...textFiles, ...(mp4Path ? [`${projectName}.mp4`] : []), ...(srtPath ? [`${projectName}.srt`] : [])]
    console.log(chalk.bold(`  Files:      `) + allFiles.join(', '))


    return { timeline, arc, outputs }
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      console.log(chalk.yellow(`\n  ${error.message}`))
      return { timeline, arc, outputs }
    }
    throw error
  } finally {
    activeSpinner?.stop()
    printSpendReport()
  }
}
