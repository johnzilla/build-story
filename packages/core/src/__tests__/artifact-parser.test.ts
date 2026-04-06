import { describe, it, expect, vi } from 'vitest'
import { classifyArtifact, parseArtifact, extractCrossRefs } from '../scan/artifact-parser.js'
import type { ArtifactSource } from '../types/source.js'

function makeSource(opts?: {
  resolveRef?: (from: string, ref: string) => string | null
}): ArtifactSource {
  return {
    readFile: vi.fn().mockResolvedValue(''),
    glob: vi.fn().mockResolvedValue([]),
    resolveRef: opts?.resolveRef,
  }
}

const ALL_PATHS = new Set<string>(['other.md', 'docs/guide.md', 'PLANNING.md'])

describe('classifyArtifact()', () => {
  it('classifies PLANNING.md as gstack', () => {
    expect(classifyArtifact('PLANNING.md')).toBe('gstack')
  })

  it('classifies PLAN.md as gstack', () => {
    expect(classifyArtifact('PLAN.md')).toBe('gstack')
  })

  it('classifies ARCHITECTURE.md as gstack', () => {
    expect(classifyArtifact('ARCHITECTURE.md')).toBe('gstack')
  })

  it('classifies DECISIONS.md as gstack', () => {
    expect(classifyArtifact('DECISIONS.md')).toBe('gstack')
  })

  it('classifies ROADMAP.md as gstack', () => {
    expect(classifyArtifact('ROADMAP.md')).toBe('gstack')
  })

  it('classifies STATUS.md as gstack', () => {
    expect(classifyArtifact('STATUS.md')).toBe('gstack')
  })

  it('classifies CHANGELOG.md as gstack', () => {
    expect(classifyArtifact('CHANGELOG.md')).toBe('gstack')
  })

  it('classifies .gstack/ path as gstack', () => {
    expect(classifyArtifact('.gstack/phases/01/PLAN.md')).toBe('gstack')
  })

  it('classifies .gstack extension as gstack', () => {
    expect(classifyArtifact('project.gstack')).toBe('gstack')
  })

  it('classifies TASKS.md as gsd', () => {
    expect(classifyArtifact('TASKS.md')).toBe('gsd')
  })

  it('classifies TODO.md as gsd', () => {
    expect(classifyArtifact('TODO.md')).toBe('gsd')
  })

  it('classifies SESSION_LOG.md as gsd', () => {
    expect(classifyArtifact('SESSION_LOG.md')).toBe('gsd')
  })

  it('classifies BLOCKERS.md as gsd', () => {
    expect(classifyArtifact('BLOCKERS.md')).toBe('gsd')
  })

  it('classifies .planning/ path as gsd', () => {
    expect(classifyArtifact('.planning/phases/01/PLAN.md')).toBe('gsd')
  })

  it('classifies .claude/ path as gsd', () => {
    expect(classifyArtifact('.claude/skills/SKILL.md')).toBe('gsd')
  })

  it('classifies .gsd/ path as gsd', () => {
    expect(classifyArtifact('.gsd/tasks.md')).toBe('gsd')
  })

  it('classifies .gsd extension as gsd', () => {
    expect(classifyArtifact('project.gsd')).toBe('gsd')
  })

  it('classifies docs/guide.md as generic', () => {
    expect(classifyArtifact('docs/guide.md')).toBe('generic')
  })

  it('classifies README.md as generic', () => {
    expect(classifyArtifact('README.md')).toBe('generic')
  })

  it('classifies ADR/0001-use-postgres.md as generic', () => {
    expect(classifyArtifact('ADR/0001-use-postgres.md')).toBe('generic')
  })

  it('classifies unknown file as generic', () => {
    expect(classifyArtifact('some/random/file.md')).toBe('generic')
  })
})

describe('parseArtifact()', () => {
  it('returns rawContent as the full input string', async () => {
    const content = '# Title\n\nSome content here.'
    const source = makeSource()
    const result = await parseArtifact(content, 'PLANNING.md', source, new Set())
    expect(result.rawContent).toBe(content)
  })

  it('extracts heading outline as summary', async () => {
    const content = '# Main Title\n\n## Section One\n\n### Subsection\n\n## Section Two\n'
    const source = makeSource()
    const result = await parseArtifact(content, 'PLANNING.md', source, new Set())
    expect(result.summary).toContain('# Main Title')
    expect(result.summary).toContain('## Section One')
    expect(result.summary).toContain('### Subsection')
    expect(result.summary).toContain('## Section Two')
  })

  it('returns empty summary for content with no headings', async () => {
    const content = 'Just some paragraph text.\nNo headings here.'
    const source = makeSource()
    const result = await parseArtifact(content, 'README.md', source, new Set())
    expect(result.summary).toBe('')
  })

  it('extracts frontmatter metadata via gray-matter', async () => {
    const content = `---
title: My Plan
date: 2026-01-15
status: active
---

# My Plan

Content here.
`
    const source = makeSource()
    const result = await parseArtifact(content, 'PLANNING.md', source, new Set())
    expect(result.metadata).toMatchObject({
      title: 'My Plan',
      date: expect.anything(),
      status: 'active',
    })
  })

  it('returns empty metadata when no frontmatter', async () => {
    const content = '# Title\n\nNo frontmatter.'
    const source = makeSource()
    const result = await parseArtifact(content, 'README.md', source, new Set())
    expect(result.metadata).toEqual({})
  })

  it('returns crossRefs array', async () => {
    const content = '# Title\n\n[link to other](./other.md)\n'
    const source = makeSource()
    const result = await parseArtifact(content, 'PLANNING.md', source, ALL_PATHS)
    expect(Array.isArray(result.crossRefs)).toBe(true)
  })
})

describe('extractCrossRefs()', () => {
  it('finds relative markdown links', async () => {
    const content = '# Title\n\nSee [other file](./other.md) for details.\n'
    const source = makeSource()
    const refs = await extractCrossRefs(content, 'PLANNING.md', source, ALL_PATHS)
    expect(refs).toContain('other.md')
  })

  it('ignores http links', async () => {
    const content = '[external](http://example.com)\n'
    const source = makeSource()
    const refs = await extractCrossRefs(content, 'README.md', source, new Set())
    expect(refs).toHaveLength(0)
  })

  it('ignores https links', async () => {
    const content = '[external](https://example.com)\n'
    const source = makeSource()
    const refs = await extractCrossRefs(content, 'README.md', source, new Set())
    expect(refs).toHaveLength(0)
  })

  it('ignores anchor-only links', async () => {
    const content = '[section](#intro)\n'
    const source = makeSource()
    const refs = await extractCrossRefs(content, 'README.md', source, new Set())
    expect(refs).toHaveLength(0)
  })

  it('ignores mailto links', async () => {
    const content = '[email](mailto:user@example.com)\n'
    const source = makeSource()
    const refs = await extractCrossRefs(content, 'README.md', source, new Set())
    expect(refs).toHaveLength(0)
  })

  it('uses source.resolveRef when available', async () => {
    const content = '[other](./other.md)\n'
    const source = makeSource({
      resolveRef: (_from, ref) => ref.replace('./', ''),
    })
    const refs = await extractCrossRefs(content, 'PLANNING.md', source, ALL_PATHS)
    expect(refs).toContain('other.md')
  })

  it('falls back to raw URL when source.resolveRef is undefined', async () => {
    const content = '[other](./other.md)\n'
    const source = makeSource()
    const refs = await extractCrossRefs(content, 'PLANNING.md', source, ALL_PATHS)
    // Should include the resolved or raw path
    expect(refs.length).toBeGreaterThan(0)
  })

  it('deduplicates cross-references', async () => {
    const content = '[link1](./other.md)\n[link2](./other.md)\n'
    const source = makeSource()
    const refs = await extractCrossRefs(content, 'PLANNING.md', source, ALL_PATHS)
    const count = refs.filter((r) => r === 'other.md' || r === './other.md').length
    expect(count).toBe(1)
  })

  it('returns empty array when no links', async () => {
    const content = '# Title\n\nNo links here.\n'
    const source = makeSource()
    const refs = await extractCrossRefs(content, 'README.md', source, new Set())
    expect(refs).toEqual([])
  })
})
