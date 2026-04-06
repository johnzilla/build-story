import { describe, it, expect, vi } from 'vitest'
import { discoverFiles, DEFAULT_PATTERNS, DEFAULT_EXCLUDES } from '../scan/file-walker.js'
import type { ArtifactSource } from '../types/source.js'
import type { ScanOptions } from '../types/options.js'

function makeSource(files: string[] = ['PLANNING.md', 'TASKS.md']): ArtifactSource & {
  glob: ReturnType<typeof vi.fn>
} {
  return {
    readFile: vi.fn().mockResolvedValue(''),
    glob: vi.fn().mockResolvedValue(files),
  }
}

describe('DEFAULT_PATTERNS', () => {
  it('includes GStack artifact patterns', () => {
    expect(DEFAULT_PATTERNS).toContain('PLANNING.md')
    expect(DEFAULT_PATTERNS).toContain('PLAN.md')
    expect(DEFAULT_PATTERNS).toContain('ARCHITECTURE.md')
    expect(DEFAULT_PATTERNS).toContain('DECISIONS.md')
    expect(DEFAULT_PATTERNS).toContain('ROADMAP.md')
    expect(DEFAULT_PATTERNS).toContain('STATUS.md')
    expect(DEFAULT_PATTERNS).toContain('CHANGELOG.md')
    expect(DEFAULT_PATTERNS.some((p) => p.includes('.gstack'))).toBe(true)
  })

  it('includes GSD artifact patterns', () => {
    expect(DEFAULT_PATTERNS).toContain('TASKS.md')
    expect(DEFAULT_PATTERNS).toContain('TODO.md')
    expect(DEFAULT_PATTERNS).toContain('SESSION_LOG.md')
    expect(DEFAULT_PATTERNS).toContain('BLOCKERS.md')
    expect(DEFAULT_PATTERNS.some((p) => p.includes('.gsd'))).toBe(true)
    expect(DEFAULT_PATTERNS.some((p) => p.includes('.planning'))).toBe(true)
    expect(DEFAULT_PATTERNS.some((p) => p.includes('.claude'))).toBe(true)
  })

  it('includes generic planning artifact patterns', () => {
    expect(DEFAULT_PATTERNS.some((p) => p.includes('ADR'))).toBe(true)
    expect(DEFAULT_PATTERNS.some((p) => p.includes('docs/'))).toBe(true)
    expect(DEFAULT_PATTERNS).toContain('README.md')
  })
})

describe('DEFAULT_EXCLUDES', () => {
  it('includes node_modules, .git, vendor, dist, target, build, .turbo', () => {
    expect(DEFAULT_EXCLUDES).toContain('node_modules/**')
    expect(DEFAULT_EXCLUDES).toContain('.git/**')
    expect(DEFAULT_EXCLUDES).toContain('vendor/**')
    expect(DEFAULT_EXCLUDES).toContain('dist/**')
    expect(DEFAULT_EXCLUDES).toContain('target/**')
    expect(DEFAULT_EXCLUDES).toContain('build/**')
    expect(DEFAULT_EXCLUDES).toContain('.turbo/**')
  })
})

describe('discoverFiles()', () => {
  it('calls source.glob() with DEFAULT_PATTERNS when no custom patterns provided', async () => {
    const source = makeSource()
    const options: ScanOptions = { rootDir: '/project' }
    await discoverFiles(source, options)
    expect(source.glob).toHaveBeenCalledOnce()
    const [patterns] = source.glob.mock.calls[0] as [string[], unknown]
    expect(patterns).toEqual(DEFAULT_PATTERNS)
  })

  it('uses options.patterns when provided (overrides defaults)', async () => {
    const source = makeSource()
    const customPatterns = ['**/*.md', 'custom/**/*.txt']
    const options: ScanOptions = { rootDir: '/project', patterns: customPatterns }
    await discoverFiles(source, options)
    const [patterns] = source.glob.mock.calls[0] as [string[], unknown]
    expect(patterns).toEqual(customPatterns)
  })

  it('passes DEFAULT_EXCLUDES to glob ignore', async () => {
    const source = makeSource()
    const options: ScanOptions = { rootDir: '/project' }
    await discoverFiles(source, options)
    const [, opts] = source.glob.mock.calls[0] as [string[], { cwd: string; ignore: string[]; maxDepth: number }]
    expect(opts?.ignore).toEqual(expect.arrayContaining(DEFAULT_EXCLUDES))
  })

  it('merges options.excludes with DEFAULT_EXCLUDES', async () => {
    const source = makeSource()
    const options: ScanOptions = { rootDir: '/project', excludes: ['custom/**'] }
    await discoverFiles(source, options)
    const [, opts] = source.glob.mock.calls[0] as [string[], { cwd: string; ignore: string[]; maxDepth: number }]
    expect(opts?.ignore).toContain('custom/**')
    expect(opts?.ignore).toContain('node_modules/**')
  })

  it('passes maxDepth defaulting to 5', async () => {
    const source = makeSource()
    const options: ScanOptions = { rootDir: '/project' }
    await discoverFiles(source, options)
    const [, opts] = source.glob.mock.calls[0] as [string[], { cwd: string; ignore: string[]; maxDepth: number }]
    expect(opts?.maxDepth).toBe(5)
  })

  it('uses options.maxDepth when provided', async () => {
    const source = makeSource()
    const options: ScanOptions = { rootDir: '/project', maxDepth: 3 }
    await discoverFiles(source, options)
    const [, opts] = source.glob.mock.calls[0] as [string[], { cwd: string; ignore: string[]; maxDepth: number }]
    expect(opts?.maxDepth).toBe(3)
  })

  it('passes rootDir as cwd', async () => {
    const source = makeSource()
    const options: ScanOptions = { rootDir: '/my/project' }
    await discoverFiles(source, options)
    const [, opts] = source.glob.mock.calls[0] as [string[], { cwd: string; ignore: string[]; maxDepth: number }]
    expect(opts?.cwd).toBe('/my/project')
  })

  it('returns the array from source.glob()', async () => {
    const source = makeSource(['PLANNING.md', 'TASKS.md', 'docs/guide.md'])
    const options: ScanOptions = { rootDir: '/project' }
    const result = await discoverFiles(source, options)
    expect(result).toEqual(['PLANNING.md', 'TASKS.md', 'docs/guide.md'])
  })
})
