import { describe, it, expect } from 'vitest'
import { resolveEditorial } from '../editorial.js'

describe('editorial CLI precedence', () => {
  it('overrides only supplied flags and preserves explicit false settings', () => {
    expect(resolveEditorial({ centralQuestion: 'Configured?', targetRuntimeSeconds: 120, compressRoutine: false, preserveOpenLoops: false, pivotalEventIds: ['old'] }, { question: 'New focus?', targetRuntime: '90', pivotalEvents: ['c1'] })).toEqual({ centralQuestion: 'New focus?', targetRuntimeSeconds: 90, compressRoutine: false, preserveOpenLoops: false, pivotalEventIds: ['c1'] })
  })
  it('leaves absent briefs undefined and permits clearing configured pivotal IDs', () => {
    expect(resolveEditorial(undefined, {})).toBeUndefined()
    expect(resolveEditorial({ pivotalEventIds: ['old'] }, { pivotalEvents: [] })?.pivotalEventIds).toEqual([])
  })
  it.each(['', 'abc', '60seconds', '-20', '2.5', 'Infinity', '3601'])('rejects invalid CLI runtime %j', targetRuntime => {
    expect(() => resolveEditorial(undefined, { targetRuntime })).toThrow()
  })
  it('rejects empty questions and too many pivotal IDs', () => {
    expect(() => resolveEditorial(undefined, { question: '  ' })).toThrow()
    expect(() => resolveEditorial(undefined, { pivotalEvents: Array(21).fill('c1') })).toThrow()
  })
})
