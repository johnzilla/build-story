import { describe, it, expect } from 'vitest'
import type { StoryBeat } from '@buildstory/core'
import {
  TTS_PRICE_PER_1000_CHARS,
  DEFAULT_TTS_MODEL,
  ttsCostUSD,
} from '../pricing.js'
import { estimateTTSCost } from '../index.js'

const beat = (summary: string): StoryBeat => ({
  type: 'idea',
  title: 't',
  summary,
  evidence: [],
  sourceEventIds: [],
  significance: 2,
})

describe('TTS pricing table', () => {
  it('prices tts-1-hd at $0.03 and tts-1 at $0.015 per 1k chars', () => {
    expect(TTS_PRICE_PER_1000_CHARS['tts-1-hd']).toBe(0.03)
    expect(TTS_PRICE_PER_1000_CHARS['tts-1']).toBe(0.015)
  })

  it('defaults to tts-1-hd — the model generateSceneAudio actually calls', () => {
    expect(DEFAULT_TTS_MODEL).toBe('tts-1-hd')
  })

  it('ttsCostUSD scales linearly with characters', () => {
    expect(ttsCostUSD(1000, 'tts-1-hd')).toBeCloseTo(0.03)
    expect(ttsCostUSD(2000, 'tts-1')).toBeCloseTo(0.03)
  })
})

describe('estimateTTSCost', () => {
  it('prices at the default (tts-1-hd) when no model is given', () => {
    const est = estimateTTSCost([beat('x'.repeat(1000))])
    // 1000 chars at tts-1-hd ($0.03/1k) — NOT the old hardcoded $0.015.
    expect(est.totalCharacters).toBe(1000)
    expect(est.estimatedCostUSD).toBeCloseTo(0.03)
  })

  it('prices at tts-1 when that model is selected', () => {
    const est = estimateTTSCost([beat('x'.repeat(1000))], 'tts-1')
    expect(est.estimatedCostUSD).toBeCloseTo(0.015)
  })
})
