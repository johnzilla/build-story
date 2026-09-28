import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { StoryArc, StoryBeat } from '@buildstory/core'
import { evidenceForBeat, sourceCaption } from '../composition/evidence.js'
import { EvidenceCard } from '../composition/scenes/EvidenceCard.js'
import { BuildStoryComposition } from '../composition/BuildStory.js'
import { generateSRT } from '../srt.js'
vi.mock('remotion', () => ({
  AbsoluteFill: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Sequence: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Audio: () => null,
  useCurrentFrame: () => 20,
  useVideoConfig: () => ({ durationInFrames: 120 }),
  interpolate: () => 1,
}))
const text = 'We chose local storage for offline use.'
const beat: StoryBeat = { type: 'decision', title: 'Storage choice', summary: 'This full narration is spoken and captioned.', displayText: 'Offline by design', evidence: [], sourceEventIds: ['c1'], significance: 3, visual: { kind: 'quote', panels: [{ label: 'evidence', text, sourceEventId: 'c1' }] } }
const review: NonNullable<StoryArc['metadata']['review']>['beats'][number] = { beatIndex: 0, status: 'source-matched', matchedEvidence: [{ text, eventIds: ['c1'], references: ['Scanned lines 4-5'] }], unmatchedEvidence: [], notes: [], sources: [{ eventId: 'c1', path: 'docs/storage.md', date: '', dateMeaning: '', references: ['Scanned lines 4-5'] }] }

describe('evidence rendering', () => {
  it('requires saved source matches and rejects stale text or source edits', () => {
    expect(evidenceForBeat(beat, review)).toEqual(beat.visual)
    expect(evidenceForBeat(beat, undefined)).toBeUndefined()
    expect(evidenceForBeat({ ...beat, sourceEventIds: [] }, review)).toBeUndefined()
    expect(evidenceForBeat({ ...beat, visual: { ...beat.visual!, panels: [{ ...beat.visual!.panels[0]!, text: 'Changed source text.' }] } }, review)).toBeUndefined()
    expect(sourceCaption('c1', review, 'Different quote')).toBe('docs/storage.md')
    expect(sourceCaption('c1', review, text)).toBe('docs/storage.md · Scanned lines 4-5')
  })
  it.each(['quote', 'diff', 'error', 'architecture', 'comparison', 'outcome'] as const)('renders %s as escaped text with citations', kind => {
    const visual = { kind, panels: [{ label: 'evidence' as const, text: '<script>alert("never execute")</script>', sourceEventId: 'c1' }] }
    const html = renderToStaticMarkup(<EvidenceCard beat={{ ...beat, durationInFrames: 120 }} visual={visual} citations={['docs/storage.md · Scanned lines 4-5']} />)
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('docs/storage.md')
    expect(html).toContain('Offline by design')
    expect(html).not.toContain(beat.summary)
  })
  it('gives evidence priority over bookend cards while captions keep spoken text', () => {
    const arc: StoryArc = { version: '1', beats: [beat], metadata: { generatedAt: '', style: '', sourceTimeline: '', review: { version: '1', beats: [review] } } }
    const audio = { scenes: [{ beatIndex: 0, durationSeconds: 3, filePath: '/audio.wav', startOffsetSeconds: 0 }], totalDurationSeconds: 3, silenceGapSeconds: 0.3, bookendSilenceSeconds: 1 }
    const html = renderToStaticMarkup(<BuildStoryComposition storyArc={arc} audioManifest={audio} fps={30} />)
    expect(html).toContain('From the source')
    expect(html).toContain(text)
    expect(generateSRT([beat], audio)).toContain(beat.summary)
    expect(generateSRT([beat], audio)).not.toContain(beat.displayText)
    const legacy = { ...arc, metadata: { generatedAt: '', style: '', sourceTimeline: '' } }
    expect(renderToStaticMarkup(<BuildStoryComposition storyArc={legacy} audioManifest={audio} fps={30} />)).not.toContain('From the source')
  })
})
