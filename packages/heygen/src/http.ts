export async function consumeWithTimeout<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  consume: (response: Response, signal: AbortSignal) => Promise<T>,
): Promise<T> {
  // Manual controller + cleared timer (not AbortSignal.timeout) so no dangling
  // timer survives the request. Keep it active until body consumption finishes.
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, 'TimeoutError'))
  }, timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    try {
      return await consume(response, controller.signal)
    } finally {
      if (!response.bodyUsed) await response.body?.cancel().catch(() => {})
    }
  } finally {
    clearTimeout(timer)
  }
}
