# Phase 3: Narrator - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 03-narrator
**Areas discussed:** LLM prompting strategy, Format output approach, Cost control & chunking, Requirements realignment

---

## LLM Prompting Strategy

### LLM Call Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Single call: beats + narrative | One LLM call extracts beats AND generates summaries. Simpler, cheaper. | ✓ |
| Two-pass: extract then narrate | First call classifies, second narrates. More control, 2x cost. | |
| You decide | Claude picks. | |

**User's choice:** Single call

### Schema Enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Provider-native structured output | Anthropic tool_use + OpenAI function calling. | ✓ |
| JSON mode + Zod parse | Simpler, relies on prompt engineering. | |
| You decide | Claude picks. | |

**User's choice:** Provider-native structured output

---

## Format Output Approach

### Generation Method

| Option | Description | Selected |
|--------|-------------|----------|
| LLM-generated per format | Second LLM call per format with tailored prompt. | ✓ |
| Template-based rendering | String templates, no LLM cost. Rigid. | |
| Hybrid | Template skeleton + LLM prose. | |

**User's choice:** LLM-generated per format

### Default Formats

| Option | Description | Selected |
|--------|-------------|----------|
| All by default, --format to pick | Generate all 4, user can filter. | ✓ |
| User must specify | No default, --format required. | |
| Default to outline only | Lower cost default. | |

**User's choice:** All by default

---

## Cost Control & Chunking

### Large Timeline Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Chunk by GSD phase boundaries | Group by .planning/phases/N. Natural boundaries. | ✓ |
| Chunk by token count | Split by size, ignore phase structure. | |
| Fail with error (simplest v1) | No chunking, refuse if too large. | |

**User's choice:** Chunk by phase boundaries

### Token Estimation

| Option | Description | Selected |
|--------|-------------|----------|
| Character-based (~4 chars/token) | Simple heuristic, safe overestimate. | ✓ |
| Tokenizer library | Accurate, more dependencies. | |
| You decide | Claude picks. | |

**User's choice:** Character-based estimate

---

## Requirements Realignment

| Option | Description | Selected |
|--------|-------------|----------|
| Update for Narrative-First MVP | NARR-04→beats, NARR-06→word count, NARR-07→StoryArc. | ✓ |
| Move video reqs to v2 | NARR-04/06 to v2, update NARR-07. | |
| You decide | Claude updates for consistency. | |

**User's choice:** Update requirements

---

## Claude's Discretion

- System prompt wording per style preset
- Format-specific prompt engineering
- Synthesis call structure for chunked narration
- LLM API error handling and retries
- Deterministic output strategy (seed, temperature=0)

## Deferred Ideas

- story.config.json editorial control — accepted by CEO plan, deferred from Phase 3
- `buildstory init` command — not Phase 3 scope
- Video rendering — separate milestone
- Incremental narration — v2
- Custom beat types — v2
