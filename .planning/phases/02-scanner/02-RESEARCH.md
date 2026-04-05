# Phase 02: Scanner - Research

**Researched:** 2026-04-05
**Domain:** Markdown AST extraction, git history integration, artifact pattern detection, event ID generation, secret redaction
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** One event per file — each markdown artifact produces a single TimelineEvent.
- **D-02:** Full content extraction — rawContent contains the entire file contents.
- **D-03:** Summary as heading hierarchy outline — extract all headings as a nested outline using remark AST.
- **D-04:** Commits + tags only — git log for commit messages/timestamps, git tag for version milestones. No blame, no branch/merge events for v1.
- **D-05:** Git enriches file events, doesn't create separate events — use git log to date files (most recent commit touching each file). Tags become separate milestone-type events.
- **D-06:** dateConfidence mapping — git commit dates → 'exact', file mtime → 'estimated', no date found → 'unknown'.
- **D-07:** No beat hints in scan — scan() produces a clean Timeline with zero narrative concepts.
- **D-08:** Regex pattern matching for secrets — strip API keys (sk-\*, AKIA\*), tokens, passwords in env var assignments, base64 credentials. Replace with [REDACTED].
- **D-09:** Redaction in the ArtifactSource adapter — readFile() returns pre-redacted content. Single enforcement point.
- **D-10:** GStack/GSD artifact patterns as defaults — detect PLANNING.md, ROADMAP.md, DECISIONS.md, TASKS.md, SESSION_LOG.md, .planning/\*\*/\*.md, and generic planning files.
- **D-11:** Configurable include/exclude patterns — ScanOptions.patterns and ScanOptions.excludes override defaults. Default excludes: node_modules, .git, vendor, dist, target.

### Claude's Discretion

- Exact remark plugin chain for heading extraction
- fast-glob configuration for file discovery
- simple-git log format and options
- Cross-reference detection approach (SCAN-09) — how to find links between artifacts
- Error handling for unreadable files or git failures
- Event ID generation strategy (stable across rescans)

### Deferred Ideas (OUT OF SCOPE)

- Git blame per-line dating
- Branch/merge event detection
- Beat pre-classification in scan
- Multi-repo scanning
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCAN-01 | Filesystem walker traverses directories with configurable include/exclude glob patterns | fast-glob 3.3.3 `fg()` with `deep` option and `ignore` array; ArtifactSource.glob() pattern in source.ts |
| SCAN-02 | Detects GStack artifacts (PLANNING.md, PLAN.md, ARCHITECTURE.md, DECISIONS.md, ROADMAP.md, STATUS.md, CHANGELOG.md, *.gstack, .gstack/) | Default pattern list in file-walker module; matched against filename + directory name |
| SCAN-03 | Detects GSD artifacts (TASKS.md, TODO.md, SESSION_LOG.md, BLOCKERS.md, *.gsd, .gsd/) | Same default pattern list alongside GStack patterns |
| SCAN-04 | Detects generic planning artifacts (ADR/ directories, docs/, .claude/, README.md) | Directory-aware patterns in fast-glob include set |
| SCAN-05 | Extracts markdown structure: headings, dates, content summaries, status markers, cross-references | remark-parse to mdast; heading walk for summary; link/wikilink walk for xrefs; checkbox walk for status markers |
| SCAN-06 | Git history integration: commit messages with timestamps (D-04 scope: commits + tags only) | simple-git `log({ file })` per file for dateConfidence='exact'; `tags()` for milestone events |
| SCAN-07 | Produces structured Timeline JSON with events, metadata, and date ranges | Zod-validated TimelineSchema/TimelineEventSchema already defined in types/timeline.ts |
| SCAN-08 | Planning-artifact timeline merges document events with git events by date | Chronological sort after collecting file events + git-tag milestone events |
| SCAN-09 | Cross-reference detection between artifacts via path references and link patterns | mdast link node extraction + relative path normalization; wikilink regex for GStack cross-refs |
| SCAN-10 | User can configure custom artifact patterns via buildstory.toml or ScanOptions | ScanOptions.patterns / ScanOptions.excludes — already in options.ts; CLI reads from config and passes through |
| SCAN-11 | Configurable max directory depth (default: 5) | fast-glob `deep` option accepts integer; ScanOptions.maxDepth wired to it |
| CLI-01 | `buildstory scan <paths>` command outputs timeline.json | New scan.ts command in packages/cli/src/commands/; writes JSON to stdout or --output file |
</phase_requirements>

---

## Summary

Phase 02 replaces the `scan()` stub in `packages/core/src/scan/index.ts` with a real implementation that walks a directory, extracts markdown content and metadata, enriches events with git dates, and merges everything into a chronologically sorted Timeline JSON.

The core implementation decomposes into four focused sub-modules: `file-walker.ts` (fast-glob discovery), `artifact-parser.ts` (remark AST extraction + secret redaction at the source adapter level), `git-reader.ts` (simple-git commit dates and tag milestones), and `timeline-builder.ts` (merge, sort, and validate output). The scan/index.ts orchestrates these; the CLI gains a new `scan` subcommand.

All file I/O routes through the injected `ArtifactSource` interface already defined in Phase 1, keeping `@buildstory/core` free of direct `fs` imports. Secret redaction lives in the CLI's `createFsSource()` factory — `readFile()` applies regex substitution before returning content to core.

**Primary recommendation:** Implement as four sub-modules under `packages/core/src/scan/`. The file-walker uses fast-glob through ArtifactSource.glob(). The artifact-parser uses remark-parse with a heading-visitor for summaries and a link-visitor for cross-references. The git-reader uses simple-git with `--max-count` bounded log calls. The CLI adds a `scan.ts` command that writes timeline.json.

---

## Standard Stack

### Core (all already in project or confirmed available)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| remark-parse | 11.0.0 | Markdown → mdast AST | Unified ecosystem standard for extraction; exposes full syntax tree with heading hierarchy [VERIFIED: npm registry] |
| unified | 11.0.5 | Processor engine for remark-parse | Peer dep of remark-parse; drives the parse pipeline [VERIFIED: npm registry via `npm view unified version`] |
| remark | 15.0.1 | Higher-level remark processor | Optional convenience wrapper; can use unified directly with remark-parse [VERIFIED: npm registry] |
| remark-frontmatter | 5.0.0 | YAML frontmatter support | Planning artifacts like ADRs use frontmatter for date/status metadata [VERIFIED: npm registry] |
| gray-matter | 4.0.3 | Fast frontmatter-only extraction | Use as pre-parse step to extract date/author metadata without full AST [VERIFIED: npm registry] |
| simple-git | 3.33.0 | Git history extraction | Most-downloaded Node.js git wrapper; bundled TS types; log/tags/show API [VERIFIED: npm registry] |
| fast-glob | 3.3.3 | Pattern-based file discovery | Fastest glob on deep trees; TypeScript bundled; `deep` + `ignore` options [VERIFIED: npm registry] |
| zod | 4.3.6 | Schema validation at boundaries | Already a core dep; validate Timeline output before returning [VERIFIED: package.json] |

> None of these are in `@buildstory/core/package.json` yet — they need to be added as dependencies.

### Installation

```bash
pnpm add --filter @buildstory/core remark@^15 remark-parse@^11 remark-frontmatter@^5 unified@^11 gray-matter@^4 simple-git@^3 fast-glob@^3
```

**Version verification (run 2026-04-05):**
- `remark` → 15.0.1 [VERIFIED: npm registry]
- `remark-parse` → 11.0.0 [VERIFIED: npm registry]
- `remark-frontmatter` → 5.0.0 [VERIFIED: npm registry]
- `unified` → 11.0.5 [VERIFIED: npm registry]
- `simple-git` → 3.33.0 [VERIFIED: npm registry]
- `fast-glob` → 3.3.3 [VERIFIED: npm registry]
- `gray-matter` → 4.0.3 [VERIFIED: npm registry]

---

## Architecture Patterns

### Recommended File Structure for Scan Module

```
packages/core/src/scan/
├── index.ts              # scan() orchestrator — replaces stub
├── file-walker.ts        # fast-glob via ArtifactSource.glob()
├── artifact-parser.ts    # remark AST heading/link/status extraction
├── git-reader.ts         # simple-git commit dates + tags
└── timeline-builder.ts   # merge, sort, validate Timeline output

packages/cli/src/commands/
└── scan.ts               # buildstory scan <path> command (CLI-01)
```

### Pattern 1: Heading Hierarchy Outline (D-03)

**What:** Walk mdast nodes to extract all `heading` nodes into a nested outline string. This is the `summary` field on every file TimelineEvent.

**When to use:** Always — all file events get a summary from this function.

**Approach:**
```typescript
// Source: unified/remark mdast heading node structure
// packages/core/src/scan/artifact-parser.ts
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import type { Root, Heading } from 'mdast'

function extractHeadingOutline(content: string): string {
  const tree = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml', 'toml'])
    .parse(content) as Root

  const lines: string[] = []
  for (const node of tree.children) {
    if (node.type === 'heading') {
      const h = node as Heading
      const indent = '  '.repeat(h.depth - 1)
      const text = h.children
        .filter((c) => c.type === 'text' || c.type === 'inlineCode')
        .map((c) => ('value' in c ? c.value : ''))
        .join('')
      lines.push(`${indent}${'#'.repeat(h.depth)} ${text}`)
    }
  }
  return lines.join('\n')
}
```

The mdast `Heading` node has: `depth: 1-6`, `children: PhrasingContent[]`. Text content is in `text` nodes and `inlineCode` nodes. [VERIFIED: unified.js mdast spec — Heading interface]

### Pattern 2: Cross-Reference Detection (SCAN-09, Claude's Discretion)

**What:** Find links between artifacts by extracting markdown link nodes from the AST and checking whether they resolve to other scanned artifacts.

**Recommended approach — two-pass strategy:**

1. First pass: collect all artifact paths into a `Set<string>`.
2. Second pass: for each file's parsed AST, visit all `link` nodes (`node.type === 'link'`) and extract `node.url`. If the URL is a relative path (no `http://`, no `#`) and normalizes to a path in the artifact set, record it as a cross-reference.

```typescript
// packages/core/src/scan/artifact-parser.ts
import { visit } from 'unist-util-visit'  // part of unified ecosystem

function extractCrossReferences(
  tree: Root,
  filePath: string,
  allPaths: Set<string>,
  rootDir: string,
): string[] {
  const refs: string[] = []
  visit(tree, 'link', (node) => {
    const url: string = node.url
    if (url.startsWith('http') || url.startsWith('#') || url.startsWith('mailto:')) return
    // Resolve relative to file's directory
    const resolved = path.resolve(path.dirname(path.join(rootDir, filePath)), url)
    const relative = path.relative(rootDir, resolved)
    if (allPaths.has(relative) || allPaths.has(relative + '.md')) {
      refs.push(relative)
    }
  })
  return refs
}
```

> Note: `path` cannot be imported directly in core (ESLint rule bans `path`). Cross-reference resolution that requires path manipulation must either: (a) pass pre-resolved paths from the CLI layer, or (b) use a simple string-splitting approach without `path`. See Pitfalls section.

**Alternative for wikilinks:** GStack artifacts sometimes use `[[Title]]` style links. These can be detected with a regex walk on text nodes: `/\[\[([^\]]+)\]\]/g`. [ASSUMED — based on GStack convention knowledge; verify against actual artifact samples]

### Pattern 3: simple-git Per-File Commit Date (D-05, D-06)

**What:** Get the most recent commit that touched each scanned file to set `date` and `dateConfidence: 'exact'`.

**API pattern:**
```typescript
// packages/core/src/scan/git-reader.ts
// NOTE: simple-git must NOT be imported inside @buildstory/core.
// Git operations access the filesystem. They MUST live in the CLI adapter or
// be invoked via a GitSource interface injected from CLI. See Architecture Note below.
import simpleGit from 'simple-git'

// CLI-side git adapter (packages/cli/src/git-source.ts)
export function createGitSource(rootDir: string) {
  const git = simpleGit(rootDir, { maxConcurrentProcesses: 4 })
  return {
    async getFileCommitDate(filePath: string): Promise<string | null> {
      try {
        const log = await git.log({
          file: filePath,
          '--max-count': '1',
          format: { hash: '%H', date: '%aI', message: '%s' },
        })
        return log.latest?.date ?? null
      } catch {
        return null
      }
    },
    async getTags(): Promise<Array<{ name: string; date: string; hash: string }>> {
      // git tag -l --sort=-version:refname --format='%(refname:short)|%(creatordate:iso-strict)|%(objectname:short)'
      // simple-git doesn't have a direct tags-with-dates API — use raw() or show()
      const raw = await git.raw([
        'tag', '-l',
        '--sort=-version:refname',
        '--format=%(refname:short)|%(creatordate:iso-strict)|%(objectname:short)',
      ])
      return raw.split('\n')
        .filter(Boolean)
        .map((line) => {
          const [name, date, hash] = line.split('|')
          return { name: name ?? '', date: date ?? '', hash: hash ?? '' }
        })
    },
  }
}
```

> **Architecture Note:** `simple-git` calls the filesystem and spawns git processes. This violates the core package boundary rule (no `fs`, no `process`). The correct pattern is to define a `GitSource` interface in `@buildstory/core/types/` (analogous to `ArtifactSource`) and inject a concrete implementation from the CLI. The scan function signature becomes:
>
> `scan(source: ArtifactSource, gitSource: GitSource | null, options: ScanOptions): Promise<Timeline>`
>
> Or alternatively, pass git metadata as pre-fetched data via `ScanOptions.gitMeta`. The first approach (injected interface) is cleaner and maintains testability.

[VERIFIED: simple-git API — `git.log({ file, '--max-count' })` and `git.raw()` usage]
[ASSUMED: GitSource interface pattern — this is an architectural decision not yet in the codebase]

### Pattern 4: Event ID Generation (Claude's Discretion)

**What:** Generate stable IDs for TimelineEvents that remain the same across repeated scans of the same artifacts.

**Recommended strategy:** Content-hash ID using a deterministic hash of `(path + date + source)`.

```typescript
// packages/core/src/scan/timeline-builder.ts
function generateEventId(source: 'file' | 'git-commit' | 'git-tag', path: string, date: string): string {
  // Stable: same file at same commit date → same ID
  // Simple hash: no crypto dependency needed — use a short deterministic string
  const input = `${source}:${path}:${date}`
  // djb2 hash — no Node crypto needed, no fs import
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i)
    hash = hash >>> 0  // force unsigned 32-bit
  }
  const prefix = source === 'file' ? 'file' : source === 'git-tag' ? 'tag' : 'commit'
  return `${prefix}-${hash.toString(16).padStart(8, '0')}`
}
```

This avoids importing `crypto` (which would require `node:crypto` and trigger the restricted-globals ESLint check if not handled carefully). djb2 is deterministic, fast, and produces stable 8-char hex IDs. [ASSUMED — the approach is sound but the specific hash algo is Claude's discretion]

Alternative: use a simple deterministic string concatenation + base64-safe encoding without any crypto. The ID just needs to be stable and unique within a timeline, not cryptographically strong.

### Pattern 5: Secret Redaction in ArtifactSource (D-08, D-09)

**What:** Regex substitution applied inside the CLI's `createFsSource()` readFile implementation, before content reaches core.

**Recommended regex patterns:**

```typescript
// packages/cli/src/commands/scan.ts (or a shared redact.ts in CLI)
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  // OpenAI API keys
  [/sk-[A-Za-z0-9\-_]{20,}/g, '[REDACTED]'],
  // Anthropic API keys
  [/sk-ant-[A-Za-z0-9\-_]{20,}/g, '[REDACTED]'],
  // AWS Access Key IDs
  [/AKIA[0-9A-Z]{16}/g, '[REDACTED]'],
  // AWS Secret Access Keys (common format in .env files)
  [/(AWS_SECRET_ACCESS_KEY\s*=\s*)[^\s'"]+/gi, '$1[REDACTED]'],
  // Generic env var assignments with "secret", "key", "token", "password"
  [/((?:secret|api_key|token|password|passwd|pwd)\s*[=:]\s*["']?)[^\s"']+/gi, '$1[REDACTED]'],
  // Bearer tokens in Authorization headers
  [/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, '$1[REDACTED]'],
  // Base64 credentials (long base64 strings in auth contexts)
  [/(Basic\s+)[A-Za-z0-9+/]{20,}={0,2}/gi, '$1[REDACTED]'],
  // GitHub Personal Access Tokens
  [/ghp_[A-Za-z0-9]{36}/g, '[REDACTED]'],
  [/github_pat_[A-Za-z0-9_]{82}/g, '[REDACTED]'],
]

function redactSecrets(content: string): string {
  let redacted = content
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, replacement)
  }
  return redacted
}

// Applied in createFsSource():
function createFsSource(): ArtifactSource {
  return {
    readFile: async (path: string) => {
      const raw = await readFile(path, 'utf8')
      return redactSecrets(raw)
    },
    glob: async (patterns, options) => fg(patterns, { cwd: options?.cwd, ignore: options?.ignore }),
  }
}
```

[ASSUMED — the specific regex patterns above are informed by common credential formats but have not been tested against a corpus of planning artifacts. Adjust based on actual project needs.]

### Pattern 6: fast-glob via ArtifactSource.glob()

**What:** The glob method on ArtifactSource is called with include patterns and an `ignore` option. The CLI's ArtifactSource implementation uses `fast-glob`.

**Default include patterns (D-10):**

```typescript
// packages/core/src/scan/file-walker.ts
export const DEFAULT_PATTERNS = [
  // GStack artifacts
  'PLANNING.md', 'PLAN.md', 'ARCHITECTURE.md', 'DECISIONS.md',
  'ROADMAP.md', 'STATUS.md', 'CHANGELOG.md',
  '*.gstack', '.gstack/**/*.md',
  // GSD artifacts
  'TASKS.md', 'TODO.md', 'SESSION_LOG.md', 'BLOCKERS.md',
  '*.gsd', '.gsd/**/*.md',
  // GSD planning dir
  '.planning/**/*.md',
  '.claude/**/*.md',
  // Generic planning artifacts
  'ADR/**/*.md', 'adr/**/*.md',
  'docs/**/*.md',
  'README.md',
]

export const DEFAULT_EXCLUDES = [
  'node_modules/**',
  '.git/**',
  'vendor/**',
  'dist/**',
  'target/**',
  'build/**',
  '.turbo/**',
]
```

**fast-glob call pattern (inside CLI ArtifactSource.glob implementation):**

```typescript
import fg from 'fast-glob'

glob: async (patterns, options) => {
  return fg(patterns, {
    cwd: options?.cwd,
    ignore: options?.ignore ?? [],
    deep: 5,  // ScanOptions.maxDepth default — pass through from scan
    onlyFiles: true,
    dot: true,  // needed for .planning/, .gstack/, .claude/ directories
    followSymbolicLinks: false,
  })
}
```

[VERIFIED: fast-glob options API — `deep`, `ignore`, `dot`, `onlyFiles` are standard fg options]

### Pattern 7: dateConfidence Fallback Chain (D-06)

**What:** Determine event date and confidence level per file.

**Decision tree:**
1. Git commit found for file → `date = commit.date`, `dateConfidence = 'exact'`
2. No git (or file not in git) + file stat available → `date = mtime.toISOString()`, `dateConfidence = 'estimated'`
3. Nothing available → `date = scannedAt`, `dateConfidence = 'unknown'`

> Note: File mtime access requires `fs.stat()` — this cannot be done in core. The CLI's ArtifactSource can be extended with an optional `statFile(path): Promise<{ mtime: Date } | null>` method. Or: pass mtime data as part of the glob results (not standard). Simplest approach: extend ArtifactSource with optional `getMtime?: (path: string) => Promise<Date | null>`.

[ASSUMED — the exact ArtifactSource extension for mtime is Claude's discretion]

### Anti-Patterns to Avoid

- **Importing `path` or `fs` in core:** ESLint rule will fail the build. All path manipulation in core must use pure string operations (split on '/', join with '/'). Do not use `path.resolve` or `path.join` inside `packages/core/`.
- **Importing `simple-git` in core:** Same boundary — git is filesystem access. Use an injected GitSource interface or pass pre-fetched metadata.
- **Unbounded git log:** Never call `git.log()` without `--max-count`. On repos with thousands of commits this will buffer-overflow or take minutes.
- **Parsing all markdown with full AST when only frontmatter is needed:** Use `gray-matter` for the cheap pre-parse; only invoke the full remark pipeline for files that pass the artifact detection filter.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown to AST | Custom regex parser | remark-parse + unified | Regex breaks on nested structures, code blocks, escaped chars |
| File glob with ignore | Manual `readdir` recursion | fast-glob | Handles symlinks, depth limits, ignore patterns, cross-platform globs |
| Git log parsing | Regex on `git log` stdout | simple-git | Handles multi-line commit messages, encoding, error paths |
| YAML frontmatter | Custom YAML parser | gray-matter | Edge cases in YAML (multiline, special chars) are numerous |
| AST node visitor | Manual `for` loop over children | `unist-util-visit` | Handles deep traversal, node type filtering, skip/continue |

**Key insight:** Every one of these "simple" parsers has been rewritten dozens of times. The ecosystem solutions handle the long tail of edge cases (emoji in headings, nested blockquotes, empty frontmatter, detached HEADs in git).

---

## Common Pitfalls

### Pitfall 1: `path` Module Banned in Core — Cross-Reference Resolution Breaks

**What goes wrong:** SCAN-09 requires resolving `./other-file.md` relative paths to check if they point to other scanned artifacts. This naturally reaches for `path.resolve()` and `path.relative()`. But `path` is banned in core by ESLint.

**Why it happens:** The cross-reference logic feels like core business logic but requires filesystem path resolution.

**How to avoid:** Two options:
1. Pass an additional `resolveRef(fromPath: string, refUrl: string): string` function as part of ArtifactSource — the CLI implementation uses `path.resolve()`.
2. Normalize cross-references as raw URL strings in the `metadata` field and let the CLI post-process them into resolved paths.

Option 1 is cleaner — it keeps all path logic in CLI and all extraction logic in core.

**Warning signs:** `import { resolve } from 'path'` or `import { resolve } from 'node:path'` appearing in any file under `packages/core/src/`.

### Pitfall 2: simple-git Cannot Live in Core

**What goes wrong:** The scan implementation imports `simple-git` inside `@buildstory/core` to get commit dates. This violates the core boundary (git spawns child processes, accesses the filesystem, reads env vars).

**Why it happens:** Git reading feels like "scan logic" and gets colocated with the scanner.

**How to avoid:** Define a minimal `GitSource` interface in `packages/core/src/types/`:
```typescript
export interface GitSource {
  getFileCommitDate(path: string): Promise<string | null>
  getTags(): Promise<Array<{ name: string; date: string; message: string }>>
}
```
Pass `GitSource | null` to `scan()`. When null (no git), all dates fall back to `dateConfidence: 'estimated'` from mtime or `'unknown'`.

**Warning signs:** `import simpleGit` in any file under `packages/core/src/`.

### Pitfall 3: ESM-Only remark Ecosystem in NodeNext Resolution

**What goes wrong:** remark, unified, remark-parse, unist-util-visit are all ESM-only packages. With `"moduleResolution": "NodeNext"` (the project's tsconfig), TypeScript requires `.js` extensions on all imports. When tsup bundles the output as ESM (already configured), this works — but if CJS output is ever added, dynamic `import()` is required.

**Why it happens:** Already documented in STACK.md — developers reach for `require()` on these packages.

**How to avoid:** Core stays ESM-only (already configured: `"type": "module"` in package.json). All remark imports use static `import`. The `remark-frontmatter` package also requires `type: 'yaml'` to be specified explicitly. [VERIFIED: STACK.md critical ESM note]

### Pitfall 4: remark-frontmatter Must Be Configured, Not Just Added

**What goes wrong:** `use(remarkFrontmatter)` without options throws or silently skips frontmatter on TOML blocks. Planning artifacts may use YAML or TOML frontmatter.

**How to avoid:**
```typescript
// Always specify the delimiter types explicitly
unified().use(remarkParse).use(remarkFrontmatter, ['yaml', 'toml'])
```
[VERIFIED: remark-frontmatter README — options array is required for non-default delimiters]

### Pitfall 5: Git Not Available in All Scan Targets

**What goes wrong:** `buildstory scan ./some-dir` where the directory is not a git repo (or git is not installed) throws an unhandled error inside simple-git.

**How to avoid:** Wrap all GitSource calls in try/catch. When git is unavailable, log a debug-level warning and proceed with `dateConfidence: 'estimated'` or `'unknown'`. The scan output should be valid even without git.

**Warning signs:** Uncaught `git.log()` rejection crashing the scan on non-git directories.

### Pitfall 6: Timeline dateRange Computed Incorrectly with Mixed Confidence Levels

**What goes wrong:** `dateRange.start` and `dateRange.end` in the Timeline are set to the first/last event dates. If some events have `dateConfidence: 'unknown'` and use `scannedAt` as their date, the range is artificially compressed to the scan date for those events.

**How to avoid:** Compute `dateRange` only from events with `dateConfidence` of `'exact'` or `'estimated'`. If no events have a real date, set both to empty string (matching the existing stub behavior).

### Pitfall 7: Regex Secret Redaction Causes False Positives in Code Examples

**What goes wrong:** A planning doc contains `sk-example-key-1234` as a documentation placeholder. The redaction regex replaces it, making the document appear to discuss a real API key when it was just an example.

**Why it happens:** Regex cannot distinguish example keys from real keys by structure alone.

**How to avoid:** Accept this trade-off in v1 — over-redaction is safer than under-redaction. Document the known false-positive behavior. [ASSUMED — this is a product decision; no technical solution eliminates the ambiguity]

---

## Code Examples

### Minimal remark AST Heading Walk

```typescript
// Source: unified.js mdast spec (https://github.com/syntax-tree/mdast#heading)
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'

const tree = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml', 'toml'])
  .parse(markdownContent)

// tree.children is an array of Block nodes
// Heading nodes: { type: 'heading', depth: 1-6, children: PhrasingContent[] }
```

### simple-git Log with File and Max-Count Bound

```typescript
// Source: simple-git README (https://github.com/steveukx/git-js)
import simpleGit from 'simple-git'

const git = simpleGit(rootDir)

// Get the single most recent commit touching a specific file
const log = await git.log({
  file: 'relative/path/to/file.md',
  '--max-count': '1',
})
// log.latest?.date is ISO 8601 string or undefined if file has no git history
```

### simple-git Tags with Date Metadata

```typescript
// Source: simple-git README — git.raw() for commands without a direct binding
const raw = await git.raw([
  'tag', '-l',
  '--sort=-version:refname',
  '--format=%(refname:short)|%(creatordate:iso-strict)|%(objectname:short)',
])
// Parse pipe-delimited output
```

### fast-glob via ArtifactSource Contract

```typescript
// Source: fast-glob README (https://github.com/mrmlnc/fast-glob)
import fg from 'fast-glob'

// ArtifactSource.glob() implementation in CLI
const paths = await fg(patterns, {
  cwd: rootDir,
  ignore: excludePatterns,
  deep: maxDepth,       // integer; default 5
  onlyFiles: true,
  dot: true,            // critical — .planning/, .gstack/, .claude/ are dotdirs
  followSymbolicLinks: false,
})
```

### unist-util-visit for Link Extraction

```typescript
// Source: unist-util-visit README (https://github.com/syntax-tree/unist-util-visit)
import { visit } from 'unist-util-visit'

visit(tree, 'link', (node) => {
  // node.url: string — the href
  // node.children: PhrasingContent[] — the link text
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `remark-parse` v9 with CJS | remark-parse v11, ESM-only | remark v14+ (2022) | Must configure tsup/Node for ESM [VERIFIED: STACK.md] |
| `isomorphic-git` for Node CLI tools | `simple-git` | Ongoing community consensus | simple-git 6.4M vs isomorphic-git 628K weekly downloads [VERIFIED: STACK.md] |
| Synchronous `readFileSync` in core | Async ArtifactSource injection | Phase 1 architectural decision | Enables testability without filesystem [VERIFIED: codebase] |

---

## Architecture Note: GitSource Interface (New Type Needed)

The current type system has `ArtifactSource` for file I/O but nothing for git. Phase 02 needs to either:

**Option A (Recommended):** Add a `GitSource` interface to `packages/core/src/types/`:
```typescript
export interface GitSource {
  getFileDate(relativePath: string): Promise<string | null>
  getTags(): Promise<Array<{ name: string; date: string; message: string }>>
}
```
Update `scan()` signature: `scan(source: ArtifactSource, options: ScanOptions, gitSource?: GitSource): Promise<Timeline>`

**Option B:** Pre-fetch all git metadata in CLI and pass as `ScanOptions.gitMeta`:
```typescript
// ScanOptions extension
gitMeta?: {
  fileDates: Record<string, string>  // path → ISO date string
  tags: Array<{ name: string; date: string; message: string }>
}
```

Option A is cleaner because it's lazy (only fetches what scan() needs) and mirrors the ArtifactSource pattern. Option B avoids changing the scan() signature but requires the CLI to pre-walk all files before scan() does.

The planner should choose one and specify it explicitly. Both are valid; the decision affects the scan() function signature, which is a public API contract.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GitSource as injected interface is the right boundary (vs. pre-fetched gitMeta in ScanOptions) | Architecture Note | Wrong choice adds awkwardness to scan() API; correctable in Phase 2 if decided early |
| A2 | Wikilink `[[Title]]` patterns are used in GStack artifacts | Pattern 2 (xrefs) | If not used, no harm — just dead code in xref extractor |
| A3 | djb2 hash for event ID generation is stable and collision-resistant enough for 10-50 events | Pattern 4 | Very low risk — collision probability at 50 events with 32-bit hash is ~0.03% |
| A4 | Secret redaction regex patterns cover the formats used in planning artifacts | Pattern 5 | Under-redaction risk: credentials leak into timeline.json. Over-redaction: false positives in docs |
| A5 | ArtifactSource.glob() `dot: true` is set in CLI implementation (not controlled by core) | Pattern 6 | If dot is false, .planning/, .gstack/, .claude/ directories are invisible to scanner |
| A6 | `unist-util-visit` is part of the unified ecosystem and ESM-only | Don't Hand-Roll | If it has CJS output, no problem; if not, same ESM constraint as remark |

---

## Open Questions

1. **GitSource interface vs. pre-fetched gitMeta in ScanOptions**
   - What we know: Both approaches work; Option A is cleaner
   - What's unclear: Whether the scan() signature should change or ScanOptions should grow
   - Recommendation: Planner should decide and document as a task in Wave 0. Default to Option A (GitSource interface).

2. **mtime access for dateConfidence 'estimated'**
   - What we know: mtime requires `fs.stat()` which can't live in core
   - What's unclear: Whether ArtifactSource should grow a `getMtime?` method or whether 'estimated' falls back to 'unknown' when git is absent
   - Recommendation: Add optional `getMtime?: (path: string) => Promise<Date | null>` to ArtifactSource. CLI provides it; tests can inject a mock.

3. **rawContent field in TimelineEvent**
   - What we know: D-02 requires rawContent = entire file. TimelineEventSchema (in timeline.ts) does NOT currently have a `rawContent` field.
   - What's unclear: Is rawContent in `metadata` as a free-form field, or should `TimelineEventSchema` gain a typed `rawContent: z.string()` field?
   - Recommendation: Add `rawContent: z.string()` to `TimelineEventSchema` explicitly — typed fields are better than untyped metadata values. This is a schema change from Phase 1, needs coordination.

4. **artifactType field in TimelineEvent**
   - What we know: SCAN-02/03/04 require GStack vs. GSD vs. generic classification. TimelineEventSchema has `metadata: z.record(...)` but no typed `artifactType` field.
   - What's unclear: Whether artifact type goes in `metadata` or as a typed discriminated field.
   - Recommendation: Add `artifactType: z.enum(['gstack', 'gsd', 'generic', 'git-tag']).optional()` to `TimelineEventSchema`. Typed field is better for downstream consumers (narrate phase).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js 22 LTS | Runtime | Yes | v22.22.0 | — |
| git CLI | simple-git (in CLI layer) | Yes | 2.53.0 | Scan proceeds without git; dateConfidence='unknown' |
| pnpm | Package management | Yes (assumed from Phase 1) | — | — |
| remark-parse 11 (npm) | Markdown parsing | Not yet installed | 11.0.0 available | — |
| simple-git 3 (npm) | Git integration (CLI layer) | Not yet installed | 3.33.0 available | — |
| fast-glob 3 (npm) | File discovery (CLI layer) | Not yet installed | 3.3.3 available | — |

**Missing dependencies with no fallback:**
- None — all required packages are available on npm and git is installed on the host.

**Missing dependencies to be installed (Wave 0 task):**
- `remark`, `remark-parse`, `remark-frontmatter`, `unified`, `gray-matter`, `unist-util-visit` → add to `@buildstory/core`
- `simple-git`, `fast-glob` → add to `buildstory` CLI (these cannot go in core; see boundary rules)

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 02 |
|-----------|-------------------|
| `@buildstory/core` must have zero knowledge of CLI args, config files, or n8n | simple-git and fast-glob CANNOT be imported in core — they must be injected via ArtifactSource / GitSource interfaces |
| ESLint bans `fs`, `path`, `process`, config libs from `packages/core/src/` | No `path.resolve()` in core; cross-ref resolution must use string ops or an injected resolver |
| All imports use `.js` extensions (NodeNext resolution) | Every import in scan sub-modules needs `.js` suffix on relative imports |
| ESM-only (type: module in package.json) | remark ecosystem works correctly; no CJS issues |
| Zod schemas define typed contracts at pipeline boundaries | TimelineSchema.parse() must be called before returning from scan() |
| ArtifactSource interface is the file I/O contract | scan() never calls readFile/glob directly — always via injected source |
| GSD Workflow Enforcement | Phase work must go through /gsd-execute-phase |

---

## Sources

### Primary (HIGH confidence)
- `packages/core/src/types/timeline.ts` — exact TimelineEvent/Timeline Zod schema (read from codebase)
- `packages/core/src/types/source.ts` — exact ArtifactSource interface (read from codebase)
- `packages/core/src/types/options.ts` — exact ScanOptions interface (read from codebase)
- `packages/cli/src/commands/run.ts` — ArtifactSource implementation pattern in CLI (read from codebase)
- `eslint.config.js` — exact banned imports (fs, path, process, config libs) in core (read from codebase)
- `packages/core/package.json` — confirmed no remark/simple-git/fast-glob yet installed (read from codebase)
- `tsconfig.base.json` — NodeNext moduleResolution confirmed (read from codebase)
- npm registry — remark@15.0.1, remark-parse@11.0.0, remark-frontmatter@5.0.0, simple-git@3.33.0, fast-glob@3.3.3, gray-matter@4.0.3 [VERIFIED: npm view, 2026-04-05]

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` — remark ESM-only note, unified ecosystem, simple-git API summary
- `.planning/research/PITFALLS.md` — Pitfall 8 (generic markdown parsing missing artifact semantics), integration gotchas table
- `.planning/research/ARCHITECTURE.md` — FileWalker/GitReader/ArtifactParser component decomposition
- unified/mdast spec: https://github.com/syntax-tree/mdast — Heading node structure
- fast-glob README: https://github.com/mrmlnc/fast-glob — `deep`, `dot`, `ignore`, `onlyFiles` options
- simple-git README: https://github.com/steveukx/git-js — `log({ file, '--max-count' })` and `raw()` API

### Tertiary (LOW confidence)
- GStack wikilink `[[Title]]` pattern (A2) — inferred from GStack convention knowledge, not verified against actual artifact corpus

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions verified against npm registry 2026-04-05
- Architecture: HIGH — based on existing codebase contracts (ArtifactSource, TimelineSchema, ESLint rules all confirmed)
- remark API patterns: HIGH — heading node structure is stable mdast spec
- simple-git API patterns: HIGH — log/raw usage is documented API
- Secret redaction regexes: MEDIUM — patterns cover known formats but need testing against real artifacts
- Cross-reference detection: MEDIUM — path boundary constraint (no `path` in core) creates an architectural decision that must be resolved before implementation
- GitSource interface decision: MEDIUM — two valid approaches; planner must choose

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (packages are stable; revisit if remark or simple-git releases a major version)
