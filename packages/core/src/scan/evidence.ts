import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { visit } from 'unist-util-visit'
import type { RootContent, Root } from 'mdast'
import { sanitizeOutboundText } from '../privacy/outbound.js'
import type { EvidenceTopic, SourceExcerpt } from '../types/evidence.js'

export const MAX_EXCERPTS = 6
const MAX_TEXT = 400
const TOPICS: Record<EvidenceTopic, RegExp> = {
  problem: /\b(context|problem|challenge|obstacle|blocked|blocker|failure|failed|broken|bug|risk|constraint|slow|bottleneck)\b/i,
  alternative: /\b(alternatives?|options?|considered|compared|tradeoffs?|trade-offs?|versus|instead|rejected)\b/i,
  decision: /\b(decision|decided|choose|chose|chosen|because|rationale|adopted|selected|agreed|reason)\b/i,
  outcome: /\b(outcome|result|consequences?|measured|improved|reduced|passed|verified|validated|resolved|shipped|achieved)\b/i,
}

function plainText(node: RootContent | Root): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value
  if ('children' in node) return node.children.map(child => plainText(child as RootContent)).join('')
  return node.type === 'break' ? ' ' : ''
}

function bounded(text: string, limit: number): string {
  const points = Array.from(text)
  return points.length > limit ? points.slice(0, limit - 1).join('') + '…' : text
}

/** Select across all four topics, so a late outcome isn't crowded out by early problems. */
export function selectExcerpts(candidates: SourceExcerpt[]): SourceExcerpt[] {
  const seen = new Set<string>()
  const unique = candidates.filter(item => {
    if (seen.has(item.text)) return false
    seen.add(item.text)
    return true
  })
  const chosen = new Set<SourceExcerpt>()
  for (const topic of Object.keys(TOPICS) as EvidenceTopic[]) {
    const candidate = unique.find(item => item.topics.includes(topic))
    if (candidate) chosen.add(candidate)
  }
  for (const item of unique) {
    if (chosen.size >= MAX_EXCERPTS) break
    chosen.add(item)
  }
  return unique.filter(item => chosen.has(item))
}

/** Extract prose only. Source text is data; code, HTML, and frontmatter are excluded. */
export function extractExcerpts(content: string): SourceExcerpt[] {
  // Mask rather than remove frontmatter so original line numbers are retained.
  const body = content.replace(/^\uFEFF?(---|\+\+\+)[^\r\n]*\r?\n[\s\S]*?\r?\n\1(?:\r?\n|$)/,
    match => match.replace(/[^\r\n]/g, ' '))
  if (/^\uFEFF?(?:---|\+\+\+)[^\r\n]*\r?\n/.test(content) && body === content) return []
  const tree = unified().use(remarkParse).parse(body) as Root
  const sections: string[] = []
  const candidates: SourceExcerpt[] = []
  visit(tree, node => {
    if (node.type === 'heading') {
      sections.length = node.depth - 1
      sections[node.depth - 1] = sanitizeOutboundText(plainText(node)).trim()
    }
    if (node.type !== 'paragraph' || !node.position) return
    const text = sanitizeOutboundText(plainText(node)).replace(/\s+/g, ' ').trim()
    if (!text) return
    const section = sections.filter(Boolean).join(' / ')
    const topics = (Object.keys(TOPICS) as EvidenceTopic[]).filter(topic => TOPICS[topic].test(`${section}\n${text}`))
    if (!topics.length) return
    candidates.push({
      text: bounded(text, MAX_TEXT), topics,
      ...(section ? { section: bounded(section, 120) } : {}),
      truncated: Array.from(text).length > MAX_TEXT,
      locator: { kind: 'lines', startLine: node.position.start.line, endLine: node.position.end.line },
    })
  })
  return selectExcerpts(candidates)
}
