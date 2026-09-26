import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

/** Never overwrite an input file or make a potentially sensitive preview public. */
export async function writePayloadPreview(filePath: string, preview: unknown): Promise<void> {
  const destination = resolve(filePath)
  await writeFile(destination, JSON.stringify(preview, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
    flag: 'wx',
  })
  console.log(`Payload preview saved to ${destination}. No API calls made.`)
}
