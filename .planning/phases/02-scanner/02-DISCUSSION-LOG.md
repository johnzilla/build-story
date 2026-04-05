# Phase 2: Scanner - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 02-scanner
**Areas discussed:** Event granularity, Git integration depth, Beat pre-classification, Secret redaction approach

---

## Event Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| One event per file | Each markdown file = one event. Simplest, 10-50 events typical. | ✓ |
| One event per top-level section | Split at H2 headings. More granular, 3-5x more events. | |
| Hybrid: files + git events | File events + separate git commit events. Mixed granularity. | |

**User's choice:** One event per file
**Notes:** None

### Content Extraction

| Option | Description | Selected |
|--------|-------------|----------|
| Full content | Read entire file. Let narrator decide relevance. | ✓ |
| Summary only | Extract headings + first paragraph per section. | |
| Structured extraction | Parse with remark AST, extract headings, lists, code blocks. | |

**User's choice:** Full content

### Summary Generation

| Option | Description | Selected |
|--------|-------------|----------|
| First H1/H2 + first paragraph | Simple regex/AST. Fast, no LLM cost. | |
| Heading hierarchy as outline | All headings as nested outline. Structured skeleton. | ✓ |
| You decide | Claude picks best approach. | |

**User's choice:** Heading hierarchy as outline

---

## Git Integration Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Commits + tags only | git log + git tag. 80% narrative value, simple. | ✓ |
| Full: commits, tags, blame, branches | Everything in SCAN-06. 3x implementation complexity. | |
| Commits only, add more later | Minimal. Risk missing tag milestones. | |

**User's choice:** Commits + tags only

### Git Events

| Option | Description | Selected |
|--------|-------------|----------|
| Enrich file events only | Git dates files, tags become milestone events. | ✓ |
| Commits as separate events | Each commit = timeline event. Very granular. | |
| Significant commits only | Filter by conventional commit prefix. | |

**User's choice:** Enrich file events only

---

## Beat Pre-Classification

| Option | Description | Selected |
|--------|-------------|----------|
| No beat hints in scan | Clean Timeline, all beats in narrate. | ✓ |
| Heuristic beat hints in scan | Filename-based hints. Cheap, helps narrator bootstrap. | |
| Separate beat classifier step | classify() between scan and narrate. | |

**User's choice:** No beat hints in scan

---

## Secret Redaction

| Option | Description | Selected |
|--------|-------------|----------|
| Regex pattern matching | Strip common secret patterns. Replace with [REDACTED]. | ✓ |
| Conservative: env var values only | Only KEY=value patterns. Very targeted. | |
| You decide | Claude picks approach. | |

**User's choice:** Regex pattern matching

### Redaction Location

| Option | Description | Selected |
|--------|-------------|----------|
| In ArtifactSource adapter | readFile() returns pre-redacted content. Single enforcement. | ✓ |
| In scan() before building events | scan() cleans rawContent. More explicit. | |
| As separate redact() pipeline step | Standalone function between scan and narrate. | |

**User's choice:** In ArtifactSource adapter

---

## Claude's Discretion

- remark plugin chain specifics
- fast-glob configuration
- simple-git options
- Cross-reference detection approach
- Error handling for unreadable files
- Event ID generation strategy

## Deferred Ideas

- Git blame per-line dating (v2)
- Branch/merge event detection (v2)
- Beat pre-classification in scan (decided against)
- Multi-repo scanning (v2)
