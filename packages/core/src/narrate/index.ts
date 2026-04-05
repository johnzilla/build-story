import type { Timeline } from '../types/timeline.js'
import type { NarrateOptions } from '../types/options.js'
import type { StoryArc } from '../types/story.js'

export async function narrate(timeline: Timeline, options: NarrateOptions): Promise<StoryArc> {
  // Stub: returns empty StoryArc — real LLM call added in narrate phase
  void timeline
  return {
    version: '1',
    beats: [],
    metadata: {
      generatedAt: new Date().toISOString(),
      style: options.style,
      sourceTimeline: timeline.rootDir,
    },
  }
}
