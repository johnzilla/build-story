/** Covers the full SDK operation, including response parsing after headers. */
export async function withLLMDeadline<T>(request: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('LLM request timed out after 600s')), 600_000)
  try {
    return await request(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}
