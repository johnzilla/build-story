import type { ArtifactSource } from '../types/source.js'
import type { ScanOptions } from '../types/options.js'

export const DEFAULT_PATTERNS: string[] = [
  // GStack artifacts (SCAN-02)
  'PLANNING.md',
  'PLAN.md',
  'ARCHITECTURE.md',
  'DECISIONS.md',
  'ROADMAP.md',
  'STATUS.md',
  'CHANGELOG.md',
  '*.gstack',
  '.gstack/**/*.md',
  // GSD artifacts (SCAN-03)
  'TASKS.md',
  'TODO.md',
  'SESSION_LOG.md',
  'BLOCKERS.md',
  '*.gsd',
  '.gsd/**/*.md',
  '.planning/**/*.md',
  '.claude/**/*.md',
  // Generic planning artifacts (SCAN-04)
  'ADR/**/*.md',
  'adr/**/*.md',
  'docs/**/*.md',
  'README.md',
]

export const DEFAULT_EXCLUDES: string[] = [
  'node_modules/**',
  '.git/**',
  'vendor/**',
  'dist/**',
  'target/**',
  'build/**',
  '.turbo/**',
]

export async function discoverFiles(
  source: ArtifactSource,
  options: ScanOptions,
): Promise<string[]> {
  const patterns = options.patterns ?? DEFAULT_PATTERNS
  const excludes = [...DEFAULT_EXCLUDES, ...(options.excludes ?? [])]
  return source.glob(patterns, {
    cwd: options.rootDir,
    ignore: excludes,
    maxDepth: options.maxDepth ?? 5,
  })
}
