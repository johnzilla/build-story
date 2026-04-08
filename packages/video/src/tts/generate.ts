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
  // Prepend a brief SSML-style pause to avoid MP3 encoder padding clipping the first syllable.
  // OpenAI TTS treats "..." as a natural pause (~200ms) which gives the decoder enough lead-in.
  const padded = `... ${text}`

  // If text exceeds limit, truncate at last sentence boundary under limit
  const truncated = padded.length > MAX_TTS_CHARS
    ? padded.slice(0, padded.lastIndexOf('.', MAX_TTS_CHARS) + 1) || padded.slice(0, MAX_TTS_CHARS)
    : padded

  const MAX_ATTEMPTS = 3
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.audio.speech.create({
        model: 'tts-1-hd',
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
