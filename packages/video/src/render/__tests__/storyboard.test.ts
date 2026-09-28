import { expect, it, vi } from 'vitest'
import type { StoryArc } from '@buildstory/core'
vi.mock('@remotion/bundler', () => ({ bundle: vi.fn(async () => 'local-bundle') }))
vi.mock('@remotion/renderer', () => ({ selectComposition: vi.fn(async () => ({ id: 'BuildStory' })), renderStill: vi.fn(async () => {}) }))
vi.mock('node:fs/promises', async original => ({ ...await original<typeof import('node:fs/promises')>(), mkdir: vi.fn() }))
import { renderStill, selectComposition } from '@remotion/renderer'
import { renderStoryboardStills } from '../storyboard.js'
const arc: StoryArc = { version: '1', beats: ['Opening', 'Decision', 'Outcome'].map(title => ({ type: 'idea', title, summary: 'Some narration', evidence: [], sourceEventIds: [], significance: 2 })), metadata: { generatedAt: '', style: 'story', sourceTimeline: 'project' } }
it('renders selected scenes in full context with silent composition props', async () => {
  const result = await renderStoryboardStills(arc, { outputDir: '/tmp/test-storyboard', durations: [2, 3, 4], scenes: [1], browserExecutable: '/test/chrome' })
  expect(result).toEqual([{ beatIndex: 1, filePath: '/tmp/test-storyboard/scene-2.png' }])
  expect(selectComposition).toHaveBeenCalledWith(expect.objectContaining({ inputProps: expect.objectContaining({ silentPreview: true, storyArc: expect.objectContaining({ beats: expect.arrayContaining(arc.beats) }) }) }))
  expect(renderStill).toHaveBeenCalledWith(expect.objectContaining({ frame: 141, inputProps: expect.objectContaining({ silentPreview: true }) }))
})
it('rejects invalid indices and durations before rendering', async () => {
  await expect(renderStoryboardStills(arc, { outputDir: '/tmp/test-storyboard', durations: [2, 3, 4], scenes: [3] })).rejects.toThrow('index')
  await expect(renderStoryboardStills(arc, { outputDir: '/tmp/test-storyboard', durations: [2, 0, 4] })).rejects.toThrow('positive')
})
