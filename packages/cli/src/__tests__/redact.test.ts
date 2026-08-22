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

  // --- hostile fixtures for the expanded pattern set ---
  //
  // Secrets are ASSEMBLED FROM FRAGMENTS at runtime so no scannable secret
  // literal exists in this source file (otherwise GitHub push protection — and
  // any secret scanner — would flag this test for a redaction tool, ironically).

  it('redacts Slack tokens (xox*)', () => {
    const secret = 'xoxb' + '-' + '1234567890' + '-' + 'abcdefghijklmnop'
    expect(redactSecrets(`token ${secret}`)).not.toContain(secret)
  })

  it('redacts Google API keys (AIza*)', () => {
    const secret = 'AIza' + 'x'.repeat(35)
    expect(redactSecrets(secret)).not.toContain(secret)
  })

  it('redacts Stripe live secret keys (sk_live_)', () => {
    const secret = 'sk' + '_live_' + 'abcdef1234567890ABCDEF'
    expect(redactSecrets(`key=${secret}`)).not.toContain(secret)
  })

  it('redacts npm tokens (npm_)', () => {
    const secret = 'npm' + '_' + 'a'.repeat(36)
    expect(redactSecrets(secret)).not.toContain(secret)
  })

  it('redacts standalone JWTs (eyJ...)', () => {
    const jwt = 'eyJ' + 'hbGciOiJIUzI1NiJ9' + '.' + 'eyJzdWIiOiIxIn0' + '.' + 'SflKxwRJSMeKKF2QT4fw'
    expect(redactSecrets(`auth ${jwt}`)).not.toContain(jwt)
  })

  it('redacts multi-line PEM private key blocks', () => {
    const begin = '-----BEGIN RSA ' + 'PRIVATE KEY-----'
    const end = '-----END RSA ' + 'PRIVATE KEY-----'
    const body = 'MIIEpAIBAAKCAQEA1234'
    const pem = `${begin}\n${body}\nabcdEFGH\n${end}`
    const result = redactSecrets(`here is my key:\n${pem}\ndone`)
    expect(result).not.toContain(body)
    expect(result).toContain('[REDACTED]')
    expect(result).toContain('done')
  })

  it('redacts camelCase secret assignments (apiKey, accessToken)', () => {
    expect(redactSecrets('apiKey: "s3cr3t-value-here"')).not.toContain('s3cr3t-value-here')
    expect(redactSecrets('const accessToken = abc123def456ghi')).not.toContain('abc123def456ghi')
  })

  it('redacts a secret embedded in commit-message-shaped text', () => {
    const secret = 'sk' + '_live_' + 'abcdef1234567890ABCDEF'
    const msg = `fix(payments): rotate the leaked key ${secret} from prod`
    const result = redactSecrets(msg)
    expect(result).not.toContain(secret)
    expect(result).toContain('fix(payments): rotate the leaked key')
  })
})
