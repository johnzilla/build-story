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
  commits?: import('../types/git-source.js').CommitRecord[]
}): GitSource {
  const base: GitSource = {
    getFileDate: vi.fn().mockImplementation(async (path: string) => {
      return opts?.fileDates?.[path] ?? null
    }),
    getTags: vi.fn().mockResolvedValue(opts?.tags ?? []),
  }
  // Only expose getCommits when commits are provided, so tests that don't opt
  // in mirror a GitSource without commit support (backward compat).
  if (opts?.commits) {
    base.getCommits = vi.fn().mockResolvedValue(opts.commits)
  }
  return base
}

function makeCommit(
  overrides?: Partial<import('../types/git-source.js').CommitRecord>,
): import('../types/git-source.js').CommitRecord {
  return {
    hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
    date: '2026-02-01T10:00:00Z',
    author: 'John Turner',
    subject: 'feat: something',
    body: '',
    files: [{ path: 'src/foo.ts', insertions: 10, deletions: 2 }],
    insertions: 10,
    deletions: 2,
    ...overrides,
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

  it('does not collect commit events when the GitSource lacks getCommits', async () => {
    const source = makeMockSource({ 'PLANNING.md': PLANNING_CONTENT })
    const gitSource = makeGitSource({ fileDates: { 'PLANNING.md': '2026-01-10T08:00:00Z' } })
    const result = await scan(source, { rootDir: '/project' }, gitSource)
    expect(result.events.some((e) => e.source === 'git-commit')).toBe(false)
  })

  it('collects git-commit events when the GitSource supports getCommits', async () => {
    const source = makeMockSource({})
    const gitSource = makeGitSource({ commits: [makeCommit()] })
    const result = await scan(source, { rootDir: '/project' }, gitSource)
    const commitEvents = result.events.filter((e) => e.source === 'git-commit')
    expect(commitEvents).toHaveLength(1)
    expect(commitEvents[0]?.artifactType).toBe('git-commit')
    expect(commitEvents[0]?.summary).toContain('feat: something')
  })

  it('merges commit events with file events into one chronological timeline', async () => {
    const source = makeMockSource({ 'PLANNING.md': PLANNING_CONTENT })
    const gitSource = makeGitSource({
      fileDates: { 'PLANNING.md': '2026-03-01T00:00:00Z' },
      commits: [makeCommit({ date: '2026-01-01T00:00:00Z' })],
    })
    const result = await scan(source, { rootDir: '/project' }, gitSource)
    expect(result.events[0]?.source).toBe('git-commit') // earlier date sorts first
    expect(result.events.some((e) => e.source === 'file')).toBe(true)
  })

  it('respects commits.enabled = false', async () => {
    const source = makeMockSource({})
    const gitSource = makeGitSource({ commits: [makeCommit()] })
    const result = await scan(
      source,
      { rootDir: '/project', commits: { enabled: false } },
      gitSource,
    )
    expect(result.events.some((e) => e.source === 'git-commit')).toBe(false)
  })

  it('respects includeFiles = false (commit-only timeline)', async () => {
    const source = makeMockSource({ 'PLANNING.md': PLANNING_CONTENT })
    const gitSource = makeGitSource({ commits: [makeCommit()] })
    const result = await scan(
      source,
      { rootDir: '/project', includeFiles: false },
      gitSource,
    )
    expect(result.events.some((e) => e.source === 'file')).toBe(false)
    expect(result.events.some((e) => e.source === 'git-commit')).toBe(true)
  })

  it('does not collect transcript events by default (opt-in)', async () => {
    const source = makeMockSource({})
    const gitSource = makeGitSource({ commits: [makeCommit()] })
    const transcriptSource = {
      harness: 'claude-code',
      listSessions: vi.fn().mockResolvedValue([
        {
          id: 's1',
          harness: 'claude-code',
          startedAt: '2026-01-01T00:00:00Z',
          turns: [{ role: 'user', kind: 'message', text: 'do a thing' }],
        },
      ]),
    }
    const result = await scan(source, { rootDir: '/project' }, gitSource, transcriptSource)
    expect(result.events.some((e) => e.source === 'transcript')).toBe(false)
    expect(transcriptSource.listSessions).not.toHaveBeenCalled()
  })

  it('collects transcript events when transcripts.enabled and a source is injected', async () => {
    const source = makeMockSource({})
    const transcriptSource = {
      harness: 'claude-code',
      listSessions: vi.fn().mockResolvedValue([
        {
          id: 's1',
          harness: 'claude-code',
          startedAt: '2026-01-01T00:00:00Z',
          turns: [{ role: 'user', kind: 'message', text: 'do a thing' }],
        },
      ]),
    }
    const result = await scan(
      source,
      { rootDir: '/project', transcripts: { enabled: true } },
      null,
      transcriptSource,
    )
    const tEvents = result.events.filter((e) => e.source === 'transcript')
    expect(tEvents).toHaveLength(1)
    expect(tEvents[0]?.summary).toContain('do a thing')
    expect(transcriptSource.listSessions).toHaveBeenCalledWith({ projectPath: '/project' })
  })

  it('passes commit options through to the GitSource', async () => {
    const source = makeMockSource({})
    const getCommits = vi.fn().mockResolvedValue([makeCommit()])
    const gitSource: GitSource = {
      getFileDate: vi.fn().mockResolvedValue(null),
      getTags: vi.fn().mockResolvedValue([]),
      getCommits,
    }
    await scan(
      source,
      { rootDir: '/project', commits: { max: 50, includeMerges: true, since: '2026-01-01' } },
      gitSource,
    )
    expect(getCommits).toHaveBeenCalledWith({
      max: 50,
      includeMerges: true,
      since: '2026-01-01',
    })
  })
})
