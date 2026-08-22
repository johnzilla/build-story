import { describe, it, expect } from 'vitest'
import { createTranscriptSource } from '../adapters/transcript-registry.js'

describe('createTranscriptSource()', () => {
  it('returns no source when transcripts are disabled or config missing', () => {
    expect(createTranscriptSource(undefined).source).toBeNull()
    expect(createTranscriptSource({ enabled: false }).source).toBeNull()
  })

  it('defaults to all known harnesses when enabled without a list', () => {
    const { source, harnesses, unknown } = createTranscriptSource({ enabled: true })
    expect(source).not.toBeNull()
    expect(harnesses).toEqual(['claude-code', 'pi'])
    expect(unknown).toEqual([])
    expect(source?.harness).toBe('claude-code+pi')
  })

  it('honors an explicit harness selection', () => {
    const { source, harnesses } = createTranscriptSource({ enabled: true, harnesses: ['pi'] })
    expect(harnesses).toEqual(['pi'])
    expect(source?.harness).toBe('pi')
  })

  it('reports unknown harnesses and still builds the known ones', () => {
    const { source, harnesses, unknown } = createTranscriptSource({
      enabled: true,
      harnesses: ['pi', 'goose'],
    })
    expect(harnesses).toEqual(['pi'])
    expect(unknown).toEqual(['goose'])
    expect(source?.harness).toBe('pi')
  })

  it('returns no source when only unknown harnesses are selected', () => {
    const { source, unknown } = createTranscriptSource({ enabled: true, harnesses: ['goose'] })
    expect(source).toBeNull()
    expect(unknown).toEqual(['goose'])
  })
})
