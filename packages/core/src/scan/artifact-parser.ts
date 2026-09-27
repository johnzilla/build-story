import { extractExcerpts } from './evidence.js'
import type { SourceExcerpt } from '../types/evidence.js'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import { visit } from 'unist-util-visit'
import matter from 'gray-matter'
import type { Root, Heading, Link, Text } from 'mdast'
import type { ArtifactSource } from '../types/source.js'

const GSTACK_FILENAMES = new Set([
  'PLANNING.md',
  'ARCHITECTURE.md',
  'DECISIONS.md',
  'ROADMAP.md',
  'STATUS.md',
  'CHANGELOG.md',
])


const GSD_FILENAMES = new Set(['TASKS.md', 'TODO.md', 'SESSION_LOG.md', 'BLOCKERS.md'])

const GSTACK_PATH_SEGMENTS = ['.gstack/']
const GSD_PATH_SEGMENTS = ['.gsd/', '.planning/', '.claude/']

const DATA_FRONTMATTER_LANGUAGES = new Set(['', 'yaml', 'yml', 'json'])

function parseMetadata(content: string): Record<string, unknown> {
  // Match gray-matter's BOM normalization before checking the opening fence.
  // Its default engines include JavaScript evaluation, so repository text must
  // never be allowed to select an arbitrary engine.
  const normalized = content.replace(/^\uFEFF/, '')
  const opening = /^---([^\r\n]*)\r?\n/.exec(normalized)
  if (!opening || !DATA_FRONTMATTER_LANGUAGES.has(opening[1]!.trim())) return {}

  try {
    const parsed = matter(normalized, {
      engines: {
        javascript: () => {
          throw new Error('Executable frontmatter is not supported')
        },
      },
    })
    return parsed.data as Record<string, unknown>
  } catch {
    // Malformed or unsupported frontmatter contributes no metadata.
    return {}
  }
}

export function classifyArtifact(
  relativePath: string,
): 'gstack' | 'gsd' | 'generic' {
  const basename = relativePath.split('/').pop() ?? relativePath

  // 1. File extension (most specific)
  if (basename.endsWith('.gstack')) return 'gstack'
  if (basename.endsWith('.gsd')) return 'gsd'

  // 2. GStack canonical filenames — ROADMAP.md is GStack even inside .planning/
  if (GSTACK_FILENAMES.has(basename)) return 'gstack'

  // 3. GSD canonical filenames
  if (GSD_FILENAMES.has(basename)) return 'gsd'

  // 4. Path segments — .gstack/ directory means GStack, .planning/ means GSD
  for (const seg of GSTACK_PATH_SEGMENTS) {
    if (relativePath.includes(seg)) return 'gstack'
  }
  for (const seg of GSD_PATH_SEGMENTS) {
    if (relativePath.includes(seg)) return 'gsd'
  }

  return 'generic'
}

function extractHeadingText(node: Heading): string {
  const texts: string[] = []
  visit(node, 'text', (child: Text) => {
    texts.push(child.value)
  })
  return texts.join('')
}

function buildSummary(tree: Root): string {
  const lines: string[] = []
  visit(tree, 'heading', (node: Heading) => {
    const depth = node.depth
    const prefix = '#'.repeat(depth)
    const indent = '  '.repeat(depth - 1)
    const text = extractHeadingText(node)
    lines.push(`${indent}${prefix} ${text}`)
  })
  return lines.join('\n')
}

function parseMarkdown(content: string): Root {
  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml', 'toml'])
  return processor.parse(content) as Root
}

export async function extractCrossRefs(
  content: string,
  relativePath: string,
  source: ArtifactSource,
  allPaths: Set<string>,
): Promise<string[]> {
  const tree = parseMarkdown(content)
  const seen = new Set<string>()
  const refs: string[] = []

  visit(tree, 'link', (node: Link) => {
    const url = node.url
    // Skip external, anchor-only, and mailto links
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('#') ||
      url.startsWith('mailto:')
    ) {
      return
    }

    let resolved: string | null = null
    if (source.resolveRef) {
      resolved = source.resolveRef(relativePath, url)
    } else {
      // Fall back to raw URL, strip leading ./
      resolved = url.startsWith('./') ? url.slice(2) : url
    }

    // Only include cross-refs that resolve to known files in the scanned set
    if (resolved !== null && !seen.has(resolved) && (allPaths.size === 0 || allPaths.has(resolved))) {
      seen.add(resolved)
      refs.push(resolved)
    }
  })

  return refs
}

export interface ParsedArtifact {
  excerpts: SourceExcerpt[]
  summary: string
  rawContent: string
  metadata: Record<string, unknown>
  crossRefs: string[]
}

export async function parseArtifact(
  content: string,
  relativePath: string,
  source: ArtifactSource,
  allPaths: Set<string>,
): Promise<ParsedArtifact> {
  const tree = parseMarkdown(content)
  const summary = buildSummary(tree)
  const metadata = parseMetadata(content)
  const crossRefs = await extractCrossRefs(content, relativePath, source, allPaths)

  return {
    summary,
    excerpts: extractExcerpts(content),
    rawContent: content,
    metadata,
    crossRefs,
  }
}
