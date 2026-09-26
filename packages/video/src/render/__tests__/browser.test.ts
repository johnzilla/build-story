import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoryArc } from '@buildstory/core'
import type { AudioManifest } from '../../tts/types.js'

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(), copyFile: vi.fn(), mkdir: vi.fn(),
}))
vi.mock('@remotion/bundler', () => ({ bundle: vi.fn().mockResolvedValue('/test-bundle') }))
vi.mock('@remotion/renderer', () => ({
  selectComposition: vi.fn().mockResolvedValue({ durationInFrames: 90 }),
  renderMedia: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../preflight.js', () => ({ findChrome: vi.fn() }))

import { bundle } from '@remotion/bundler'
import { selectComposition, renderMedia } from '@remotion/renderer'
import { findChrome } from '../../preflight.js'
import { renderVideo } from '../index.js'

const arc: StoryArc = {
  version: '1', beats: [], metadata: { generatedAt: '', style: 'story', sourceTimeline: 'test' },
}
const audio: AudioManifest = {
  scenes: [], totalDurationSeconds: 3, silenceGapSeconds: 0.3, bookendSilenceSeconds: 1,
}
const options = { outputPath: '/unused.mp4', srtPath: '/unused.srt' }

describe('installed-browser rendering policy', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes the explicit browser to selection and rendering', async () => {
    await renderVideo(arc, audio, { ...options, browserExecutable: '/installed/chrome' })
    expect(findChrome).not.toHaveBeenCalled()
    expect(selectComposition).toHaveBeenCalledWith(expect.objectContaining({ browserExecutable: '/installed/chrome' }))
    expect(renderMedia).toHaveBeenCalledWith(expect.objectContaining({ browserExecutable: '/installed/chrome' }))
  })

  it('discovers an installed browser for direct library callers', async () => {
    vi.mocked(findChrome).mockResolvedValue('/discovered/chrome')
    await renderVideo(arc, audio, options)
    expect(selectComposition).toHaveBeenCalledWith(expect.objectContaining({ browserExecutable: '/discovered/chrome' }))
    expect(renderMedia).toHaveBeenCalledWith(expect.objectContaining({ browserExecutable: '/discovered/chrome' }))
  })

  it('fails before bundling or rendering when no browser is installed', async () => {
    vi.mocked(findChrome).mockResolvedValue(null)
    await expect(renderVideo(arc, audio, options)).rejects.toThrow('automatic browser downloads are disabled')
    expect(bundle).not.toHaveBeenCalled()
    expect(selectComposition).not.toHaveBeenCalled()
    expect(renderMedia).not.toHaveBeenCalled()
  })
})
