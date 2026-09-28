import { applyPronunciations } from '@buildstory/core'
import { checkOutputDirectory, checkVideoPrerequisites } from '../preflight.js'
import { writePayloadPreview } from '../preview.js'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import chalk from 'chalk'
import ora from 'ora'
import type { StoryArc } from '@buildstory/core'
import { StoryArcSchema, sanitizeStoryArc } from '@buildstory/core'
import { loadConfig, resolveOutputDir, projectLabel } from '../config.js'
import {
  checkRenderer,
  checkVoice,
  checkSpeed,
  checkTtsModel,
  reportErrors,
  DEFAULT_RENDERER,
  DEFAULT_VOICE,
  DEFAULT_SPEED,
  DEFAULT_TTS_MODEL,
} from '../validate.js'

// Renderer dispatch is a plain flag check below (remotion | heygen) — no plugin
// registry (D-02). Each renderer's contract lives in its own package.

export async function renderCommand(
  storyArcPath: string,
  opts: {
    config?: string
    output?: string
    dryRun?: boolean
    previewPayload?: string
    // commander maps `--no-title-card`/`--no-stats-card` to these (default true).
    titleCard?: boolean
    statsCard?: boolean
    renderer?: string
  },
): Promise<void> {
  const projectRoot = dirname(resolve(storyArcPath))
  const config = loadConfig(projectRoot, opts.config)

  // Validate inputs before any paid call. Precedence: flag > config > default.
  const errors: string[] = []
  const renderer = checkRenderer(opts.renderer ?? config.video?.renderer ?? DEFAULT_RENDERER, errors)
  // TTS config is only used by the Remotion path, but a malformed value is worth
  // surfacing up front regardless of which renderer runs.
  const ttsVoice = checkVoice(config.tts?.voice ?? DEFAULT_VOICE, errors)
  const ttsSpeed = checkSpeed(config.tts?.speed ?? DEFAULT_SPEED, errors)
  const ttsModel = checkTtsModel(config.tts?.model ?? DEFAULT_TTS_MODEL, errors)
  reportErrors(errors)

  // Load and validate story arc (T-04-09: parse through Zod schema)
  const raw = await readFile(resolve(storyArcPath), 'utf-8')
  const storyArc: StoryArc = applyPronunciations(sanitizeStoryArc(StoryArcSchema.parse(JSON.parse(raw))), config.tts?.pronunciations)

  const projectName = storyArc.metadata.sourceTimeline
    ? projectLabel(storyArc.metadata.sourceTimeline)
    : 'project'

  console.log(chalk.bold('\n  BuildStory Render\n'))
  console.log(chalk.dim(`  Story: ${storyArc.beats.length} beats | Source: ${projectName}\n`))

  if (opts.previewPayload) {
    if (renderer === 'heygen') {
      const { adaptStoryArc } = await import('@buildstory/heygen')
      const adapted = adaptStoryArc(storyArc, {
        avatarId: config.heygen?.avatarId ?? '[AVATAR_ID]',
        voiceId: config.heygen?.voiceId ?? '[VOICE_ID]',
      })
      await writePayloadPreview(opts.previewPayload, {
        provider: 'heygen',
        stage: 'video-generation',
        note: 'Authentication omitted. Missing avatar/voice IDs use placeholders. No preflight or API calls made.',
        requests: adapted.chunks.map((scenes) => ({
          video_inputs: scenes,
          dimension: { width: 1280, height: 720 },
        })),
        warnings: adapted.warnings,
      })
    } else {
      const { prepareSpeechChunks } = await import('@buildstory/video')
      await writePayloadPreview(opts.previewPayload, {
        provider: 'openai',
        stage: 'speech-generation',
        note: 'Authentication omitted. Lists all scenes; cached audio may skip requests. No preflight or API calls made.',
        requests: storyArc.beats.flatMap((beat) => prepareSpeechChunks(beat.speechText ?? beat.summary).map((input) => ({
          model: ttsModel,
          voice: ttsVoice,
          input,
          speed: ttsSpeed,
        }))),
      })
    }
    return
  }

  const outputDir = resolveOutputDir(opts.output, config, projectRoot, projectName)
  let preflight: { chromePath?: string } = {}
  if (!opts.dryRun) {
    await checkOutputDirectory(outputDir, [`${projectName}.mp4`, `${projectName}.srt`])
    preflight = await checkVideoPrerequisites(renderer, config)
  }

  if (renderer === 'heygen') {
    // @buildstory/heygen is a hard workspace dep; the dynamic import only defers
    // loading its module graph until render time.
    const heygen = await import('@buildstory/heygen')

    // Build options -- API key from env only, never config (per anti-pattern rule)
    // This object satisfies HeyGenConfig (z.input type) -- defaulted fields are optional
    const heygenOpts = {
      apiKey: process.env['HEYGEN_API_KEY'] ?? '',
      avatarId: config.heygen?.avatarId ?? '',
      voiceId: config.heygen?.voiceId ?? '',
    }

    // Cost estimate (SAFE-02, D-04, D-05)
    const cost = heygen.estimateHeyGenCost(storyArc.beats, heygenOpts)
    console.log(
      chalk.dim(
        `  ${cost.sceneCount} scenes | avatar: ${cost.avatarId} | ~${cost.creditsRequired} credits (~$${cost.estimatedCostUSD.toFixed(2)} estimated)\n`,
      ),
    )

    // Dry-run exit (SAFE-03, D-08)
    if (opts.dryRun) {
      console.log(chalk.yellow('  --dry-run: Skipping HeyGen submission.\n'))
      return
    }

    // HeyGen submission (HGVR-02, HGVR-03, HGVR-04)
    const { renderWithHeyGen } = heygen

    await mkdir(outputDir, { recursive: true })
    const outputPath = resolve(outputDir, `${projectName}.mp4`)

    const heygenSpinner = ora('Submitting to HeyGen...').start()

    try {
      const result = await renderWithHeyGen(
        storyArc,
        heygenOpts,
        outputPath,
        (msg: string) => { heygenSpinner.text = msg },
      )

      heygenSpinner.succeed(chalk.green('HeyGen render complete'))

      if (result.warnings.length > 0) {
        console.log(chalk.yellow('\n  Warnings:'))
        result.warnings.forEach((w: string) => console.log(chalk.yellow(`    - ${w}`)))
      }

      console.log(chalk.bold('\n  Output:'))
      console.log(`    Video: ${result.videoPath}`)
      console.log()
    } catch (err) {
      heygenSpinner.fail(chalk.red('HeyGen render failed'))
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

    const openaiKey = process.env['OPENAI_API_KEY'] ?? ''

    // TTS cost estimate (REND-03, D-16) — priced at the model actually called
    const costEstimate = video.estimateTTSCost(storyArc.beats, ttsModel)
    console.log(
      chalk.dim(
        `  Generating audio for ${costEstimate.sceneCount} scenes (~$${costEstimate.estimatedCostUSD.toFixed(2)} estimated)\n`,
      ),
    )

    if (opts.dryRun) {
      console.log(chalk.yellow('  --dry-run: Skipping TTS and render. Cost estimate above.\n'))
      return
    }

    await mkdir(outputDir, { recursive: true })

    // TTS (REND-02) — voice/speed/model validated above; concurrency here.
    const ttsConcurrency = config.tts?.concurrency ?? 2

    const ttsSpinner = ora(`[1/2] Generating TTS audio...`).start()
    const audioManifest = await video.orchestrateTTS(
      storyArc.beats,
      outputDir,
      { voice: ttsVoice, speed: ttsSpeed, apiKey: openaiKey, concurrency: ttsConcurrency, model: ttsModel },
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

    // Card visibility: CLI --no-*-card forces off; else config; else on.
    const showTitleCard = opts.titleCard === false ? false : (config.render?.titleCard ?? true)
    const showStatsCard = opts.statsCard === false ? false : (config.render?.statsCard ?? true)

    const renderSpinner = ora(`[2/2] Rendering video...`).start()
    await video.renderVideo(storyArc, audioManifest, {
      outputPath,
      srtPath,
      showTitleCard,
      showStatsCard,
      captions: config.render?.captions ?? true,
      normalizeLoudness: config.render?.normalizeLoudness ?? true,
      // Reuse the Chrome/Chromium preflight located, so a machine where preflight
      // passes always renders.
      ...(preflight.chromePath ? { browserExecutable: preflight.chromePath } : {}),
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
}
