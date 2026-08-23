import { describe, it, expect } from 'vitest'
import {
  checkProvider,
  checkStyle,
  checkRenderer,
  checkVoice,
  checkSpeed,
  checkTtsModel,
  checkMaxCost,
  DEFAULT_STYLE,
} from '../validate.js'

describe('input validation', () => {
  it('accepts valid enum values with no errors', () => {
    const e: string[] = []
    expect(checkProvider('openai', e)).toBe('openai')
    expect(checkStyle('technical', e)).toBe('technical')
    expect(checkRenderer('heygen', e)).toBe('heygen')
    expect(checkVoice('nova', e)).toBe('nova')
    expect(checkTtsModel('tts-1', e)).toBe('tts-1')
    expect(e).toHaveLength(0)
  })

  it('collects a clear error for each bad enum value', () => {
    const e: string[] = []
    checkProvider('bogus', e)
    checkStyle('epic', e)
    checkRenderer('after-effects', e)
    checkVoice('darth', e)
    checkTtsModel('tts-9', e)
    expect(e).toHaveLength(5)
    expect(e[0]).toMatch(/Invalid --provider "bogus".*anthropic, openai/)
    expect(e[1]).toMatch(/Invalid --style "epic"/)
  })

  it('accepts speed within 0.25–4.0 and rejects out-of-range/non-numeric', () => {
    const ok: string[] = []
    expect(checkSpeed(1.5, ok)).toBe(1.5)
    expect(ok).toHaveLength(0)

    const bad: string[] = []
    checkSpeed(99, bad)
    checkSpeed(0, bad)
    checkSpeed('fast', bad)
    expect(bad).toHaveLength(3)
    expect(bad[0]).toMatch(/tts\.speed.*between 0\.25 and 4/)
  })

  it('parses --max-cost as a positive number, undefined when unset', () => {
    const e: string[] = []
    expect(checkMaxCost(undefined, e)).toBeUndefined()
    expect(checkMaxCost('5', e)).toBe(5)
    expect(checkMaxCost('0.50', e)).toBe(0.5)
    expect(e).toHaveLength(0)

    const bad: string[] = []
    expect(checkMaxCost('0', bad)).toBeUndefined()
    expect(checkMaxCost('-3', bad)).toBeUndefined()
    expect(checkMaxCost('abc', bad)).toBeUndefined()
    expect(bad).toHaveLength(3)
  })

  it('unifies the default style across commands', () => {
    // run and narrate both fall back to this single default.
    expect(DEFAULT_STYLE).toBe('story')
  })
})
