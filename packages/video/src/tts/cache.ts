import { createHash } from 'node:crypto'
import { copyFile, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export interface AudioRecord {
  sha256: string
  durationSeconds: number
}

/** Only the PCM format produced by our speech decoder is reusable. */
export function inspectWav(data: Buffer): AudioRecord | null {
  if (data.length < 44 || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') return null
  if (data.readUInt32LE(4) + 8 !== data.length) return null
  let format = false
  let samples = 0
  let offset = 12
  while (offset + 8 <= data.length) {
    const tag = data.toString('ascii', offset, offset + 4)
    const size = data.readUInt32LE(offset + 4)
    const start = offset + 8
    if (start + size > data.length) return null
    if (tag === 'fmt ') {
      if (format || size < 16 || data.readUInt16LE(start) !== 1 || data.readUInt16LE(start + 2) !== 1 ||
        data.readUInt32LE(start + 4) !== 24000 || data.readUInt32LE(start + 8) !== 48000 ||
        data.readUInt16LE(start + 12) !== 2 || data.readUInt16LE(start + 14) !== 16) return null
      format = true
    }
    if (tag === 'data') {
      if (samples || size === 0 || size % 2 !== 0) return null
      samples = size
    }
    offset = start + size + (size % 2)
  }
  if (!format || !samples || offset !== data.length) return null
  return { sha256: createHash('sha256').update(data).digest('hex'), durationSeconds: samples / 48000 }
}

export function isAudioRecord(value: unknown): value is AudioRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as AudioRecord
  return typeof record.sha256 === 'string' && /^[a-f0-9]{64}$/.test(record.sha256) &&
    Number.isFinite(record.durationSeconds) && record.durationSeconds > 0
}

export async function readAudio(path: string, expected?: AudioRecord): Promise<AudioRecord | null> {
  try {
    const info = await lstat(path)
    if (!info.isFile()) throw new Error(`Audio cache path is not a regular file: ${path}`)
    const record = inspectWav(await readFile(path))
    return record && (!expected || expected.sha256 === record.sha256) ? record : null
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

/** Same-filesystem rename ensures readers see either the previous file or all new bytes. */
export async function atomicWrite(path: string, data: string | Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = await mkdtemp(join(dirname(path), '.cache-'))
  try {
    const file = join(temporary, 'complete')
    await writeFile(file, data, { mode: 0o600, flush: true })
    await rename(file, path)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

export async function atomicCopy(source: string, destination: string): Promise<void> {
  const temporary = await mkdtemp(join(dirname(destination), '.cache-'))
  try {
    const file = join(temporary, 'complete.wav')
    await copyFile(source, file)
    await rename(file, destination)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

export function audioKey(text: string, opts: { voice: string; speed: number; model: string }): string {
  return createHash('sha256').update(JSON.stringify(['pcm-v3', opts.model, opts.voice, opts.speed, text])).digest('hex')
}
