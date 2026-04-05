import { readFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import chalk from 'chalk'
import ora from 'ora'
import { scan, narrate, format } from '@buildstory/core'
import type { ArtifactSource, FormatType } from '@buildstory/core'
import { loadConfig } from '../config.js'

/** Minimal fs-based ArtifactSource for CLI usage */
function createFsSource(): ArtifactSource {
  return {
    readFile: (path: string) => readFile(path, 'utf8'),
    glob: async (_patterns: string[], _options?: { cwd?: string; ignore?: string[] }) => {
      // Phase 1 stub: scan() ignores source for now — returns empty timeline
      return []
    },
  }
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
  // Eng review amendment: use --config path to determine project root
  const projectRoot = opts.config ? dirname(resolve(opts.config)) : process.cwd()
  const config = loadConfig(projectRoot)
  const rootDir = paths[0] ?? process.cwd()

  // Eng review amendment: select API key based on provider
  const provider = (config.provider ?? opts.provider) as 'anthropic' | 'openai'
  const apiKey =
    provider === 'anthropic'
      ? (process.env['ANTHROPIC_API_KEY'] ?? '')
      : (process.env['OPENAI_API_KEY'] ?? '')

  const source = createFsSource()

  const spinner = ora('Scanning artifacts...').start()
  const timeline = await scan(source, {
    rootDir,
    patterns: config.scan?.patterns,
    excludes: config.scan?.excludes,
    maxDepth: config.scan?.maxDepth,
  })
  spinner.succeed(chalk.green('Scan complete'))

  spinner.start('Narrating...')
  const arc = await narrate(timeline, {
    provider,
    style: (config.style ?? opts.style) as 'technical' | 'overview' | 'retrospective' | 'pitch',
    apiKey,
  })
  spinner.succeed(chalk.green('Narration complete'))

  // Eng review amendment: format() for each format type instead of render()
  const formatTypes: FormatType[] = ['outline', 'thread', 'blog', 'video-script']
  spinner.start('Formatting output...')
  const outputs: Record<string, string> = {}
  for (const ft of formatTypes) {
    outputs[ft] = await format(arc, ft)
  }
  spinner.succeed(chalk.green('Format complete'))

  return { timeline, arc, outputs }
}
