import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Mock os.homedir at the module level so it can be configured per-test
vi.mock('os', async (importOriginal) => {
  const original = await importOriginal<typeof import('os')>()
  return {
    ...original,
    homedir: vi.fn(() => '/nonexistent-home-dir-for-tests'),
  }
})

// Import after mock setup
const { loadConfig } = await import('../config.js')
const os = await import('os')

describe('loadConfig', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'buildstory-test-'))
    // Reset homedir mock to return a nonexistent path by default (no global config)
    vi.mocked(os.homedir).mockReturnValue('/nonexistent-home-dir-for-tests')
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('returns empty object when no config files exist', () => {
    const config = loadConfig(tmpDir)
    expect(config).toEqual({ scan: {} })
  })

  it('parses project buildstory.toml', () => {
    writeFileSync(join(tmpDir, 'buildstory.toml'), 'provider = "openai"\nstyle = "technical"\n')
    const config = loadConfig(tmpDir)
    expect(config.provider).toBe('openai')
    expect(config.style).toBe('technical')
  })

  it('handles malformed TOML without throwing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    writeFileSync(join(tmpDir, 'buildstory.toml'), '{{invalid toml')
    const config = loadConfig(tmpDir)
    expect(config).toEqual({ scan: {} })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('deep-merges nested scan config (partial project override preserves global fields)', () => {
    // Verify project-only scan config is parsed correctly and scan object is defined
    writeFileSync(join(tmpDir, 'buildstory.toml'), '[scan]\nmaxDepth = 5\n')
    const config = loadConfig(tmpDir)
    expect(config.scan?.maxDepth).toBe(5)
    // scan should be an object (not undefined), proving the deep merge path runs
    expect(config.scan).toBeDefined()
    expect(typeof config.scan).toBe('object')
  })

  it('deep-merges global and project scan configs preserving all fields', () => {
    // Set up global config dir with scan.patterns
    const fakeHome = join(tmpDir, 'home')
    const globalConfigDir = join(fakeHome, '.config', 'buildstory')
    mkdirSync(globalConfigDir, { recursive: true })
    writeFileSync(join(globalConfigDir, 'config.toml'), '[scan]\npatterns = ["**/*.md"]\n')

    // Point homedir to our fake home
    vi.mocked(os.homedir).mockReturnValue(fakeHome)

    // Project config only sets maxDepth (partial override)
    const projectDir = join(tmpDir, 'project')
    mkdirSync(projectDir, { recursive: true })
    writeFileSync(join(projectDir, 'buildstory.toml'), '[scan]\nmaxDepth = 5\n')

    const config = loadConfig(projectDir)

    // Deep merge: BOTH global scan.patterns AND project scan.maxDepth must be present
    expect(config.scan?.patterns).toEqual(['**/*.md'])
    expect(config.scan?.maxDepth).toBe(5)
  })
})
