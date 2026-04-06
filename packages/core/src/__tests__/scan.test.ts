import { describe, it, expect, vi } from 'vitest'
import { scan } from '../scan/index.js'
import { TimelineSchema } from '../types/timeline.js'
import type { ArtifactSource } from '../types/source.js'
import type { GitSource } from '../types/git-source.js'
import type { ScanOptions } from '../types/options.js'

const PLANNING_CONTENT = `---
title: Project Plan
date: 2026-01-15
status: active
---

# Project Plan

## Phase 1: Scaffold

Initial setup and scaffolding work.

## Phase 2: Scanner

Implement the artifact scanner.

See [tasks](./TASKS.md) for details.
`

const TASKS_CONTENT = `# Tasks

## Active

- [ ] Implement scanner
- [ ] Write tests

See [planning](./PLANNING.md) for context.
`

const README_CONTENT = `# My Project

A great project.
`

function makeMockSource(files: Record<string, string>): ArtifactSource {
  return {
    readFile: vi.fn().mockImplementation(async (path: string) => {
      const content = files[path]
      if (content === undefined) throw new Error(`File not found: ${path}`)
      return content
    }),
    glob: vi.fn().mockResolvedValue(Object.keys(files)),
    resolveRef: (fromPath: string, ref: string) => {
      // Simple resolver: strip ./ prefix
      const resolved = ref.startsWith('./') ? ref.slice(2) : ref
      return Object.prototype.hasOwnProperty.call(files, resolved) ? resolved : null
    },
    getMtime: vi.fn().mockResolvedValue(null),
  }
}

function makeGitSource(opts?: {
  fileDates?: Record<string, string>
  tags?: Array<{ name: string; date: string; message: string }>
}): GitSource {
  return {
    getFileDate: vi.fn().mockImplementation(async (path: string) => {
      return opts?.fileDates?.[path] ?? null
    }),
    getTags: vi.fn().mockResolvedValue(opts?.tags ?? []),
  }
}

describe('scan()', () => {
  it('returns a valid Timeline that passes TimelineSchema.parse()', async () => {
    const source = makeMockSource({ 'PLANNING.md': PLANNING_CONTENT })
    const options: ScanOptions = { rootDir: '/project' }
    const result = await scan(source, options)
    expect(() => TimelineSchema.parse(result)).not.toThrow()
  })

  it('produces one event per discovered file', async () => {
    const source = makeMockSource({
      'PLANNING.md': PLANNING_CONTENT,
      'TASKS.md': TASKS_CONTENT,
      'README.md': README_CONTENT,
    })
    const options: ScanOptions = { rootDir: '/project' }
    const result = await scan(source, options)
    const fileEvents = result.events.filter((e) => e.source === 'file')
    expect(fileEvents).toHaveLength(3)
  })

  it('classifies artifacts correctly', async () => {
    const source = makeMockSource({
      'PLANNING.md': PLANNING_CONTENT,
      'TASKS.md': TASKS_CONTENT,
      'README.md': README_CONTENT,
    })
    const options: ScanOptions = { rootDir: '/project' }
    const result = await scan(source, options)

    const planning = result.events.find((e) => e.path === 'PLANNING.md')
    const tasks = result.events.find((e) => e.path === 'TASKS.md')
    const readme = result.events.find((e) => e.path === 'README.md')

    expect(planning?.artifactType).toBe('gstack')
    expect(tasks?.artifactType).toBe('gsd')
    expect(readme?.artifactType).toBe('generic')
  })

  it('includes rawContent as the full file content', async () => {
    const source = makeMockSource({ 'PLANNING.md': PLANNING_CONTENT })
    const options: ScanOptions = { rootDir: '/project' }
    const result = await scan(source, options)
    const event = result.events.find((e) => e.path === 'PLANNING.md')
    expect(event?.rawContent).toBe(PLANNING_CONTENT)
  })

  it('includes heading outline in summary', async () => {
    const source = makeMockSource({ 'PLANNING.md': PLANNING_CONTENT })
    const options: ScanOptions = { rootDir: '/project' }
    const result = await scan(source, options)
    const event = result.events.find((e) => e.path === 'PLANNING.md')
    expect(event?.summary).toContain('# Project Plan')
    expect(event?.summary).toContain('## Phase 1: Scaffold')
    expect(event?.summary).toContain('## Phase 2: Scanner')
  })

  it('extracts frontmatter metadata', async () => {
    const source = makeMockSource({ 'PLANNING.md': PLANNING_CONTENT })
    const options: ScanOptions = { rootDir: '/project' }
    const result = await scan(source, options)
    const event = result.events.find((e) => e.path === 'PLANNING.md')
    expect(event?.metadata).toMatchObject({
      title: 'Project Plan',
      status: 'active',
    })
  })

  it('extracts cross-references between known files', async () => {
    const source = makeMockSource({
      'PLANNING.md': PLANNING_CONTENT,
      'TASKS.md': TASKS_CONTENT,
    })
    const options: ScanOptions = { rootDir: '/project' }
    const result = await scan(source, options)

    const planning = result.events.find((e) => e.path === 'PLANNING.md')
    expect(planning?.crossRefs).toContain('TASKS.md')
  })

  it('uses git dates when gitSource is provided (dateConfidence exact)', async () => {
    const source = makeMockSource({ 'PLANNING.md': PLANNING_CONTENT })
    const gitSource = makeGitSource({
      fileDates: { 'PLANNING.md': '2026-01-10T08:00:00Z' },
    })
    const options: ScanOptions = { rootDir: '/project' }
    const result = await scan(source, options, gitSource)
    const event = result.events.find((e) => e.path === 'PLANNING.md')
    expect(event?.date).toBe('2026-01-10T08:00:00Z')
    expect(event?.dateConfidence).toBe('exact')
  })

  it('falls back to mtime when gitSource returns null (dateConfidence estimated)', async () => {
    const mtime = new Date('2026-01-20T12:00:00Z')
    const source: ArtifactSource = {
      readFile: vi.fn().mockResolvedValue(PLANNING_CONTENT),
      glob: vi.fn().mockResolvedValue(['PLANNING.md']),
      getMtime: vi.fn().mockResolvedValue(mtime),
    }
    const gitSource = makeGitSource({ fileDates: {} })
    const options: ScanOptions = { rootDir: '/project' }
    const result = await scan(source, options, gitSource)
    const event = result.events.find((e) => e.path === 'PLANNING.md')
    expect(event?.date).toBe(mtime.toISOString())
    expect(event?.dateConfidence).toBe('estimated')
  })

  it('sets dateConfidence unknown when no git or mtime available', async () => {
    const source = makeMockSource({ 'PLANNING.md': PLANNING_CONTENT })
    const options: ScanOptions = { rootDir: '/project' }
    const result = await scan(source, options, null)
    const event = result.events.find((e) => e.path === 'PLANNING.md')
    expect(event?.dateConfidence).toBe('unknown')
  })

  it('includes git tag events as milestone events when gitSource provided', async () => {
    const source = makeMockSource({})
    const gitSource = makeGitSource({
      tags: [{ name: 'v1.0.0', date: '2026-03-01T00:00:00Z', message: 'First release' }],
    })
    const options: ScanOptions = { rootDir: '/project' }
    const result = await scan(source, options, gitSource)
    const tagEvent = result.events.find((e) => e.source === 'git-tag')
    expect(tagEvent).toBeDefined()
    expect(tagEvent?.artifactType).toBe('git-tag')
  })

  it('returns events sorted chronologically', async () => {
    const source = makeMockSource({
      'PLANNING.md': PLANNING_CONTENT,
      'TASKS.md': TASKS_CONTENT,
    })
    const gitSource = makeGitSource({
      fileDates: {
        'PLANNING.md': '2026-01-15T00:00:00Z',
        'TASKS.md': '2026-01-10T00:00:00Z',
      },
    })
    const options: ScanOptions = { rootDir: '/project' }
    const result = await scan(source, options, gitSource)
    const fileEvents = result.events.filter((e) => e.source === 'file')
    expect(fileEvents[0]?.path).toBe('TASKS.md')
    expect(fileEvents[1]?.path).toBe('PLANNING.md')
  })

  it('scan without gitSource sets all events to unknown confidence', async () => {
    const source = makeMockSource({
      'PLANNING.md': PLANNING_CONTENT,
      'TASKS.md': TASKS_CONTENT,
    })
    const options: ScanOptions = { rootDir: '/project' }
    const result = await scan(source, options)
    const fileEvents = result.events.filter((e) => e.source === 'file')
    expect(fileEvents.every((e) => e.dateConfidence === 'unknown')).toBe(true)
  })

  it('does not include narrative hints or beat assignments in metadata', async () => {
    const source = makeMockSource({ 'PLANNING.md': PLANNING_CONTENT })
    const options: ScanOptions = { rootDir: '/project' }
    const result = await scan(source, options)
    const event = result.events.find((e) => e.path === 'PLANNING.md')
    // Metadata should only have frontmatter data — no beat hints
    const metadataKeys = Object.keys(event?.metadata ?? {})
    expect(metadataKeys).not.toContain('beat')
    expect(metadataKeys).not.toContain('scene')
    expect(metadataKeys).not.toContain('narrativeHint')
  })

  it('returns empty events when source has no files', async () => {
    const source: ArtifactSource = {
      readFile: vi.fn(),
      glob: vi.fn().mockResolvedValue([]),
    }
    const options: ScanOptions = { rootDir: '/project' }
    const result = await scan(source, options)
    expect(result.events).toHaveLength(0)
  })
})
