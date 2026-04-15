# Roadmap: BuildStory

## Milestones

- ✅ **v1.0 MVP** - Phases 1-4 (shipped 2026-04-14)
- ✅ **v1.1 HeyGen Renderer Exploration** - Phases 5-7 (shipped 2026-04-15)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) - SHIPPED 2026-04-14</summary>

BuildStory goes from zero to narrated MP4 in four phases. Phase 1 locks in the monorepo scaffold and package boundaries — the ESLint enforcement and core/CLI separation that make everything else safe to build. Phase 2 delivers the scanner: artifact-aware markdown extraction combined with git history produces the Timeline JSON that all downstream phases consume. Phase 3 turns Timeline into StoryArc via LLM narration with style presets, beat classification, and cost guards, then formats it into multiple text outputs. Phase 4 closes the loop with frame generation, TTS, FFmpeg assembly, and a complete CLI surface — producing a watchable MP4 from real planning artifacts.

- [x] Phase 1: Scaffold (2/2 plans) — completed 2026-04-05
- [x] Phase 2: Scanner (3/3 plans) — completed 2026-04-05
- [x] Phase 3: Narrator (3/3 plans) — completed 2026-04-14
- [x] Phase 4: Renderer (4/4 plans) — completed 2026-04-14

</details>

<details>
<summary>✅ v1.1 HeyGen Renderer Exploration (Phases 5-7) - SHIPPED 2026-04-15</summary>

Added HeyGen as a standalone alternative video renderer — avatar-narrated build stories via a pluggable provider interface — without touching the existing Remotion pipeline. Phase 5 scaffolded the `@buildstory/heygen` package with preflight, cost estimation, and dry-run. Phase 6 built a pure adapter translating StoryArc beats to HeyGen video_inputs with beat-type colors and chunking. Phase 7 wired the actual HeyGen v2 API with submit, poll, download, and FFmpeg concat.

- [x] Phase 5: HeyGen Package (3/3 plans) — completed 2026-04-15
- [x] Phase 6: StoryArc Adapter (2/2 plans) — completed 2026-04-15
- [x] Phase 7: HeyGen API + CLI Integration (2/2 plans) — completed 2026-04-15

</details>

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Scaffold | v1.0 | 2/2 | Complete | 2026-04-05 |
| 2. Scanner | v1.0 | 3/3 | Complete | 2026-04-05 |
| 3. Narrator | v1.0 | 3/3 | Complete | 2026-04-14 |
| 4. Renderer | v1.0 | 4/4 | Complete | 2026-04-14 |
| 5. HeyGen Package | v1.1 | 3/3 | Complete | 2026-04-15 |
| 6. StoryArc Adapter | v1.1 | 2/2 | Complete | 2026-04-15 |
| 7. HeyGen API + CLI Integration | v1.1 | 2/2 | Complete | 2026-04-15 |
