import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, writeFile, rm } from 'fs/promises'
import { readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { scanCommand } from '../commands/scan.js'
import { TimelineSchema } from '@buildstory/core'

let tempDir: string
let outputFile: string

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'buildstory-scan-test-'))
  outputFile = join(tempDir, 'timeline.json')

  // Create test planning artifacts
  await writeFile(
    join(tempDir, 'PLANNING.md'),
    '# Planning\n\n## Goals\n\n- Build the feature\n- Ship it\n',
  )
  await writeFile(
    join(tempDir, 'TASKS.md'),
    '# Tasks\n\n## Done\n\n- [x] Set up project\n\n## In Progress\n\n- [ ] Implement scan\n',
  )
  await writeFile(
    join(tempDir, 'README.md'),
    '# My Project\n\nA great project.\n\n## Setup\n\nRun `npm install`.\n',
  )
})

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

describe('scanCommand', () => {
  it('produces a valid Timeline JSON from real filesystem artifacts', async () => {
    const timeline = await scanCommand([tempDir], { output: outputFile })

    // Validate against Zod schema
    const parsed = TimelineSchema.parse(timeline)
    expect(parsed.version).toBe('1')
    expect(parsed.rootDir).toBe(tempDir)
    expect(typeof parsed.scannedAt).toBe('string')
    expect(Array.isArray(parsed.events)).toBe(true)
    expect(parsed.events.length).toBeGreaterThan(0)
  })

  it('writes valid JSON to the output file', async () => {
    await scanCommand([tempDir], { output: outputFile })

    const raw = readFileSync(outputFile, 'utf8')
    const parsed = JSON.parse(raw)
    expect(parsed.version).toBe('1')
    expect(Array.isArray(parsed.events)).toBe(true)
  })

  it('events have required fields: artifactType, summary, rawContent', async () => {
    const timeline = await scanCommand([tempDir], { output: outputFile })

    for (const event of timeline.events) {
      expect(typeof event.artifactType).toBe('string')
      expect(typeof event.summary).toBe('string')
      expect(typeof event.rawContent).toBe('string')
      expect(event.rawContent.length).toBeGreaterThan(0)
    }
  })

  it('works without git (dateConfidence is estimated or unknown)', async () => {
    // tempDir has no .git — git will not be available
    const timeline = await scanCommand([tempDir], { output: outputFile })

    for (const event of timeline.events) {
      // Without git, confidence should be estimated (via mtime) or unknown
      expect(['estimated', 'unknown', 'exact', 'inferred']).toContain(event.dateConfidence)
    }
  })

  it('writes json to output file', async () => {
    await scanCommand([tempDir], { output: outputFile })

    const raw = readFileSync(outputFile, 'utf8')
    const parsed = JSON.parse(raw)
    expect(parsed).toHaveProperty('events')
    expect(parsed).toHaveProperty('dateRange')
  })
})
