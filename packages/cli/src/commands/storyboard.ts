import { constants } from 'node:fs'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { applyPronunciations, reviewStoryArc, renderSourceReview, sanitizeStoryArc, StoryArcSchema, TimelineSchema } from '@buildstory/core'
import { TTS_PRICE_PER_1000_CHARS } from '@buildstory/video/pricing'
import { loadConfig } from '../config.js'
import { checkVoice, checkSpeed, checkTtsModel, reportErrors, DEFAULT_VOICE, DEFAULT_SPEED, DEFAULT_TTS_MODEL } from '../validate.js'
import { storyboardPage, type StoryboardData } from '../storyboard-page.js'

export async function storyboardCommand(input: string, opts: {
  config?: string; output?: string; cacheDir?: string; timeline?: string; stills?: boolean; scene?: string;
}): Promise<void> {
  const inputDir = dirname(resolve(input))
  const config = loadConfig(inputDir, opts.config)
  const errors: string[] = []
  const voice = checkVoice(config.tts?.voice ?? DEFAULT_VOICE, errors)
  const speed = checkSpeed(config.tts?.speed ?? DEFAULT_SPEED, errors)
  const model = checkTtsModel(config.tts?.model ?? DEFAULT_TTS_MODEL, errors)
  reportErrors(errors)
  let arc = applyPronunciations(sanitizeStoryArc(StoryArcSchema.parse(JSON.parse(await readFile(resolve(input), 'utf8')))), config.tts?.pronunciations)
  if (!arc.beats.length) throw new Error('Storyboard requires at least one scene')
  if (opts.timeline) arc = sanitizeStoryArc(reviewStoryArc(arc, TimelineSchema.parse(JSON.parse(await readFile(resolve(opts.timeline), 'utf8')))))
  const selected = opts.scene === undefined ? undefined : Number(opts.scene) - 1
  if (selected !== undefined && (!Number.isInteger(selected) || selected < 0 || selected >= arc.beats.length)) throw new Error(`--scene must be a scene number from 1 to ${arc.beats.length}`)
  const outputDir = resolve(opts.output ?? join(inputDir, 'storyboard'))
  const { inspectSpeechCache, renderStoryboardStills } = await import('@buildstory/video')
  const inspected = await inspectSpeechCache(arc.beats, resolve(opts.cacheDir ?? inputDir), { voice, speed, model })
  // Reserve a fresh directory atomically. Never replace an existing review or input.
  await mkdir(dirname(outputDir), { recursive: true })
  try { await mkdir(outputDir, { mode: 0o700 }) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`Storyboard output already exists: ${outputDir}. Choose a new --output directory.`)
    throw error
  }
  const scenes: StoryboardData['scenes'] = []
  for (const scene of inspected) {
    const { audioPath, ...publicScene } = scene
    if (audioPath) {
      await mkdir(join(outputDir, 'audio'), { recursive: true })
      const audio = `audio/scene-${scene.beatIndex + 1}.wav`
      await copyFile(audioPath, join(outputDir, audio), constants.COPYFILE_EXCL)
      scenes.push({ ...publicScene, audio })
    } else scenes.push(publicScene)
  }
  if (opts.stills || selected !== undefined) {
    const frames = await renderStoryboardStills(arc, { outputDir: join(outputDir, 'frames'), durations: scenes.map(scene => scene.durationSeconds),
      ...(selected === undefined ? {} : { scenes: [selected] }), captions: config.render?.captions ?? true,
      showTitleCard: config.render?.titleCard ?? true, showStatsCard: config.render?.statsCard ?? true })
    for (const frame of frames) scenes[frame.beatIndex]!.image = `frames/scene-${frame.beatIndex + 1}.png`
  }
  await writeFile(join(outputDir, 'story-arc.json'), JSON.stringify(arc, null, 2), { flag: 'wx', mode: 0o600 })
  await writeFile(join(outputDir, 'source-review.md'), renderSourceReview(arc), { flag: 'wx', mode: 0o600 })
  await writeFile(join(outputDir, 'storyboard.html'), storyboardPage({ arc, scenes, voice, speed, model,
    pricePer1000: TTS_PRICE_PER_1000_CHARS[model], pronunciationConfigured: !!config.tts?.pronunciations }), { flag: 'wx', mode: 0o600 })
  console.log(`Storyboard: ${join(outputDir, 'storyboard.html')}\nEstimated additional Remotion TTS: $${scenes.reduce((sum, scene) => sum + scene.incrementalCostUSD, 0).toFixed(4)}\nNo paid calls made. Download edits from the page, then regenerate to refresh reviews and previews.`)
}
