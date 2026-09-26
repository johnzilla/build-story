import type { SpendBudget } from '@buildstory/core'
import { writeFile, unlink } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import OpenAI from 'openai'
import { DEFAULT_TTS_MODEL, ttsCostUSD, type TTSModel } from './pricing.js'
import { getFfmpegPath } from './ffmpeg.js'
import { truncateForTTS } from './truncate.js'
import { sanitizeOutboundText } from '@buildstory/core'

const execFileAsync = promisify(execFile)

/** Exact narration sent to TTS, also used by the offline render preview. */
export function prepareSpeechText(text: string): string {
  return truncateForTTS(sanitizeOutboundText(text))
}

interface GenerateOpts {
  budget?: SpendBudget | undefined
  voice: string
  speed: number
  /** OpenAI TTS model. Defaults to DEFAULT_TTS_MODEL. */
  model?: TTSModel
}

function isRateLimitError(err: unknown): boolean {
  return err instanceof Error && 'status' in err && (err as { status: number }).status === 429
}

export async function generateSceneAudio(
  client: OpenAI,
  text: string,
  outputPath: string,
  opts: GenerateOpts,
): Promise<void> {
  // If text exceeds the limit, truncate at the last sentence boundary that fits.
  const truncated = prepareSpeechText(text)

  const MAX_ATTEMPTS = 3
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const cost = ttsCostUSD(truncated.length, opts.model ?? DEFAULT_TTS_MODEL)
    const charge = opts.budget?.reserve('TTS request', cost)
    try {
      const response = await client.audio.speech.create({
        model: opts.model ?? DEFAULT_TTS_MODEL,
        voice: opts.voice as 'nova' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'shimmer',
        input: truncated,
        speed: opts.speed,
      }, { maxRetries: 0 })
      charge?.settle(cost, 'estimate')
      const buffer = Buffer.from(await response.arrayBuffer())

      // OpenAI returns MP3 which has encoder padding that clips the first syllable
      // in Remotion. Convert to WAV (PCM) which has zero padding.
      const tempMp3 = `${outputPath}.tmp.mp3`
      await writeFile(tempMp3, buffer)

      const ffmpegPath = getFfmpegPath()
      await execFileAsync(ffmpegPath, [
        '-y', '-i', tempMp3,
        '-acodec', 'pcm_s16le',
        '-ar', '24000',
        outputPath,
      ])

      await unlink(tempMp3).catch(() => {})
      return
    } catch (err: unknown) {
      if (isRateLimitError(err)) charge?.settle(0, 'estimate')
      if (attempt === MAX_ATTEMPTS) throw err
      if (isRateLimitError(err)) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000)) // 2s, 4s, 8s
      } else {
        throw err
      }
    }
  }
}
