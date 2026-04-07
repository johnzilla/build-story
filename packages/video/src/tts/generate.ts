import { writeFile } from 'node:fs/promises'
import OpenAI from 'openai'

interface GenerateOpts {
  voice: string
  speed: number
}

// 4096 char hard limit per OpenAI TTS request. Use 3900 as safe buffer.
const MAX_TTS_CHARS = 3900

function isRateLimitError(err: unknown): boolean {
  return err instanceof Error && 'status' in err && (err as { status: number }).status === 429
}

export async function generateSceneAudio(
  client: OpenAI,
  text: string,
  outputPath: string,
  opts: GenerateOpts,
): Promise<void> {
  // If text exceeds limit, truncate at last sentence boundary under limit
  const truncated = text.length > MAX_TTS_CHARS
    ? text.slice(0, text.lastIndexOf('.', MAX_TTS_CHARS) + 1) || text.slice(0, MAX_TTS_CHARS)
    : text

  const MAX_ATTEMPTS = 3
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.audio.speech.create({
        model: 'tts-1',
        voice: opts.voice as 'nova' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'shimmer',
        input: truncated,
        speed: opts.speed,
      })
      const buffer = Buffer.from(await response.arrayBuffer())
      await writeFile(outputPath, buffer)
      return
    } catch (err: unknown) {
      if (attempt === MAX_ATTEMPTS) throw err
      if (isRateLimitError(err)) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000)) // 2s, 4s, 8s
      } else {
        throw err
      }
    }
  }
}
