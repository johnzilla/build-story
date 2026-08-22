export const SECRET_PATTERNS: Array<[RegExp, string]> = [
  // Multi-line PEM private key blocks (any key type)
  [
    /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g,
    '[REDACTED]',
  ],
  // Anthropic API keys (more specific — must be before generic sk- pattern)
  [/sk-ant-[A-Za-z0-9\-_]{20,}/g, '[REDACTED]'],
  // Stripe live secret/restricted keys (underscore form — before sk- hyphen form)
  [/(?:sk|rk)_live_[0-9A-Za-z]{16,}/g, '[REDACTED]'],
  // OpenAI API keys (sk- prefix, including sk-proj- variants)
  [/sk-[A-Za-z0-9\-_]{20,}/g, '[REDACTED]'],
  // AWS Access Key IDs
  [/AKIA[0-9A-Z]{16}/g, '[REDACTED]'],
  // AWS Secret Access Keys in env assignments
  [/(AWS_SECRET_ACCESS_KEY\s*=\s*)[^\s'"]+/gi, '$1[REDACTED]'],
  // Slack tokens (bot/user/app/refresh/legacy)
  [/xox[baprs]-[A-Za-z0-9-]{10,}/g, '[REDACTED]'],
  // Google API keys
  [/AIza[0-9A-Za-z_-]{35}/g, '[REDACTED]'],
  // npm access tokens
  [/npm_[A-Za-z0-9]{36}/g, '[REDACTED]'],
  // GitHub Personal Access Tokens
  [/ghp_[A-Za-z0-9]{36}/g, '[REDACTED]'],
  [/github_pat_[A-Za-z0-9_]{82}/g, '[REDACTED]'],
  // JSON Web Tokens (three base64url segments)
  [/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, '[REDACTED]'],
  // Bearer tokens
  [/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, '$1[REDACTED]'],
  // Basic auth credentials
  [/(Basic\s+)[A-Za-z0-9+/]{20,}={0,2}/gi, '$1[REDACTED]'],
  // Generic secret assignments — snake_case, camelCase, or spaced
  // (api_key / apiKey / apikey, access_token / accessToken, secret, token, password, …)
  [
    /((?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|secret[_-]?key|client[_-]?secret|token|secret|password|passwd|pwd)\s*[=:]\s*["']?)[^\s"',]+/gi,
    '$1[REDACTED]',
  ],
]

export function redactSecrets(content: string): string {
  let redacted = content
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, replacement)
  }
  return redacted
}
