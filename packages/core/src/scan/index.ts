import type { ArtifactSource } from '../types/source.js'
import type { ScanOptions } from '../types/options.js'
import type { Timeline } from '../types/timeline.js'

export async function scan(source: ArtifactSource, options: ScanOptions): Promise<Timeline> {
  // Stub: ArtifactSource injected for testability — no direct fs access
  void source
  return {
    version: '1',
    rootDir: options.rootDir,
    scannedAt: new Date().toISOString(),
    dateRange: { start: '', end: '' },
    events: [],
  }
}
