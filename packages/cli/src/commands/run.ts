import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname, basename } from 'node:path'
import chalk from 'chalk'
import ora from 'ora'
import { scan, narrate, format, createProvider } from '@buildstory/core'
import type { FormatType } from '@buildstory/core'
import { loadConfig } from '../config.js'
import { createFsSource } from '../adapters/fs-source.js'
import { createGitSource } from '../adapters/git-source.js'

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

  const style = (config.style ?? opts.style) as 'technical' | 'overview' | 'retrospective' | 'pitch'

  console.log(
    chalk.dim(`  Project: ${projectName} | Provider: ${provider} | Style: ${style}\n`),
  )

  const formatTypes: FormatType[] = ['outline', 'thread', 'blog', 'video-script']
  const totalSteps = 2 + formatTypes.length // scan + narrate + each format

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
    chalk.green(`[1/${totalSteps}] Scan complete — ${timeline.events.length} events (${formatDuration(Date.now() - scanStart)})`),
  )

  const narrateOpts = { provider, style, apiKey }

  // Create ONE provider instance — pass to both narrate() and format() (no double instantiation)
  const llmProvider = createProvider(narrateOpts)

  // Step 2: Narrate
  const narrateStart = Date.now()
  const narrateSpinner = ora(`[2/${totalSteps}] Extracting story arc...`).start()
  const arc = await narrate(timeline, narrateOpts, llmProvider)
  narrateSpinner.succeed(
    chalk.green(`[2/${totalSteps}] Story arc extracted — ${arc.beats.length} beats (${formatDuration(Date.now() - narrateStart)})`),
  )

  // Steps 3+: Format each output type, reusing the same LLMProvider instance
  const outputs: Record<string, string> = {}
  for (let i = 0; i < formatTypes.length; i++) {
    const ft = formatTypes[i]!
    const step = i + 3
    const fmtStart = Date.now()
    const fmtSpinner = ora(`[${step}/${totalSteps}] Generating ${ft}...`).start()
    outputs[ft] = await format(arc, ft, llmProvider)
    fmtSpinner.succeed(
      chalk.green(`[${step}/${totalSteps}] ${ft}.md (${formatDuration(Date.now() - fmtStart)})`),
    )
  }

  // Write output files to disk — project name subfolder
  const outputDir = resolve(opts.output, projectName)
  await mkdir(outputDir, { recursive: true })

  await writeFile(resolve(outputDir, 'story-arc.json'), JSON.stringify(arc, null, 2))

  for (const ft of formatTypes) {
    await writeFile(resolve(outputDir, `${ft}.md`), outputs[ft] ?? '')
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
  console.log(chalk.bold(`  Tokens:     `) + `${formatTokens(usage.inputTokens)} in / ${formatTokens(usage.outputTokens)} out (${formatTokens(usage.inputTokens + usage.outputTokens)} total)`)
  console.log(chalk.bold(`  Output:     `) + outputDir)
  console.log(
    chalk.bold(`  Files:      `) +
      ['story-arc.json', ...formatTypes.map((ft) => `${ft}.md`)].join(', '),
  )
  console.log()

  return { timeline, arc, outputs }
}
