import { readFile, stat } from 'fs/promises'
import { resolve, relative, dirname, join } from 'path'
import fg from 'fast-glob'
import type { ArtifactSource } from '@buildstory/core'
import { redactSecrets } from './redact.js'

export function createFsSource(rootDir: string): ArtifactSource {
  return {
    readFile: async (filePath: string) => {
      const absolutePath = resolve(rootDir, filePath)
      const raw = await readFile(absolutePath, 'utf8')
      return redactSecrets(raw) // D-09: single enforcement point
    },

    glob: async (
      patterns: string[],
      options?: { cwd?: string; ignore?: string[]; maxDepth?: number },
    ) => {
      const cwd = options?.cwd ?? rootDir
      return fg(patterns, {
        cwd,
        ignore: options?.ignore ?? [],
        deep: options?.maxDepth ?? 5, // SCAN-11 default depth
        onlyFiles: true,
        dot: true, // Critical: .planning/, .gstack/, .claude/ are dotdirs
        followSymbolicLinks: false,
      })
    },

    resolveRef: (fromPath: string, refUrl: string): string | null => {
      // Resolve relative link from one file to another
      const fromDir = dirname(join(rootDir, fromPath))
      const resolved = resolve(fromDir, refUrl)
      return relative(rootDir, resolved)
    },

    getMtime: async (filePath: string): Promise<Date | null> => {
      try {
        const absolutePath = resolve(rootDir, filePath)
        const stats = await stat(absolutePath)
        return stats.mtime
      } catch {
        return null
      }
    },
  }
}
