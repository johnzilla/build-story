import { describe, it, expect } from 'vitest'
import { truncateForTTS, MAX_TTS_CHARS } from '../truncate.js'

describe('truncateForTTS', () => {
  it('returns short text unchanged', () => {
    expect(truncateForTTS('Hello world.')).toBe('Hello world.')
  })

  it('leaves text exactly at the limit unchanged', () => {
    const exact = 'a'.repeat(MAX_TTS_CHARS)
    expect(truncateForTTS(exact)).toBe(exact)
  })

  it('trims at the last sentence boundary that fits, keeping the period', () => {
    // "First sentence." then filler with no more periods, over a small limit.
    const text = 'First sentence.' + ' x'.repeat(100)
    const out = truncateForTTS(text, 20)
    expect(out).toBe('First sentence.')
    expect(out.endsWith('.')).toBe(true)
  })

  it('hard-cuts when there is no sentence boundary within the limit', () => {
    const text = 'x'.repeat(100) // no periods at all
    const out = truncateForTTS(text, 40)
    expect(out).toHaveLength(40)
    expect(out).toBe('x'.repeat(40))
  })

  it('never exceeds the limit', () => {
    const text = ('Sentence number one is here. ' + 'y'.repeat(50)).repeat(200)
    expect(truncateForTTS(text, 500).length).toBeLessThanOrEqual(500)
  })
})
