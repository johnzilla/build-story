import type { ArtifactSource } from '../types/source.js'
import type { ScanOptions } from '../types/options.js'
import type { Timeline, TimelineEvent } from '../types/timeline.js'
import type { GitSource } from '../types/git-source.js'
import { discoverFiles } from './file-walker.js'
import { parseArtifact, classifyArtifact } from './artifact-parser.js'
import { buildTimeline } from './timeline-builder.js'

export async function scan(
  source: ArtifactSource,
  options: ScanOptions,
  gitSource?: GitSource | null,
): Promise<Timeline> {
  const scannedAt = new Date().toISOString()

  // 1. Discover files via ArtifactSource.glob()
  const filePaths = await discoverFiles(source, options)

  // 2. Build path set for cross-reference resolution (SCAN-09)
  const allPaths = new Set(filePaths)

  // 3. Parse each file into a TimelineEvent (one event per file, per D-01)
  const fileEvents: Array<Omit<TimelineEvent, 'id'>> = []

  for (const filePath of filePaths) {
    // Read file content via source (redaction is caller's responsibility per D-09)
    const content = await source.readFile(filePath)

    // Parse artifact: heading summary, frontmatter metadata, cross-references
    const parsed = await parseArtifact(content, filePath, source, allPaths)

    // Classify artifact type
    const artifactType = classifyArtifact(filePath)

    // Resolve date + dateConfidence per D-06:
    // 1. Git date (exact) → 2. mtime (estimated) → 3. scannedAt fallback (unknown)
    let date = scannedAt
    let dateConfidence: 'exact' | 'inferred' | 'estimated' | 'unknown' = 'unknown'

    if (gitSource != null) {
      const gitDate = await gitSource.getFileDate(filePath)
      if (gitDate !== null) {
        date = gitDate
        dateConfidence = 'exact'
      } else if (source.getMtime) {
        const mtime = await source.getMtime(filePath)
        if (mtime !== null) {
          date = mtime.toISOString()
          dateConfidence = 'estimated'
        }
      }
    } else if (source.getMtime) {
      const mtime = await source.getMtime(filePath)
      if (mtime !== null) {
        date = mtime.toISOString()
        dateConfidence = 'estimated'
      }
    }

    // Construct file event with all TimelineEventSchema fields
    // Metadata contains only frontmatter data — no beat hints or narrative concepts (D-07)
    fileEvents.push({
      date,
      source: 'file',
      path: filePath,
      summary: parsed.summary,
      metadata: parsed.metadata,
      dateConfidence,
      rawContent: parsed.rawContent,
      artifactType,
      crossRefs: parsed.crossRefs,
    })
  }

  // 4. Build timeline: handles tag events, sorting, dateRange, and Zod validation
  return buildTimeline({
    rootDir: options.rootDir,
    scannedAt,
    fileEvents,
    gitSource: gitSource ?? null,
  })
}
