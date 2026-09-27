import { describe, it, expect } from 'vitest'
import { splitForTTS, MAX_TTS_CHARS } from '../split.js'

describe('splitForTTS', () => {
  it('returns short text and exact-limit text unchanged', () => {
    expect(splitForTTS('Hello world.')).toEqual(['Hello world.'])
    expect(splitForTTS('a'.repeat(MAX_TTS_CHARS))).toEqual(['a'.repeat(MAX_TTS_CHARS)])
  })
  it.each([
    'First sentence. ' + 'No punctuation '.repeat(500),
    'x'.repeat(10000),
    'Decide! Next? More. '.repeat(600),
    '开发过程。保留所有文字！'.repeat(800),
    '🚀'.repeat(5000),
  ])('retains every character in bounded chunks', (text) => {
    const chunks = splitForTTS(text)
    expect(chunks.join('')).toBe(text)
    expect(chunks.every(chunk => chunk.length > 0 && chunk.length <= MAX_TTS_CHARS)).toBe(true)
    expect(chunks.every(chunk => !/[\uD800-\uDFFF]/u.test(chunk))).toBe(true)
  })
  it('prefers sentence boundaries, then whitespace', () => {
    expect(splitForTTS('First sentence. Extra words here.', 20)[0]).toBe('First sentence. ')
    expect(splitForTTS('first second third', 13)[0]).toBe('first second ')
  })
  it('keeps surrogate pairs intact at an odd limit', () => {
    expect(splitForTTS('🚀🚀🚀', 3)).toEqual(['🚀', '🚀', '🚀'])
  })
  it('rejects invalid limits instead of looping forever', () => {
    for (const limit of [0, 1, -1, 2.5, Infinity]) expect(() => splitForTTS('abc', limit)).toThrow('chunk limit')
  })
})
