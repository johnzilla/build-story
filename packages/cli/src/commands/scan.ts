import { resolve } from 'path'
import { writeFileSync } from 'fs'
import chalk from 'chalk'
import ora from 'ora'
import { scan } from '@buildstory/core'
import { loadConfig, toScanOptions } from '../config.js'
import { createFsSource } from '../adapters/fs-source.js'
import { createGitSource } from '../adapters/git-source.js'
import { createTranscriptSource } from '../adapters/transcript-registry.js'

export async function scanCommand(
  paths: string[],
  opts: {
    config?: string
    output?: string
  },
) {
  const rootDir = resolve(paths[0] ?? process.cwd())
  const config = loadConfig(opts.config ? resolve(opts.config, '..') : process.cwd())

  const source = createFsSource(rootDir)
  const spinner = ora('Detecting git repository...').start()
  const gitSource = await createGitSource(rootDir)

  if (gitSource) {
    spinner.succeed(chalk.green('Git repository detected'))
  } else {
    spinner.warn(chalk.yellow('No git repository found — dates will use file mtime'))
  }

  const { source: transcriptSource, unknown: unknownHarnesses } = createTranscriptSource(
    config.transcripts,
  )
  if (unknownHarnesses.length > 0) {
    spinner.warn(chalk.yellow(`Unknown transcript harness(es) ignored: ${unknownHarnesses.join(', ')}`))
  }

  spinner.start('Scanning artifacts...')
  const timeline = await scan(source, toScanOptions(rootDir, config), gitSource, transcriptSource)
  spinner.succeed(chalk.green(`Scan complete — ${timeline.events.length} events found`))

  const json = JSON.stringify(timeline, null, 2)

  if (opts.output) {
    writeFileSync(resolve(opts.output), json, 'utf8')
    console.log(chalk.green(`Timeline written to ${opts.output}`))
  } else {
    // Write to stdout for piping
    process.stdout.write(json + '\n')
  }

  return timeline
}
