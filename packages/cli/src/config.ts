import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { parse } from 'smol-toml'

export interface BuildStoryConfig {
  provider?: 'anthropic' | 'openai'
  style?: 'technical' | 'overview' | 'retrospective' | 'pitch'
  outputDir?: string
  scan?: {
    patterns?: string[]
    excludes?: string[]
    maxDepth?: number
  }
}

export function loadConfig(projectRoot: string): BuildStoryConfig {
  const globalPath = join(homedir(), '.config', 'buildstory', 'config.toml')
  const projectPath = join(projectRoot, 'buildstory.toml')

  let globalConfig: BuildStoryConfig = {}
  if (existsSync(globalPath)) {
    try {
      globalConfig = parse(readFileSync(globalPath, 'utf8')) as BuildStoryConfig
    } catch (err) {
      console.error(
        `Warning: Failed to parse global config at ${globalPath}: ${(err as Error).message}`,
      )
    }
  }

  let projectConfig: BuildStoryConfig = {}
  if (existsSync(projectPath)) {
    try {
      projectConfig = parse(readFileSync(projectPath, 'utf8')) as BuildStoryConfig
    } catch (err) {
      console.error(
        `Warning: Failed to parse project config at ${projectPath}: ${(err as Error).message}`,
      )
    }
  }

  // Deep merge: nested objects (scan) must be merged field-by-field
  // so that a project config setting only scan.maxDepth does not
  // discard scan.patterns from the global config.
  return {
    ...globalConfig,
    ...projectConfig,
    scan: { ...globalConfig.scan, ...projectConfig.scan },
  }
}
