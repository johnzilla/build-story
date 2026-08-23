import type { Timeline } from '@buildstory/core'

/**
 * Warn when a scan ingested files under a repo's `.claude/` directory (agent
 * instructions, commands, session notes). These match the default scan patterns
 * (`.claude/**\/*.md`), which is fine for your own project but surprising — and a
 * potential privacy leak — when scanning a repo that isn't yours. Returns a
 * warning message, or null when no `.claude/` files were scanned.
 */
export function claudeDirWarning(timeline: Timeline): string | null {
  const count = timeline.events.filter(
    (e) => e.source === 'file' && e.path !== undefined && e.path.startsWith('.claude/'),
  ).length
  if (count === 0) return null
  return (
    `Scanned ${count} file(s) under .claude/ (agent config/notes). ` +
    `If this repo isn't yours, exclude them with scan.excludes = ['.claude/**'] ` +
    `or set scan.includeFiles = false in buildstory.toml.`
  )
}
