import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname, basename } from 'node:path'
import chalk from 'chalk'
import ora from 'ora'
import {
  narrate,
  format,
  createProvider,
  TimelineSchema,
  FormatTypeSchema,
} from '@buildstory/core'
import type { FormatType, NarrateOptions } from '@buildstory/core'
import { loadConfig } from '../config.js'

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

export async function narrateCommand(
  timelinePath: string,
  opts: {
    config?: string
    format?: string
    provider: string
    style: string
    output: string
  },
): Promise<void> {
  const pipelineStart = Date.now()

  // Load config from the directory containing the timeline file or cwd
  const projectRoot = opts.config ? dirname(resolve(opts.config)) : process.cwd()
  const config = loadConfig(projectRoot)

  // Read and validate timeline from disk (T-03-10: validate with TimelineSchema)
  console.log(chalk.bold('\n  BuildStory Narrate\n'))

  const loadSpinner = ora('Loading timeline...').start()
  const raw = await readFile(resolve(timelinePath), 'utf-8')
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch (err) {
    loadSpinner.fail(chalk.red(`Failed to parse timeline JSON: ${(err as Error).message}`))
    process.exit(1)
  }

  const timeline = TimelineSchema.parse(parsedJson)

  // Derive project name from timeline rootDir
  const projectName = basename(timeline.rootDir)
  loadSpinner.succeed(
    chalk.green(`Loaded timeline: ${chalk.bold(projectName)} — ${timeline.events.length} events`),
  )

  // Determine provider and API key (T-03-09: API keys from env vars only, never logged)
  const provider = (config.provider ?? opts.provider) as 'anthropic' | 'openai'
  const apiKey =
    provider === 'anthropic'
      ? (process.env['ANTHROPIC_API_KEY'] ?? '')
      : (process.env['OPENAI_API_KEY'] ?? '')

  const narrateOpts: NarrateOptions = {
    provider,
    style: (config.style ?? opts.style) as 'technical' | 'overview' | 'retrospective' | 'pitch',
    apiKey,
  }

  console.log(
    chalk.dim(`  Provider: ${provider} | Style: ${narrateOpts.style}\n`),
  )

  // Create ONE provider instance — pass to both narrate() and format() to avoid double instantiation
  const llmProvider = createProvider(narrateOpts)

  // Determine which format types to generate (D-05: all 4 by default, --format for single)
  let formatTypes: FormatType[]
  if (opts.format) {
    const parsed = FormatTypeSchema.safeParse(opts.format)
    if (!parsed.success) {
      console.error(
        chalk.red(
          `Error: Invalid --format value "${opts.format}". Must be one of: outline, thread, blog, video-script`,
        ),
      )
      process.exit(1)
    }
    formatTypes = [parsed.data]
  } else {
    formatTypes = ['outline', 'thread', 'blog', 'video-script']
  }

  const totalSteps = 1 + formatTypes.length // narrate + each format

  // Step 1: Narrate — timeline -> StoryArc
  const narrateStart = Date.now()
  const narrateSpinner = ora(`[1/${totalSteps}] Extracting story arc from timeline...`).start()
  const arc = await narrate(timeline, narrateOpts, llmProvider)
  narrateSpinner.succeed(
    chalk.green(`[1/${totalSteps}] Story arc extracted — ${arc.beats.length} beats (${formatDuration(Date.now() - narrateStart)})`),
  )

  // Resolve output directory with project name subfolder
  const outputDir = resolve(opts.output, projectName)
  await mkdir(outputDir, { recursive: true })

  // Write StoryArc JSON
  await writeFile(resolve(outputDir, 'story-arc.json'), JSON.stringify(arc, null, 2))

  // Steps 2+: Format — StoryArc -> text outputs, reuse the SAME LLMProvider instance
  for (let i = 0; i < formatTypes.length; i++) {
    const ft = formatTypes[i]!
    const step = i + 2
    const fmtStart = Date.now()
    const fmtSpinner = ora(`[${step}/${totalSteps}] Generating ${ft}...`).start()
    const text = await format(arc, ft, llmProvider)
    const outPath = resolve(outputDir, `${ft}.md`)
    await writeFile(outPath, text)
    fmtSpinner.succeed(
      chalk.green(`[${step}/${totalSteps}] ${ft}.md (${formatDuration(Date.now() - fmtStart)})`),
    )
  }

  // Final summary
  const totalTime = formatDuration(Date.now() - pipelineStart)
  const dateRange = timeline.dateRange
  const dateStart = dateRange?.start ? new Date(dateRange.start).toLocaleDateString() : '?'
  const dateEnd = dateRange?.end ? new Date(dateRange.end).toLocaleDateString() : '?'

  // Count unique artifact types
  const artifactCounts = timeline.events.reduce(
    (acc, ev) => {
      acc[ev.artifactType] = (acc[ev.artifactType] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  // Usage stats
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
  console.log(chalk.bold(`  Tokens:     `) + `${formatTokens(usage.inputTokens)} in / ${formatTokens(usage.outputTokens)} out (${formatTokens(usage.inputTokens + usage.outputTokens)} total)`)
  console.log(chalk.bold(`  Output:     `) + outputDir)
  console.log(
    chalk.bold(`  Files:      `) +
      ['story-arc.json', ...formatTypes.map((ft) => `${ft}.md`)].join(', '),
  )
  console.log()
}
