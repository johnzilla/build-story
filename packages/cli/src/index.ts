import { loadEnvFile } from 'node:process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Load .env from cwd. loadEnvFile() throws both when the file is absent (fine)
// and when it's present but malformed — distinguish so a broken .env isn't
// swallowed silently, leaving the user to wonder why their keys "aren't set".
try {
  loadEnvFile()
} catch {
  if (existsSync(resolve(process.cwd(), '.env'))) {
    console.error(
      'Warning: found a .env file but could not parse it — ignoring it. ' +
        'Check for malformed lines (expected KEY=value per line).',
    )
  }
}

import { Command } from 'commander'
import { run } from './commands/run.js'
import { scanCommand } from './commands/scan.js'
import { narrateCommand } from './commands/narrate.js'
import { renderCommand } from './commands/render.js'

const program = new Command()

program
  .name('buildstory')
  .description('Extract and narrate your build story from git history and planning artifacts')
  .version('0.1.0')

// Flag defaults are intentionally omitted for --provider/--style/--renderer so
// precedence is CLI flag > buildstory.toml > built-in default (resolved in the
// command). Commander would otherwise always set the flag, so config could never
// take effect — the bug this fixes.
program
  .command('run [path]')
  .description('Run the full pipeline: scan -> narrate -> TTS -> render')
  .option('-c, --config <path>', 'path to buildstory.toml')
  .option('--provider <provider>', 'LLM provider (anthropic|openai)')
  .option('--style <style>', 'narrative style (technical|overview|retrospective|pitch|story)')
  .option('-o, --output <path>', 'output directory', './buildstory-out')
  .option('--skip-video', 'Skip video rendering, text-only output')
  .option('--include-text', 'Include text formats alongside video')
  .option('--dry-run', 'Show cost estimates without calling APIs')
  .option('--max-cost <usd>', 'Abort before any stage that would exceed this total spend (USD)')
  .option('--no-title-card', 'Disable auto-inserted title card')
  .option('--no-stats-card', 'Disable auto-inserted stats card')
  .option('--renderer <renderer>', 'Video renderer (remotion|heygen)')
  .action(async (path: string | undefined, opts) => {
    await run(path, opts)
  })

program
  .command('scan')
  .description('Scan git history and planning artifacts into a timeline')
  .argument('[path]', 'Path to scan', '.')
  .option('-o, --output <file>', 'Output file path (default: stdout)')
  .option('-c, --config <path>', 'Config file path')
  .action(async (path: string, opts: { output?: string; config?: string }) => {
    await scanCommand(path, opts)
  })

program
  .command('narrate')
  .description('Generate narrative from a timeline')
  .argument('<timeline>', 'Path to timeline.json')
  .option('-c, --config <path>', 'Config file path')
  .option('-f, --format <format>', 'Output format (outline|thread|blog|video-script) — all by default')
  .option('--provider <provider>', 'LLM provider (anthropic|openai)')
  .option('--style <style>', 'Narrative style (technical|overview|retrospective|pitch|story)')
  .option('-o, --output <path>', 'Output directory', './buildstory-out')
  .action(async (timeline: string, opts) => {
    await narrateCommand(timeline, opts)
  })

program
  .command('render')
  .description('Render video from a story arc')
  .argument('<story-arc>', 'Path to story-arc.json')
  .option('-c, --config <path>', 'Config file path')
  .option('-o, --output <path>', 'Output directory', './buildstory-out')
  .option('--dry-run', 'Show TTS cost estimate without calling APIs')
  .option('--no-title-card', 'Disable auto-inserted title card')
  .option('--no-stats-card', 'Disable auto-inserted stats card')
  .option('--renderer <renderer>', 'Video renderer (remotion|heygen)')
  .action(async (storyArc: string, opts) => {
    await renderCommand(storyArc, opts)
  })

await program.parseAsync(process.argv)
