/**
 * Normalized transcript model for agent coding sessions.
 *
 * Modern "just build it" workflows no longer externalize reasoning into
 * planning docs — the "why / what I rejected / what changed" now lives in the
 * agent session itself. This model is the harness-neutral shape that every
 * agent's stored session gets mapped into, so the narrator can treat a Claude
 * Code session, a goose session, or a pi session identically.
 *
 * ## Why this shape (ACP-influenced)
 *
 * The Agent Client Protocol (ACP) is a *live* editor↔agent protocol, not a
 * persisted-log format — each harness still writes its own proprietary session
 * files to disk, so post-hoc reading always needs a per-harness adapter. What
 * ACP gives us is a well-designed, harness-neutral vocabulary for session
 * content (user/agent messages, agent "thoughts", tool calls and results, plan
 * updates). We model `TranscriptTurn.kind` on that vocabulary so that:
 *
 *   1. adapters have a principled target to normalize into, and
 *   2. if BuildStory later runs *as an ACP client* and records sessions live
 *      ("capture mode"), the captured data already matches this shape with no
 *      translation.
 *
 * MVP is post-hoc adapters (Claude Code first); capture mode is the north star.
 */

/** The kind of a single turn, mirroring ACP's session-update vocabulary. */
export type TranscriptTurnKind =
  | 'message' // user or agent natural-language message
  | 'thought' // agent reasoning / plan-of-attack narration
  | 'tool_call' // agent invoked a tool (edit, run, search, …)
  | 'tool_result' // result returned to the agent
  | 'plan' // a plan / todo update

export interface TranscriptTurn {
  role: 'user' | 'agent' | 'tool'
  kind: TranscriptTurnKind
  /** ISO 8601 timestamp, when the harness records one. */
  timestamp?: string
  /** Normalized text content (tool calls: a human-readable description). */
  text: string
  /** For tool_call / tool_result turns: the tool name (e.g. "edit", "bash"). */
  toolName?: string
}

export interface TranscriptSession {
  /** Stable id for this session (harness-provided or derived). */
  id: string
  /** Which harness produced it: "claude-code" | "goose" | "pi" | … */
  harness: string
  /** Model that drove the session, when known. */
  model?: string
  /** Working directory / project the session ran in — used to match to a repo. */
  cwd?: string
  startedAt?: string
  endedAt?: string
  turns: TranscriptTurn[]
}

/** Filter narrowing which sessions a source returns. */
export interface TranscriptFilter {
  /** Absolute project path — match sessions whose `cwd` is at or under it. */
  projectPath?: string
  /** ISO lower bound on session start. */
  since?: string
  /** ISO upper bound on session start. */
  until?: string
}

/**
 * A pluggable source of agent session transcripts for one harness.
 *
 * Implementations are thin adapters over each harness's on-disk session store
 * (Claude Code: `~/.claude/projects/**\/*.jsonl`; goose / pi: their own stores)
 * that normalize into `TranscriptSession`. Like `ArtifactSource`, this keeps
 * `@buildstory/core` free of filesystem and vendor specifics — adapters live in
 * the CLI (or a future dedicated package) and inject an implementation.
 */
export interface TranscriptSource {
  /** Harness identifier this source reads (e.g. "claude-code"). */
  readonly harness: string
  /** Discover and normalize sessions matching the filter. */
  listSessions(filter: TranscriptFilter): Promise<TranscriptSession[]>
}
