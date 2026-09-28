export { scan } from './scan/index.js'
export { narrate, createProvider } from './narrate/index.js'
export { format } from './format/index.js'
export { TimelineSchema, TimelineEventSchema } from './types/timeline.js'
export type { Timeline, TimelineEvent } from './types/timeline.js'
export { StoryArcSchema, StoryBeatSchema, BeatTypeSchema, FormatTypeSchema } from './types/story.js'
export type { StoryArc, StoryBeat, BeatType, FormatType } from './types/story.js'
export { buildCommitEvents } from './scan/commit-source.js'
export { buildTranscriptEvents } from './scan/transcript-source.js'
export { correlateCommitsWithTranscripts } from './scan/correlate.js'
export type { CorrelateOptions } from './scan/correlate.js'
export type {
  ScanOptions,
  ScanCommitOptions,
  ScanTranscriptOptions,
  NarrateOptions,
} from './types/options.js'
export type { ArtifactSource } from './types/source.js'
export type {
  GitSource,
  CommitRecord,
  CommitFileChange,
  GetCommitsOptions,
} from './types/git-source.js'
export type {
  TranscriptSource,
  TranscriptSession,
  TranscriptTurn,
  TranscriptTurnKind,
  TranscriptFilter,
} from './types/transcript.js'
export type { LLMProvider, UsageStats } from './narrate/providers/interface.js'

export { redactSecrets, SECRET_PATTERNS } from './privacy/redact.js'
export { sanitizeOutboundText, sanitizeOutboundValue, sanitizeTimeline, sanitizeStoryArc } from './privacy/outbound.js'
export { buildNarrationPreview } from './narrate/prepare.js'

export { SpendBudget, BudgetExceededError } from './budget.js'
export type { SpendEntry } from './budget.js'
export { LLM_PRICE_PER_1M, llmCostUSD } from './narrate/pricing.js'

export { splitNarration } from './narration-text.js'

export { SourceExcerptSchema, EvidenceTopicSchema } from './types/evidence.js'
export type { SourceExcerpt, EvidenceTopic } from './types/evidence.js'

export { reviewStoryArc, renderSourceReview } from './narrate/review.js'

export { EditorialOptionsSchema } from './types/editorial.js'
export type { EditorialOptions } from './types/editorial.js'

export { EvidenceVisualSchema } from './types/visual.js'
export type { EvidenceVisual } from './types/visual.js'
