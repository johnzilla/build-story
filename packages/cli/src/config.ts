import { PROVIDERS, STYLES, TTS_VOICES, TTS_MODELS, RENDERERS } from './validate.js'
import { readFileSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { homedir } from 'os'
import { parse } from 'smol-toml'
import type { ScanOptions } from '@buildstory/core'

export interface BuildStoryConfig {
  provider?: 'anthropic' | 'openai'
  style?: 'technical' | 'overview' | 'retrospective' | 'pitch' | 'story'
  outputDir?: string
  scan?: {
    patterns?: string[]
    excludes?: string[]
    maxDepth?: number
    includeFiles?: boolean
  }
  commits?: {
    enabled?: boolean
    max?: number
    since?: string
    includeMerges?: boolean
    paths?: string[]
  }
  transcripts?: {
    enabled?: boolean
    /** Which agent harnesses to read. Default: all known (claude-code, pi). */
    harnesses?: string[]
    /** Override Claude Code's session dir (default: ~/.claude/projects). */
    claudeCodePath?: string
    /** Override pi's session dir (default: ~/.pi/agent/sessions). */
    piPath?: string
    since?: string
    until?: string
    /** Attach session reasoning to the commits it produced (default: true). */
    correlate?: boolean
  }
  tts?: {
    voice?: string
    speed?: number
    concurrency?: number
    /** OpenAI TTS model: "tts-1-hd" (default) or "tts-1". */
    model?: 'tts-1' | 'tts-1-hd'
  }
  render?: {
    titleCard?: boolean
    statsCard?: boolean
  }
  video?: {
    renderer?: 'remotion' | 'heygen'
  }
  heygen?: {
    avatarId?: string
    voiceId?: string
  }
}

/**
 * Map loaded config to core ScanOptions, setting only keys that are defined —
 * `exactOptionalPropertyTypes` forbids passing an explicit `undefined` for an
 * optional field.
 */
export function toScanOptions(rootDir: string, config: BuildStoryConfig): ScanOptions {
  const opts: ScanOptions = { rootDir }
  if (config.scan?.patterns !== undefined) opts.patterns = config.scan.patterns
  if (config.scan?.excludes !== undefined) opts.excludes = config.scan.excludes
  if (config.scan?.maxDepth !== undefined) opts.maxDepth = config.scan.maxDepth
  if (config.scan?.includeFiles !== undefined) opts.includeFiles = config.scan.includeFiles
  if (config.commits !== undefined) opts.commits = config.commits
  if (config.transcripts !== undefined) opts.transcripts = config.transcripts
  return opts
}

type Rule = (value: unknown) => boolean
const text: Rule = value => typeof value === 'string' && value.trim().length > 0
const boolean: Rule = value => typeof value === 'boolean'
const strings: Rule = value => Array.isArray(value) && value.every(text)
const integer = (min: number, max = Number.MAX_SAFE_INTEGER): Rule => value => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
const oneOf = (values: readonly string[]): Rule => value => typeof value === 'string' && values.includes(value)
const sections: Record<string, Record<string, Rule>> = {
  scan: { patterns: strings, excludes: strings, maxDepth: integer(0), includeFiles: boolean },
  commits: { enabled: boolean, max: integer(1), since: text, includeMerges: boolean, paths: strings },
  transcripts: { enabled: boolean, harnesses: strings, claudeCodePath: text, piPath: text,
    since: value => text(value) && Number.isFinite(Date.parse(value as string)),
    until: value => text(value) && Number.isFinite(Date.parse(value as string)), correlate: boolean },
  tts: { voice: oneOf(TTS_VOICES), model: oneOf(TTS_MODELS), concurrency: integer(1, 64),
    speed: value => typeof value === 'number' && Number.isFinite(value) && value >= 0.25 && value <= 4 },
  render: { titleCard: boolean, statsCard: boolean },
  video: { renderer: oneOf(RENDERERS) },
  heygen: { avatarId: text, voiceId: text },
}
const topLevel: Record<string, Rule> = { provider: oneOf(PROVIDERS), style: oneOf(STYLES), outputDir: text }

function configPath(file: string, value: string): string {
  if (value === '~') return homedir()
  if (value.startsWith('~/')) return resolve(homedir(), value.slice(2))
  return resolve(dirname(file), value)
}

function readConfig(file: string, required: boolean): BuildStoryConfig {
  let raw: unknown
  try {
    raw = parse(readFileSync(file, 'utf8'))
  } catch (error) {
    if (!required && (error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw new Error(`Cannot load config ${file}: ${(error as Error).message}`)
  }
  const errors: string[] = []
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`Invalid config ${file}: expected a TOML table`)
  for (const [key, value] of Object.entries(raw)) {
    if (Object.hasOwn(topLevel, key)) {
      if (!topLevel[key]!(value)) errors.push(`Invalid ${key}`)
    } else if (Object.hasOwn(sections, key)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) { errors.push(`Invalid ${key}: expected a table`); continue }
      for (const [field, item] of Object.entries(value)) {
        const rules = sections[key]!
        if (!Object.hasOwn(rules, field)) errors.push(`Unknown field ${key}.${field}`)
        else if (!rules[field]!(item)) errors.push(`Invalid ${key}.${field}`)
      }
    } else errors.push(`Unknown field ${key}`)
  }
  if (errors.length) throw new Error(`Invalid config ${file}:\n${errors.join('\n')}`)
  const config = raw as BuildStoryConfig
  // Resolve each path at its defining file before merging global/project config.
  if (config.outputDir !== undefined) config.outputDir = configPath(file, config.outputDir)
  for (const key of ['claudeCodePath', 'piPath'] as const) {
    const value = config.transcripts?.[key]
    if (value !== undefined) config.transcripts![key] = configPath(file, value)
  }
  return config
}

/** Positional target controls discovery; an explicit config replaces the project file. */
export function loadConfig(projectRoot: string, explicitFile?: string): BuildStoryConfig {
  if (explicitFile !== undefined && !explicitFile.trim()) throw new Error('--config requires a nonempty path')
  const globalPath = join(homedir(), '.config', 'buildstory', 'config.toml')
  const projectPath = explicitFile ? resolve(explicitFile) : join(projectRoot, 'buildstory.toml')
  const globalConfig = readConfig(globalPath, false)
  const projectConfig = readConfig(projectPath, explicitFile !== undefined)
  // Deep merge: nested objects (scan) must be merged field-by-field
  // so that a project config setting only scan.maxDepth does not
  // discard scan.patterns from the global config.
  const merged = {
    ...globalConfig,
    ...projectConfig,
    scan: { ...globalConfig.scan, ...projectConfig.scan },
    commits: { ...globalConfig.commits, ...projectConfig.commits },
    transcripts: { ...globalConfig.transcripts, ...projectConfig.transcripts },
    tts: { ...globalConfig.tts, ...projectConfig.tts },
    render: { ...globalConfig.render, ...projectConfig.render },
    video: { ...globalConfig.video, ...projectConfig.video },
    heygen: { ...globalConfig.heygen, ...projectConfig.heygen },
  }
  const { since, until } = merged.transcripts
  if (since && until && Date.parse(since) > Date.parse(until)) throw new Error(`Invalid config ${projectPath}: transcripts.since must not follow transcripts.until`)
  return merged
}


export function projectLabel(value: string): string {
  const label = value.split(/[\\/]/).filter(Boolean).at(-1)
  return !label || label === '.' || label === '..' ? 'project' : label
}

/** CLI paths are cwd-relative; config paths were resolved at load time. */
export function resolveOutputDir(output: string | undefined, config: BuildStoryConfig, projectRoot: string, projectName: string): string {
  if (output !== undefined && !output.trim()) throw new Error('--output requires a nonempty path')
  const base = output !== undefined ? resolve(output) : config.outputDir ?? resolve(projectRoot, 'buildstory-out')
  return join(base, projectLabel(projectName))
}
