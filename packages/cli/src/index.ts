import { loadEnvFile } from 'node:process'

try { loadEnvFile() } catch { /* no .env file — use existing env */ }

import { Command } from 'commander'
import { run } from './commands/run.js'
import { scanCommand } from './commands/scan.js'
import { narrateCommand } from './commands/narrate.js'
import { renderCommand } from './commands/render.js'

const program = new Command()

program
  .name('buildstory')
  .description('Extract and narrate your build story from planning artifacts')
  .version('0.1.0')

program
  .command('run [paths...]')
  .description('Run the full pipeline: scan -> narrate -> TTS -> render')
  .option('-c, --config <path>', 'path to buildstory.toml')
  .option('--provider <provider>', 'LLM provider (anthropic|openai)', 'anthropic')
  .option('--style <style>', 'narrative style', 'story')
  .option('-o, --output <path>', 'output directory', './buildstory-out')
  .option('--skip-video', 'Skip video rendering, text-only output')
  .option('--include-text', 'Include text formats alongside video')
  .option('--dry-run', 'Show cost estimates without calling APIs')
  .option('--no-title-card', 'Disable auto-inserted title card')
  .option('--no-stats-card', 'Disable auto-inserted stats card')
  .option('--renderer <renderer>', 'Video renderer (remotion|heygen)', 'remotion')
  .action(run)

program
  .command('scan')
  .description('Scan planning artifacts and produce a timeline')
  .argument('[paths...]', 'Paths to scan', ['.'])
  .option('-o, --output <file>', 'Output file path (default: stdout)')
  .option('-c, --config <path>', 'Config file path')
  .action(async (paths: string[], opts: { output?: string; config?: string }) => {
    await scanCommand(paths, opts)
  })

program
  .command('narrate')
  .description('Generate narrative from a timeline')
  .argument('<timeline>', 'Path to timeline.json')
  .option('-c, --config <path>', 'Config file path')
  .option('-f, --format <format>', 'Output format (outline|thread|blog|video-script) — all by default')
  .option('--provider <provider>', 'LLM provider (anthropic|openai)', 'anthropic')
  .option('--style <style>', 'Narrative style (technical|overview|retrospective|pitch|story)', 'overview')
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
  .option('--renderer <renderer>', 'Video renderer (remotion|heygen)', 'remotion')
  .action(async (storyArc: string, opts) => {
    await renderCommand(storyArc, opts)
  })

await program.parseAsync(process.argv)
