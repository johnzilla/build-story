import { describe, it, expect } from 'vitest'
import { redactSecrets, SECRET_PATTERNS } from '../adapters/redact.js'

describe('redactSecrets', () => {
  it('redacts OpenAI API keys (sk- prefix)', () => {
    const result = redactSecrets('sk-abc123def456ghi789jkl012')
    expect(result).toBe('[REDACTED]')
  })

  it('redacts Anthropic API keys (sk-ant- prefix)', () => {
    const result = redactSecrets('sk-ant-abc123def456ghi789jkl012')
    expect(result).toBe('[REDACTED]')
  })

  it('redacts AWS Access Key IDs (AKIA prefix)', () => {
    const result = redactSecrets('AKIA1234567890ABCDEF')
    expect(result).toBe('[REDACTED]')
  })

  it('redacts generic env var assignments with API_KEY', () => {
    const result = redactSecrets('API_KEY=my-secret-value')
    expect(result).toContain('[REDACTED]')
    expect(result).not.toContain('my-secret-value')
  })

  it('redacts GitHub Personal Access Tokens (ghp_ prefix)', () => {
    const result = redactSecrets('ghp_abc123def456ghi789jkl012mno345pqr678')
    expect(result).toBe('[REDACTED]')
  })

  it('redacts Bearer tokens', () => {
    const result = redactSecrets('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    expect(result).toContain('[REDACTED]')
    expect(result).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
  })

  it('leaves normal text without secrets unchanged', () => {
    const text = 'Normal text without secrets'
    expect(redactSecrets(text)).toBe(text)
  })

  it('leaves markdown headings and content unchanged', () => {
    const text = '# Heading\nSome content'
    expect(redactSecrets(text)).toBe(text)
  })

  it('exports SECRET_PATTERNS array', () => {
    expect(Array.isArray(SECRET_PATTERNS)).toBe(true)
    expect(SECRET_PATTERNS.length).toBeGreaterThan(0)
  })

  it('redacts key embedded in a larger config string', () => {
    const config = 'OPENAI_API_KEY=sk-proj-abc123def456ghi789jkl012\nsome=other'
    const result = redactSecrets(config)
    expect(result).not.toContain('sk-proj-abc123def456ghi789jkl012')
  })
})
