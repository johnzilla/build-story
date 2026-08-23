/**
 * Run async task thunks with a bounded concurrency limit, preserving input order
 * in the results. Tasks are executed in fixed-size batches; each batch is awaited
 * before the next starts.
 */
export async function withConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const effectiveLimit = Math.max(1, Math.floor(limit))
  const results: T[] = []
  for (let i = 0; i < tasks.length; i += effectiveLimit) {
    const batch = tasks.slice(i, i + effectiveLimit).map((fn) => fn())
    results.push(...(await Promise.all(batch)))
  }
  return results
}
