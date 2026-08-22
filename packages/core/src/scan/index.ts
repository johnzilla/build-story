import type { ArtifactSource } from '../types/source.js'
import type { ScanOptions } from '../types/options.js'
import type { Timeline, TimelineEvent } from '../types/timeline.js'
import type { GitSource, GetCommitsOptions } from '../types/git-source.js'
import type { TranscriptSource } from '../types/transcript.js'
import { discoverFiles } from './file-walker.js'
import { parseArtifact, classifyArtifact } from './artifact-parser.js'
import { buildTimeline } from './timeline-builder.js'
import { buildCommitEvents } from './commit-source.js'
import { buildTranscriptEvents } from './transcript-source.js'

/** An event, pre-id or with an id already assigned (commit/tag events pre-assign). */
type CollectedEvent = Omit<TimelineEvent, 'id'> & { id?: string }

/**
 * Collect one event per planning-artifact file.
 *
 * Date resolution per file: git date (exact) → mtime (estimated) → scannedAt (unknown).
 */
async function collectFileEvents(
  source: ArtifactSource,
  options: ScanOptions,
  gitSource: GitSource | null,
  scannedAt: string,
): Promise<CollectedEvent[]> {
  const filePaths = await discoverFiles(source, options)
  const allPaths = new Set(filePaths)
  const events: CollectedEvent[] = []

  for (const filePath of filePaths) {
    // Read file content via source (redaction is caller's responsibility per D-09)
    const content = await source.readFile(filePath)
    const parsed = await parseArtifact(content, filePath, source, allPaths)
    const artifactType = classifyArtifact(filePath)

    // Date + dateConfidence per D-06: git date (exact) → mtime (estimated) → scannedAt (unknown)
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

    // Metadata contains only frontmatter data — no beat hints or narrative concepts (D-07)
    events.push({
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

  return events
}

/**
 * Collect `git-commit` events from the GitSource, when it supports commit
 * extraction and commit collection is enabled.
 */
async function collectCommitEvents(
  options: ScanOptions,
  gitSource: GitSource | null,
): Promise<CollectedEvent[]> {
  const enabled = options.commits?.enabled ?? true
  if (!enabled || gitSource?.getCommits == null) return []

  // Build options with only the keys the caller set — exactOptionalPropertyTypes
  // forbids passing an explicit `undefined` for an optional field.
  const commitOptions: GetCommitsOptions = {}
  if (options.commits?.max !== undefined) commitOptions.max = options.commits.max
  if (options.commits?.since !== undefined) commitOptions.since = options.commits.since
  if (options.commits?.includeMerges !== undefined) {
    commitOptions.includeMerges = options.commits.includeMerges
  }
  if (options.commits?.paths !== undefined) commitOptions.paths = options.commits.paths

  const commits = await gitSource.getCommits(commitOptions)
  return buildCommitEvents(commits)
}

/**
 * Collect agent-session transcript events, when enabled and a TranscriptSource
 * is injected. Off by default — transcripts are opt-in (they can carry secrets
 * and dead-ends), so this returns nothing unless `options.transcripts.enabled`.
 */
async function collectTranscriptEvents(
  options: ScanOptions,
  transcriptSource: TranscriptSource | null,
): Promise<CollectedEvent[]> {
  if (!options.transcripts?.enabled || transcriptSource == null) return []

  const filter: { projectPath: string; since?: string; until?: string } = {
    projectPath: options.rootDir,
  }
  if (options.transcripts.since !== undefined) filter.since = options.transcripts.since
  if (options.transcripts.until !== undefined) filter.until = options.transcripts.until

  const sessions = await transcriptSource.listSessions(filter)
  return buildTranscriptEvents(sessions)
}

/**
 * Scan a project into a chronological Timeline from a set of pluggable event
 * sources:
 *
 * - **file** — planning artifacts (GStack/GSD/generic markdown). Default on;
 *   disable with `options.includeFiles = false`.
 * - **git-commit** — the development history itself. Default on whenever the
 *   GitSource supports `getCommits`; configure via `options.commits`.
 * - **git-tag** — release milestones (added inside `buildTimeline`).
 * - **transcript** — agent session reasoning, off by default; requires an
 *   injected `TranscriptSource` and `options.transcripts.enabled`.
 *
 * All sources emit `TimelineEvent`s that are merged, sorted, and validated
 * together — nothing downstream (narrate/format/render) depends on where an
 * event came from.
 */
export async function scan(
  source: ArtifactSource,
  options: ScanOptions,
  gitSource?: GitSource | null,
  transcriptSource?: TranscriptSource | null,
): Promise<Timeline> {
  const scannedAt = new Date().toISOString()
  const git = gitSource ?? null

  const events: CollectedEvent[] = []

  if (options.includeFiles !== false) {
    events.push(...(await collectFileEvents(source, options, git, scannedAt)))
  }

  events.push(...(await collectCommitEvents(options, git)))
  events.push(...(await collectTranscriptEvents(options, transcriptSource ?? null)))

  // buildTimeline assigns ids to events without one, appends git-tag events,
  // sorts chronologically, computes dateRange, and validates via Zod.
  return buildTimeline({
    rootDir: options.rootDir,
    scannedAt,
    fileEvents: events,
    gitSource: git,
  })
}
