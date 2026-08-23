import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname, basename } from 'node:path'
import chalk from 'chalk'
import ora from 'ora'
import { scan, narrate, format, createProvider } from '@buildstory/core'
import type { FormatType } from '@buildstory/core'
import { loadConfig, toScanOptions } from '../config.js'
import { createFsSource } from '../adapters/fs-source.js'
import { createGitSource } from '../adapters/git-source.js'
import { createTranscriptSource } from '../adapters/transcript-registry.js'
import { ttsCostUSD } from '@buildstory/video/pricing'
import { llmCostUSD, LLM_PRICE_PER_1M } from '../pricing-llm.js'
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
    config?: string
    provider?: string
    style?: string
    output: string
    skipVideo?: boolean
    includeText?: boolean
    dryRun?: boolean
    maxCost?: string
    // commander maps `--no-title-card`/`--no-stats-card` to these (default true).
    titleCard?: boolean
    statsCard?: boolean
    renderer?: string
  },
) {
  const pipelineStart = Date.now()

  // Eng review amendment: use --config path to determine project root
  const projectRoot = opts.config ? dirname(resolve(opts.config)) : process.cwd()
  const config = loadConfig(projectRoot)
  const rootDir = path ?? process.cwd()
  const projectName = basename(resolve(rootDir))

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

  const narrateOpts = { provider, style, apiKey }

  // Create ONE provider instance — pass to both narrate() and format() (no double instantiation)
  const llmProvider = createProvider(narrateOpts)

  // --- Spend tracking: --max-cost guardrail + end-of-run spend report (3.7) ---
  // LLM cost is derived from the provider's actual accumulated token usage; TTS
  // and HeyGen are tracked as each stage runs. spentUSD() is the live total.
  let ttsChars = 0
  let ttsUSD = 0
  let heygenCredits = 0
  let heygenUSD = 0
  const spentUSD = (): number => llmCostUSD(provider, llmProvider.getUsage()) + ttsUSD + heygenUSD

  /**
   * Abort before a stage that would push total spend past --max-cost. Prints why
   * and returns false; the caller stops the pipeline, leaving already-written
   * results (story-arc.json + any earlier outputs) in place.
   */
  const withinBudget = (stage: string, estimateUSD: number): boolean => {
    if (maxCost === undefined) return true
    const projected = spentUSD() + estimateUSD
    if (projected > maxCost) {
      console.log(
        chalk.yellow(
          `\n  Stopping before ${stage}: would exceed --max-cost $${maxCost.toFixed(2)} ` +
            `(spent $${spentUSD().toFixed(2)} + ${stage} ~$${estimateUSD.toFixed(2)} = ~$${projected.toFixed(2)}). ` +
            `Partial results kept.`,
        ),
      )
      return false
    }
    return true
  }

  // End-of-run spend report: actual LLM tokens/cost, TTS chars/cost, HeyGen
  // credits/cost, and the total (vs the cap, if set). Hoisted so early aborts
  // can print it too.
  function printSpendReport(): void {
    const usage = llmProvider.getUsage()
    const llmUSD = llmCostUSD(provider, usage)
    const total = llmUSD + ttsUSD + heygenUSD
    console.log(chalk.bold('\n  Spend'))
    console.log(
      chalk.dim(
        `    LLM:     ${formatTokens(usage.inputTokens)} in / ${formatTokens(usage.outputTokens)} out, ` +
          `${usage.calls} call(s) (${provider}) — $${llmUSD.toFixed(2)}`,
      ),
    )
    if (ttsChars > 0) {
      console.log(chalk.dim(`    TTS:     ${ttsChars.toLocaleString()} chars (${ttsModel}) — $${ttsUSD.toFixed(2)}`))
    }
    if (heygenCredits > 0) {
      console.log(chalk.dim(`    HeyGen:  ${heygenCredits} credit(s) — $${heygenUSD.toFixed(2)}`))
    }
    const cap = maxCost !== undefined ? ` (cap $${maxCost.toFixed(2)})` : ''
    console.log(chalk.bold(`    Total:   `) + `$${total.toFixed(2)}${cap}`)
  }

  // Pre-narrate gate: a conservative estimate (full timeline JSON incl. rawContent
  // over-counts input; ~4k output tokens) so a tiny cap aborts before any spend.
  const llmPrice = LLM_PRICE_PER_1M[provider]
  const narrateEstUSD =
    (Math.ceil(JSON.stringify(timeline).length / 4) / 1_000_000) * llmPrice.input +
    (4000 / 1_000_000) * llmPrice.output
  if (!withinBudget('narration', narrateEstUSD)) {
    printSpendReport()
    return { timeline, arc: undefined, outputs: {} }
  }

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

      // Validate required fields and surface clear errors before preflight
      const missingFields: string[] = []
      if (!heygenOpts.apiKey) missingFields.push('HEYGEN_API_KEY env var')
      if (!heygenOpts.avatarId) missingFields.push('heygen.avatarId in buildstory.toml')
      if (!heygenOpts.voiceId) missingFields.push('heygen.voiceId in buildstory.toml')
      if (missingFields.length > 0) {
        console.error(chalk.red('\n  HeyGen configuration missing:\n'))
        missingFields.forEach((f) => console.error(chalk.red(`    - ${f}`)))
        console.error()
        process.exit(1)
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

      // --max-cost gate: abort before the paid submit if it would exceed the cap.
      if (!withinBudget('HeyGen render', cost.estimatedCostUSD)) {
        printSpendReport()
        return { timeline, arc, outputs: {} }
      }

      // HeyGen submission (HGVR-02, HGVR-03, HGVR-04)
      const { renderWithHeyGen } = heygen

      mp4Path = resolve(outputDir, `${projectName}.mp4`)

      const heygenSpinner = ora(`[3/${totalSteps}] Submitting to HeyGen...`).start()

      try {
        const heygenResult = await renderWithHeyGen(
          arc,
          heygenOpts,
          mp4Path,
          (msg: string) => { heygenSpinner.text = `[3/${totalSteps}] ${msg}` },
        )

        heygenSpinner.succeed(chalk.green(`[3/${totalSteps}] HeyGen render complete`))
        mp4Path = heygenResult.videoPath
        heygenCredits = cost.creditsRequired
        heygenUSD = cost.estimatedCostUSD

        if (heygenResult.warnings.length > 0) {
          console.log(chalk.yellow('\n  Warnings:'))
          heygenResult.warnings.forEach((w: string) => console.log(chalk.yellow(`    - ${w}`)))
        }
      } catch (err) {
        heygenSpinner.fail(chalk.red(`[3/${totalSteps}] HeyGen render failed`))
        if (err instanceof Error) {
          console.error(chalk.red(`\n  ${err.message}\n`))
        }
        process.exit(1)
      }
    } else {
      // === Remotion path ===
      // @buildstory/video is a hard workspace dep; the dynamic import only defers
      // loading its heavy module graph (Remotion) until render time.
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

      // TTS cost estimate (REND-03, D-16) — priced at the validated model.
      const costEstimate = video.estimateTTSCost(arc.beats, ttsModel)
      console.log(
        chalk.dim(
          `  Generating audio for ${costEstimate.sceneCount} scenes (~$${costEstimate.estimatedCostUSD.toFixed(2)} estimated)\n`,
        ),
      )

      // --max-cost gate: abort before the paid TTS calls if they'd exceed the cap.
      if (!withinBudget('TTS + render', costEstimate.estimatedCostUSD)) {
        printSpendReport()
        return { timeline, arc, outputs: {} }
      }

      // TTS (REND-02) — voice/speed/model validated above; concurrency here.
      const ttsConcurrency = config.tts?.concurrency ?? 2

      const ttsSpinner = ora(`[3/${totalSteps}] Generating TTS audio...`).start()
      const audioManifest = await video.orchestrateTTS(
        arc.beats,
        outputDir,
        { voice: ttsVoice, speed: ttsSpeed, apiKey: openaiKey, concurrency: ttsConcurrency, model: ttsModel },
        (completed: number, total: number) => {
          ttsSpinner.text = `[3/${totalSteps}] Generating TTS audio... ${completed}/${total} scenes`
        },
      )
      ttsSpinner.succeed(
        chalk.green(
          `[3/${totalSteps}] TTS complete — ${audioManifest.scenes.length} scenes (${audioManifest.totalDurationSeconds.toFixed(1)}s total)`,
        ),
      )
      ttsChars = costEstimate.totalCharacters
      ttsUSD = costEstimate.estimatedCostUSD

      // Render (REND-04, REND-05, D-25)
      mp4Path = resolve(outputDir, `${projectName}.mp4`)
      srtPath = resolve(outputDir, `${projectName}.srt`)

      // Card visibility: CLI --no-*-card forces off; else config; else on.
      const showTitleCard = opts.titleCard === false ? false : (config.render?.titleCard ?? true)
      const showStatsCard = opts.statsCard === false ? false : (config.render?.statsCard ?? true)

      const renderSpinner = ora(`[4/${totalSteps}] Rendering video...`).start()
      await video.renderVideo(arc, audioManifest, {
        outputPath: mp4Path,
        srtPath,
        showTitleCard,
        showStatsCard,
        // Use the Chrome/Chromium preflight already located, so a machine where
        // preflight passes always renders (no second, divergent discovery).
        ...(preflight.chromePath ? { browserExecutable: preflight.chromePath } : {}),
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
    const stepOffset = skipVideo ? 2 : heygenRenderer ? 3 : 4 // after scan+narrate, scan+narrate+HeyGen, or scan+narrate+TTS+render
    // Rough per-format LLM estimate (beats + system prompt in, ~1.5k out) for the
    // --max-cost gate; each generated format is written before the next is gated,
    // so hitting the cap stops the loop with completed formats preserved.
    const beatsTokens = Math.ceil(JSON.stringify(arc.beats).length / 4)
    const perFormatEstUSD =
      ((beatsTokens + 2000) / 1_000_000) * llmPrice.input + (1500 / 1_000_000) * llmPrice.output
    for (let i = 0; i < formatTypes.length; i++) {
      const ft = formatTypes[i]!
      if (!withinBudget(`${ft} generation`, perFormatEstUSD)) break
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
  const allFiles = ['story-arc.json', ...textFiles, ...(mp4Path ? [`${projectName}.mp4`] : []), ...(srtPath ? [`${projectName}.srt`] : [])]
  console.log(chalk.bold(`  Files:      `) + allFiles.join(', '))

  // End-of-run spend report (actual LLM tokens, TTS chars, HeyGen credits).
  printSpendReport()
  console.log()

  return { timeline, arc, outputs }
}
