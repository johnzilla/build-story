import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
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
  // Load config from the directory containing the timeline file or cwd
  const projectRoot = opts.config ? dirname(resolve(opts.config)) : process.cwd()
  const config = loadConfig(projectRoot)

  // Read and validate timeline from disk (T-03-10: validate with TimelineSchema)
  const raw = await readFile(resolve(timelinePath), 'utf-8')
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch (err) {
    console.error(chalk.red(`Error: Failed to parse timeline JSON: ${(err as Error).message}`))
    process.exit(1)
  }

  const timeline = TimelineSchema.parse(parsedJson)

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

  // Create ONE provider instance — pass to both narrate() and format() to avoid double instantiation
  const llmProvider = createProvider(narrateOpts)

  // Narrate: timeline -> StoryArc
  const narrateSpinner = ora('Narrating timeline...').start()
  const arc = await narrate(timeline, narrateOpts, llmProvider)
  narrateSpinner.succeed(
    chalk.green(`Narration complete — ${arc.beats.length} beats extracted`),
  )

  // Ensure output directory exists
  const outputDir = resolve(opts.output)
  await mkdir(outputDir, { recursive: true })

  // Write StoryArc JSON
  const arcPath = resolve(outputDir, 'story-arc.json')
  await writeFile(arcPath, JSON.stringify(arc, null, 2))
  console.log(chalk.green(`  story-arc.json`))

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

  // Format: StoryArc -> text outputs — reuse the SAME LLMProvider instance
  for (const ft of formatTypes) {
    const fmtSpinner = ora(`Generating ${ft}...`).start()
    const text = await format(arc, ft, llmProvider)
    const outPath = resolve(outputDir, `${ft}.md`)
    await writeFile(outPath, text)
    fmtSpinner.succeed(chalk.green(`  ${ft}.md`))
  }

  // Summary of files written
  const written = ['story-arc.json', ...formatTypes.map((ft) => `${ft}.md`)]
  console.log(chalk.bold(`\nOutput written to ${opts.output}:`))
  for (const file of written) {
    console.log(`  ${chalk.cyan(file)}`)
  }
}
