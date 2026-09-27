import { execFile } from 'node:child_process'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoryArc } from '@buildstory/core'
import type { AudioManifest } from '../../tts/types.js'

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(), copyFile: vi.fn(), mkdir: vi.fn(),
  mkdtemp: vi.fn().mockResolvedValue('/staged'), rename: vi.fn(), rm: vi.fn(),
}))
vi.mock('node:child_process', () => ({
  execFile: vi.fn((_bin: string, _args: string[], callback: (error: Error | null, stdout: string, stderr: string) => void) => callback(null, '', '')),
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

  it('encodes AAC only during final MP4 assembly to preserve encoder-delay metadata', async () => {
    await renderVideo(arc, audio, { ...options, browserExecutable: '/installed/chrome' })
    const renderOptions = vi.mocked(renderMedia).mock.calls[0]![0]
    expect(renderOptions.audioCodec).toBe('pcm-16')
    expect(renderOptions.separateAudioTo).toBe('/staged/audio.wav')
    expect(execFile).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining([
      '-c:a', 'aac', '-c:v', 'copy', '/staged/audio.wav', '/staged/final.mp4',
    ]), expect.any(Function))
  })

  it('rejects mismatched scenes before starting browser or render work', async () => {
    const invalid = { ...audio, scenes: [{ beatIndex: 0, filePath: '/x.wav', durationSeconds: 1, startOffsetSeconds: 1 }] }
    await expect(renderVideo(arc, invalid, options)).rejects.toThrow('beat/scene count mismatch')
    expect(bundle).not.toHaveBeenCalled()
    expect(findChrome).not.toHaveBeenCalled()
    expect(renderMedia).not.toHaveBeenCalled()
  })

})
