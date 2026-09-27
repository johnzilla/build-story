import { access, mkdir, mkdtemp, rm, stat } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { BuildStoryConfig } from './config.js'
import type { Renderer } from './validate.js'

export async function checkOutputDirectory(directory: string, files: string[]): Promise<void> {
  await mkdir(directory, { recursive: true })
  for (const file of files) {
    const path = join(directory, file)
    try {
      if (!(await stat(path)).isFile()) throw new Error(`Output is not a file: ${path}`)
      await access(path, constants.W_OK)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  // An actual directory creation tests effective permissions, including ACLs.
  const probe = await mkdtemp(join(directory, '.buildstory-check-'))
  await rm(probe, { recursive: true })
}

export function requireNarrationKey(provider: string, apiKey: string): void {
  if (!apiKey.trim()) throw new Error(`${provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'} is required before narration`)
}

export async function checkVideoPrerequisites(renderer: Renderer, config: BuildStoryConfig): Promise<{ chromePath?: string }> {
  if (renderer === 'remotion') {
    const { preflightCheck } = await import('@buildstory/video')
    const result = await preflightCheck({ openaiApiKey: process.env['OPENAI_API_KEY'] ?? '' })
    if (!result.ok) throw new Error(`Preflight failed:\n${result.failures.join('\n')}`)
    return result.chromePath ? { chromePath: result.chromePath } : {}
  }
  const required = [
    !process.env['HEYGEN_API_KEY']?.trim() && 'HEYGEN_API_KEY',
    !config.heygen?.avatarId && 'heygen.avatarId',
    !config.heygen?.voiceId && 'heygen.voiceId',
  ].filter(Boolean)
  if (required.length) throw new Error(`HeyGen configuration missing: ${required.join(', ')}`)
  // A long arc can require multi-job assembly: check before any narration spend.
  try {
    await promisify(execFile)(process.env['FFMPEG_PATH'] ?? 'ffmpeg', ['-version'], { timeout: 10000 })
  } catch {
    throw new Error('HeyGen assembly requires FFmpeg. Install it or set FFMPEG_PATH before running.')
  }
  const { preflightHeyGenCheck } = await import('@buildstory/heygen')
  const result = await preflightHeyGenCheck({
    apiKey: process.env['HEYGEN_API_KEY']!, avatarId: config.heygen!.avatarId!, voiceId: config.heygen!.voiceId!,
  })
  if (!result.ok) throw new Error(`Preflight failed:\n${result.failures.join('\n')}`)
  return {}
}
