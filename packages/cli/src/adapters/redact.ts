export const SECRET_PATTERNS: Array<[RegExp, string]> = [
  // Anthropic API keys (more specific — must be before generic sk- pattern)
  [/sk-ant-[A-Za-z0-9\-_]{20,}/g, '[REDACTED]'],
  // OpenAI API keys (sk- prefix, including sk-proj- variants)
  [/sk-[A-Za-z0-9\-_]{20,}/g, '[REDACTED]'],
  // AWS Access Key IDs
  [/AKIA[0-9A-Z]{16}/g, '[REDACTED]'],
  // AWS Secret Access Keys in env assignments
  [/(AWS_SECRET_ACCESS_KEY\s*=\s*)[^\s'"]+/gi, '$1[REDACTED]'],
  // Generic env var assignments with secret/api_key/token/password
  [/((?:secret|api_key|token|password|passwd|pwd)\s*[=:]\s*["']?)[^\s"']+/gi, '$1[REDACTED]'],
  // Bearer tokens
  [/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, '$1[REDACTED]'],
  // Basic auth credentials
  [/(Basic\s+)[A-Za-z0-9+/]{20,}={0,2}/gi, '$1[REDACTED]'],
  // GitHub Personal Access Tokens
  [/ghp_[A-Za-z0-9]{36}/g, '[REDACTED]'],
  [/github_pat_[A-Za-z0-9_]{82}/g, '[REDACTED]'],
]

export function redactSecrets(content: string): string {
  let redacted = content
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, replacement)
  }
  return redacted
}
