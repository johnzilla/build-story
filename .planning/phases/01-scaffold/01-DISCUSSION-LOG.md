# Phase 1: Scaffold - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 01-scaffold
**Areas discussed:** Build & module system, CLI framework, Config loading, Pipeline wiring

---

## Build & Module System

### ESM vs CJS
| Option | Description | Selected |
|--------|-------------|----------|
| ESM-only (Recommended) | Simpler config. remark/unified are ESM-only. Future n8n handles CJS. | ✓ |
| Dual ESM/CJS | tsup outputs both. More compatible but adds complexity for deferred consumer. | |
| You decide | Claude picks | |

**User's choice:** ESM-only
**Notes:** None

### Build Tool
| Option | Description | Selected |
|--------|-------------|----------|
| tsup (Recommended) | esbuild-based, fast, handles ESM/CJS/dts. Research confirmed. | ✓ |
| tsc only | No bundler. Simpler but slower, no tree-shaking. | |
| You decide | Claude picks | |

**User's choice:** tsup
**Notes:** None

### TypeScript Module Resolution
| Option | Description | Selected |
|--------|-------------|----------|
| NodeNext (Recommended) | Modern Node.js resolution. Requires .js extensions. Strictest. | ✓ |
| Bundler | Lets bundler handle resolution. Slightly looser. | |
| You decide | Claude picks | |

**User's choice:** NodeNext
**Notes:** None

### Monorepo Task Runner
| Option | Description | Selected |
|--------|-------------|----------|
| pnpm scripts only | pnpm --filter and workspace scripts. No extra dependency. | ✓ |
| Turborepo | Caching, parallel builds, dependency-aware. More setup. | |
| You decide | Claude picks | |

**User's choice:** pnpm scripts only
**Notes:** None

---

## CLI Framework

### CLI Parser
| Option | Description | Selected |
|--------|-------------|----------|
| Commander (Recommended) | PRD specifies it. 35M downloads/week. Subcommand pattern built-in. | ✓ |
| yargs | More flexible, heavier. Good for complex CLIs. | |
| You decide | Claude picks | |

**User's choice:** Commander
**Notes:** None

### CLI Output
| Option | Description | Selected |
|--------|-------------|----------|
| ora spinners + chalk | Spinner per phase, colored status messages. Standard CLI UX. | ✓ |
| Plain text only | No spinners/colors. CI-friendly. | |
| You decide | Claude picks | |

**User's choice:** ora spinners + chalk
**Notes:** None

### Binary Name
| Option | Description | Selected |
|--------|-------------|----------|
| buildstory | Matches project name. Clear and descriptive. | ✓ |
| bstory | Shorter to type. Less discoverable. | |
| bs | Very short but ambiguous. | |

**User's choice:** buildstory
**Notes:** None

---

## Config Loading

### Config Format
| Option | Description | Selected |
|--------|-------------|----------|
| TOML only (Recommended) | Project root + ~/.config/buildstory/. Project overrides global. | ✓ |
| TOML + env vars | TOML for structured, env vars for secrets. BUILDSTORY_* prefix. | |
| You decide | Claude picks | |

**User's choice:** TOML only
**Notes:** None

### API Keys
| Option | Description | Selected |
|--------|-------------|----------|
| Env vars only (Recommended) | ANTHROPIC_API_KEY, OPENAI_API_KEY from environment. Secure default. | ✓ |
| Config key_env pointer | Config says api_key_env = 'MY_VAR'. Indirection. | |
| Both | Config can point to custom var, falls back to standard names. | |

**User's choice:** Env vars only
**Notes:** None

---

## Pipeline Wiring

### Stub Behavior
| Option | Description | Selected |
|--------|-------------|----------|
| Typed empty objects (Recommended) | Correct shape, validates types end-to-end. | ✓ |
| Fixture data | Hardcoded sample data, see output immediately. | |
| You decide | Claude picks | |

**User's choice:** Typed empty objects
**Notes:** None

### Pipeline Chaining
| Option | Description | Selected |
|--------|-------------|----------|
| Sequential await (Recommended) | run() calls scan(), passes to narrate(), passes to render(). Simple. | ✓ |
| Streaming/pipes | Streams output between phases. More complex. | |
| You decide | Claude picks | |

**User's choice:** Sequential await
**Notes:** None

### Runtime Validation
| Option | Description | Selected |
|--------|-------------|----------|
| Yes, from the start (Recommended) | Zod v4 schemas alongside TypeScript types. Validates at boundaries. | ✓ |
| Types only | TypeScript interfaces first. Add validation later. | |
| You decide | Claude picks | |

**User's choice:** Zod from the start
**Notes:** None

---

## Claude's Discretion

- Exact tsconfig settings beyond moduleResolution
- Package.json workspace configuration details
- ESLint rule implementation for core boundary
- Test framework setup (Vitest from research)
- Directory structure within packages

## Deferred Ideas

None — discussion stayed within phase scope
