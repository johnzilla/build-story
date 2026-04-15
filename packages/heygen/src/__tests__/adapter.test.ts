import { describe, it, expect } from 'vitest'
import { adaptStoryArc } from '../adapter.js'
import type { StoryArc, StoryBeat } from '@buildstory/core'
import type { AdaptOptions } from '../types.js'

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const makeBeat = (overrides: Partial<StoryBeat> = {}): StoryBeat => ({
  type: 'idea',
  title: 'Test beat',
  summary: 'A short summary.',
  evidence: [],
  sourceEventIds: [],
  significance: 2,
  ...overrides,
})

const makeArc = (beats: StoryBeat[]): StoryArc => ({
  version: '1',
  beats,
  metadata: {
    generatedAt: '2026-01-01T00:00:00Z',
    style: 'technical',
    sourceTimeline: '/test',
  },
})

const defaultOpts: AdaptOptions = {
  avatarId: 'Monica_chair_front_public',
  voiceId: 'test-voice-id',
}

// ---------------------------------------------------------------------------
// beat-to-scene mapping
// ---------------------------------------------------------------------------

describe('beat-to-scene mapping', () => {
  it('1-beat arc returns 1 chunk with 1 scene, warnings is empty array', () => {
    const result = adaptStoryArc(makeArc([makeBeat()]), defaultOpts)
    expect(result.chunks).toHaveLength(1)
    expect(result.chunks[0]).toHaveLength(1)
    expect(result.warnings).toEqual([])
  })

  it('scene.character.type is "avatar"', () => {
    const result = adaptStoryArc(makeArc([makeBeat()]), defaultOpts)
    expect(result.chunks[0][0].character.type).toBe('avatar')
  })

  it('scene.character.avatar_id matches opts.avatarId', () => {
    const result = adaptStoryArc(makeArc([makeBeat()]), defaultOpts)
    expect(result.chunks[0][0].character.avatar_id).toBe(defaultOpts.avatarId)
  })

  it('scene.voice.type is "text"', () => {
    const result = adaptStoryArc(makeArc([makeBeat()]), defaultOpts)
    expect(result.chunks[0][0].voice.type).toBe('text')
  })

  it('scene.voice.input_text matches beat.summary', () => {
    const beat = makeBeat({ summary: 'Hello world.' })
    const result = adaptStoryArc(makeArc([beat]), defaultOpts)
    expect(result.chunks[0][0].voice.input_text).toBe('Hello world.')
  })

  it('scene.voice.voice_id matches opts.voiceId', () => {
    const result = adaptStoryArc(makeArc([makeBeat()]), defaultOpts)
    expect(result.chunks[0][0].voice.voice_id).toBe(defaultOpts.voiceId)
  })

  it('scene.background.type is "color"', () => {
    const result = adaptStoryArc(makeArc([makeBeat()]), defaultOpts)
    expect(result.chunks[0][0].background.type).toBe('color')
  })

  it('scene.background.value is the hex from BEAT_COLOR_MAP', () => {
    const beat = makeBeat({ type: 'idea' })
    const result = adaptStoryArc(makeArc([beat]), defaultOpts)
    expect(result.chunks[0][0].background.value).toBe('#1E3A5F')
  })

  it('opts.speed is passed through to scene.voice.speed when provided', () => {
    const opts: AdaptOptions = { ...defaultOpts, speed: 1.5 }
    const result = adaptStoryArc(makeArc([makeBeat()]), opts)
    expect(result.chunks[0][0].voice.speed).toBe(1.5)
  })

  it('opts.avatarStyle is passed through to scene.character.avatar_style when provided', () => {
    const opts: AdaptOptions = { ...defaultOpts, avatarStyle: 'circle' }
    const result = adaptStoryArc(makeArc([makeBeat()]), opts)
    expect(result.chunks[0][0].character.avatar_style).toBe('circle')
  })

  it('speed is omitted from scene when not provided', () => {
    const result = adaptStoryArc(makeArc([makeBeat()]), defaultOpts)
    expect(result.chunks[0][0].voice.speed).toBeUndefined()
  })

  it('avatarStyle is omitted from scene when not provided', () => {
    const result = adaptStoryArc(makeArc([makeBeat()]), defaultOpts)
    expect(result.chunks[0][0].character.avatar_style).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// beat-type colors
// ---------------------------------------------------------------------------

describe('beat-type colors', () => {
  const colorCases: Array<[StoryBeat['type'], string]> = [
    ['idea',       '#1E3A5F'],
    ['goal',       '#2D5F8A'],
    ['attempt',    '#4A90D9'],
    ['obstacle',   '#D35400'],
    ['pivot',      '#E74C3C'],
    ['side_quest', '#8E44AD'],
    ['decision',   '#F39C12'],
    ['result',     '#27AE60'],
    ['open_loop',  '#7F8C8D'],
  ]

  for (const [beatType, expectedColor] of colorCases) {
    it(`beat type "${beatType}" maps to hex ${expectedColor}`, () => {
      const beat = makeBeat({ type: beatType })
      const result = adaptStoryArc(makeArc([beat]), defaultOpts)
      expect(result.chunks[0][0].background.value).toBe(expectedColor)
    })
  }
})

// ---------------------------------------------------------------------------
// chunking
// ---------------------------------------------------------------------------

describe('chunking', () => {
  it('10-beat arc produces exactly 1 chunk of length 10', () => {
    const beats = Array.from({ length: 10 }, () => makeBeat())
    const result = adaptStoryArc(makeArc(beats), defaultOpts)
    expect(result.chunks).toHaveLength(1)
    expect(result.chunks[0]).toHaveLength(10)
  })

  it('11-beat arc produces exactly 2 chunks (10 + 1)', () => {
    const beats = Array.from({ length: 11 }, () => makeBeat())
    const result = adaptStoryArc(makeArc(beats), defaultOpts)
    expect(result.chunks).toHaveLength(2)
    expect(result.chunks[0]).toHaveLength(10)
    expect(result.chunks[1]).toHaveLength(1)
  })

  it('15-beat arc produces exactly 2 chunks (10 + 5)', () => {
    const beats = Array.from({ length: 15 }, () => makeBeat())
    const result = adaptStoryArc(makeArc(beats), defaultOpts)
    expect(result.chunks).toHaveLength(2)
    expect(result.chunks[0]).toHaveLength(10)
    expect(result.chunks[1]).toHaveLength(5)
  })

  it('20-beat arc produces exactly 2 chunks (10 + 10)', () => {
    const beats = Array.from({ length: 20 }, () => makeBeat())
    const result = adaptStoryArc(makeArc(beats), defaultOpts)
    expect(result.chunks).toHaveLength(2)
    expect(result.chunks[0]).toHaveLength(10)
    expect(result.chunks[1]).toHaveLength(10)
  })

  it('21-beat arc produces exactly 3 chunks (10 + 10 + 1)', () => {
    const beats = Array.from({ length: 21 }, () => makeBeat())
    const result = adaptStoryArc(makeArc(beats), defaultOpts)
    expect(result.chunks).toHaveLength(3)
    expect(result.chunks[0]).toHaveLength(10)
    expect(result.chunks[1]).toHaveLength(10)
    expect(result.chunks[2]).toHaveLength(1)
  })

  it('chunks.flat().length equals original beat count (15 beats)', () => {
    const beats = Array.from({ length: 15 }, (_, i) =>
      makeBeat({ title: `beat-${i}` })
    )
    const result = adaptStoryArc(makeArc(beats), defaultOpts)
    expect(result.chunks.flat()).toHaveLength(15)
  })

  it('chunks.flat().length equals original beat count (21 beats)', () => {
    const beats = Array.from({ length: 21 }, (_, i) =>
      makeBeat({ title: `beat-${i}` })
    )
    const result = adaptStoryArc(makeArc(beats), defaultOpts)
    expect(result.chunks.flat()).toHaveLength(21)
  })

  it('0-beat arc produces 1 empty chunk, no warnings', () => {
    const result = adaptStoryArc(makeArc([]), defaultOpts)
    expect(result.chunks).toHaveLength(1)
    expect(result.chunks[0]).toHaveLength(0)
    expect(result.warnings).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// truncation
// ---------------------------------------------------------------------------

describe('truncation', () => {
  it('summary exactly 1500 chars is not truncated', () => {
    const summary = 'a'.repeat(1499) + '.'
    const beat = makeBeat({ summary })
    const result = adaptStoryArc(makeArc([beat]), defaultOpts)
    expect(result.chunks[0][0].voice.input_text).toBe(summary)
    expect(result.warnings).toEqual([])
  })

  it('summary of 1501 chars with sentence boundary before limit is truncated at that boundary', () => {
    // Build a summary with a sentence boundary (period + space) around char 1450,
    // then pad to exceed 1500 chars.
    const firstPart = 'x'.repeat(1448) + '. '
    const overflow = 'y'.repeat(60) // total > 1500
    const summary = firstPart + overflow
    expect(summary.length).toBeGreaterThan(1500)
    const beat = makeBeat({ summary })
    const result = adaptStoryArc(makeArc([beat]), defaultOpts)
    const truncated = result.chunks[0][0].voice.input_text
    expect(truncated.length).toBeLessThanOrEqual(1500)
    // Should end with the sentence punctuation
    expect(truncated.endsWith('.')).toBe(true)
  })

  it('summary of 1501 chars with no sentence boundary is hard-cut at 1500', () => {
    const summary = 'x'.repeat(1501)
    const beat = makeBeat({ summary })
    const result = adaptStoryArc(makeArc([beat]), defaultOpts)
    expect(result.chunks[0][0].voice.input_text).toHaveLength(1500)
  })

  it('empty summary produces no truncation, no warning', () => {
    const beat = makeBeat({ summary: '' })
    const result = adaptStoryArc(makeArc([beat]), defaultOpts)
    expect(result.chunks[0][0].voice.input_text).toBe('')
    expect(result.warnings).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// warnings
// ---------------------------------------------------------------------------

describe('warnings', () => {
  it('truncated summary produces a warning string containing the beat title', () => {
    const summary = 'x'.repeat(1501)
    const beat = makeBeat({ summary, title: 'My Important Beat' })
    const result = adaptStoryArc(makeArc([beat]), defaultOpts)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('My Important Beat')
  })

  it('non-truncated beats produce no warnings', () => {
    const beats = [
      makeBeat({ summary: 'Short summary.' }),
      makeBeat({ summary: 'Another short one.' }),
    ]
    const result = adaptStoryArc(makeArc(beats), defaultOpts)
    expect(result.warnings).toEqual([])
  })

  it('multiple truncated beats each produce a warning', () => {
    const beats = [
      makeBeat({ summary: 'a'.repeat(1501), title: 'Beat A' }),
      makeBeat({ summary: 'b'.repeat(1501), title: 'Beat B' }),
    ]
    const result = adaptStoryArc(makeArc(beats), defaultOpts)
    expect(result.warnings).toHaveLength(2)
    expect(result.warnings[0]).toContain('Beat A')
    expect(result.warnings[1]).toContain('Beat B')
  })
})
