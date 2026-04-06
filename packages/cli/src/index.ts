import { Command } from 'commander'
import { run } from './commands/run.js'
import { scanCommand } from './commands/scan.js'

const program = new Command()

program
  .name('buildstory')
  .description('Extract and narrate your build story from planning artifacts')
  .version('0.1.0')

program
  .command('run [paths...]')
  .description('Run the full pipeline: scan -> narrate -> format')
  .option('-c, --config <path>', 'path to buildstory.toml')
  .option('--provider <provider>', 'LLM provider (anthropic|openai)', 'anthropic')
  .option('--style <style>', 'narrative style', 'overview')
  .option('-o, --output <path>', 'output directory', './buildstory-out')
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

await program.parseAsync(process.argv)
