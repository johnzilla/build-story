import { Command } from 'commander'
import { run } from './commands/run.js'

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

await program.parseAsync(process.argv)
