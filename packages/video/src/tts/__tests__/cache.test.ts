import { expect, it } from 'vitest'
import { inspectWav } from '../cache.js'
import { wav } from './wav-fixture.js'

it('derives duration from PCM bytes, not untrusted manifest metadata', () => {
  expect(inspectWav(wav(1.25))).toMatchObject({ durationSeconds: 1.25, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) })
})
it.each(['empty', 'truncated', 'wrong rate', 'wrong format', 'zero audio', 'trailing garbage'])('rejects %s audio', fault => {
  let data = wav()
  if (fault === 'empty') data = Buffer.alloc(0)
  if (fault === 'truncated') data = data.subarray(0, 100)
  if (fault === 'wrong rate') data.writeUInt32LE(1, 24)
  if (fault === 'wrong format') data.writeUInt16LE(3, 20)
  if (fault === 'zero audio') data = wav(0)
  if (fault === 'trailing garbage') data = Buffer.concat([data, Buffer.from('garbage')])
  expect(inspectWav(data)).toBeNull()
})
