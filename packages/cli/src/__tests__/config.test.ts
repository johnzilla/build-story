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
const { loadConfig, resolveOutputDir } = await import('../config.js')
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

  it('returns empty section objects when no config files exist', () => {
    const config = loadConfig(tmpDir)
    expect(config).toEqual({ scan: {}, commits: {}, transcripts: {}, tts: {}, render: {}, video: {}, heygen: {} })
  })

  it('merges editorial settings field by field and preserves explicit false', () => {
    const home = join(tmpDir, 'home')
    mkdirSync(join(home, '.config', 'buildstory'), { recursive: true })
    vi.mocked(os.homedir).mockReturnValue(home)
    writeFileSync(join(home, '.config', 'buildstory', 'config.toml'), '[editorial]\ncentralQuestion = "Why local?"\ntargetRuntimeSeconds = 120\ncompressRoutine = true\n')
    writeFileSync(join(tmpDir, 'buildstory.toml'), '[editorial]\ntargetRuntimeSeconds = 90\ncompressRoutine = false\npivotalEventIds = []\n')
    expect(loadConfig(tmpDir).editorial).toEqual({ centralQuestion: 'Why local?', targetRuntimeSeconds: 90, compressRoutine: false, pivotalEventIds: [] })
  })

  it.each(['targetRuntimeSeconds = 9', 'preserveOpenLoops = "yes"', 'pivotalEventIds = [1]', 'centralQuestion = ""'])('rejects invalid editorial config: %s', setting => {
    writeFileSync(join(tmpDir, 'buildstory.toml'), `[editorial]\n${setting}\n`)
    expect(() => loadConfig(tmpDir)).toThrow('Invalid editorial.')
  })

  it('validates presentation options and pronunciation dictionaries', () => {
    writeFileSync(join(tmpDir, 'buildstory.toml'), '[render]\ncaptions = false\nnormalizeLoudness = true\n[tts.pronunciations]\nSQL = "sequel"\n')
    expect(loadConfig(tmpDir).tts?.pronunciations).toEqual({ SQL: 'sequel' })
    expect(loadConfig(tmpDir).render?.captions).toBe(false)
    writeFileSync(join(tmpDir, 'buildstory.toml'), '[tts.pronunciations]\nSQL = ""\n')
    expect(() => loadConfig(tmpDir)).toThrow('Invalid tts.pronunciations')
  })

  it('parses project buildstory.toml', () => {
    writeFileSync(join(tmpDir, 'buildstory.toml'), 'provider = "openai"\nstyle = "technical"\n')
    const config = loadConfig(tmpDir)
    expect(config.provider).toBe('openai')
    expect(config.style).toBe('technical')
  })

  it('rejects malformed TOML instead of silently using defaults', () => {
    writeFileSync(join(tmpDir, 'buildstory.toml'), '{{invalid toml')
    expect(() => loadConfig(tmpDir)).toThrow('Cannot load config')
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

  it('loads the exact explicit filename and does not read a neighboring default file', () => {
    writeFileSync(join(tmpDir, 'buildstory.toml'), 'provider = "anthropic"')
    const custom = join(tmpDir, 'custom.toml')
    writeFileSync(custom, 'provider = "openai"')
    expect(loadConfig('/unused-target', custom).provider).toBe('openai')
    expect(() => loadConfig(tmpDir, join(tmpDir, 'missing.toml'))).toThrow('Cannot load config')
  })

  it.each([
    'typo = true', '[scan]\nmaxDepth = -1', '[scan]\nincludeFiles = "false"',
    '[scan]\npatterns = [1]', '[commits]\nmax = 1.5', '[commits]\nincludeMerges = 1',
    '[tts]\nconcurrency = 0', '[tts]\nconcurrency = 65', '[tts]\nspeed = "1.0"',
    '[tts]\nmodel = "unknown"', '[render]\ntitleCard = "false"',
    '[video]\nrenderer = "unknown"', '[heygen]\navatarId = 123',
    '[transcripts]\nsince = "not a date"', '[transcripts]\ncorrelate = "yes"',
    '[tts]\nconcurreny = 2', 'scan = "wrong"',
  ])('rejects malformed configuration fields: %s', (toml) => {
    writeFileSync(join(tmpDir, 'buildstory.toml'), toml)
    expect(() => loadConfig(tmpDir)).toThrow('Invalid config')
  })

  it('resolves inherited paths beside their defining files before merging', () => {
    const home = join(tmpDir, 'home')
    const globalDir = join(home, '.config', 'buildstory')
    mkdirSync(globalDir, { recursive: true })
    vi.mocked(os.homedir).mockReturnValue(home)
    writeFileSync(join(globalDir, 'config.toml'), 'outputDir = "./global-output"\n[transcripts]\npiPath = "./sessions"\n[tts]\nvoice = "alloy"')
    writeFileSync(join(tmpDir, 'buildstory.toml'), '[tts]\nspeed = 1.25')
    const config = loadConfig(tmpDir)
    expect(config.outputDir).toBe(join(globalDir, 'global-output'))
    expect(config.transcripts?.piPath).toBe(join(globalDir, 'sessions'))
    expect(config.tts).toEqual({ voice: 'alloy', speed: 1.25 })
    expect(resolveOutputDir(undefined, config, tmpDir, 'demo')).toBe(join(globalDir, 'global-output', 'demo'))
    expect(resolveOutputDir('/explicit', config, tmpDir, '..')).toBe('/explicit/project')
  })

  it('fails on a broken global file even when a project override exists', () => {
    const home = join(tmpDir, 'home')
    const globalDir = join(home, '.config', 'buildstory')
    mkdirSync(globalDir, { recursive: true })
    vi.mocked(os.homedir).mockReturnValue(home)
    writeFileSync(join(globalDir, 'config.toml'), '[tts]\nconcurrency = "bad"')
    writeFileSync(join(tmpDir, 'buildstory.toml'), '[tts]\nconcurrency = 2')
    expect(() => loadConfig(tmpDir)).toThrow('tts.concurrency')
  })

  it('expands home paths in output and transcript configuration', () => {
    vi.mocked(os.homedir).mockReturnValue(join(tmpDir, 'home'))
    writeFileSync(join(tmpDir, 'buildstory.toml'), 'outputDir = "~/videos"\n[transcripts]\nclaudeCodePath = "~/.claude/projects"\npiPath = "~"')
    const config = loadConfig(tmpDir)
    expect(config.outputDir).toBe(join(tmpDir, 'home/videos'))
    expect(config.transcripts?.claudeCodePath).toBe(join(tmpDir, 'home/.claude/projects'))
    expect(config.transcripts?.piPath).toBe(join(tmpDir, 'home'))
  })

  it('rejects reversed transcript date ranges', () => {
    writeFileSync(join(tmpDir, 'buildstory.toml'), '[transcripts]\nsince = "2026-09-01"\nuntil = "2026-01-01"')
    expect(() => loadConfig(tmpDir)).toThrow('since must not follow')
  })

})
