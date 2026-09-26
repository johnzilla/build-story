/** Per-run accounting. Reservations are synchronous, including concurrent calls. */
export class BudgetExceededError extends Error {
  constructor(label: string, limit: number, committed: number, next: number) {
    super(`Stopping before ${label}: would exceed --max-cost $${limit.toFixed(4)} (accounted $${committed.toFixed(4)} + reserved $${next.toFixed(4)}). Partial results kept.`)
    this.name = 'BudgetExceededError'
  }
}

type Basis = 'usage' | 'estimate' | 'unknown' | 'cached'
export interface SpendEntry { label: string; usd: number; basis: Basis }

export class SpendBudget {
  private entries: SpendEntry[] = []
  private stopped = false
  constructor(readonly limit?: number) {
    if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) throw new Error('Budget must be positive and finite')
  }
  reuse(label: string): void { this.entries.push({ label, usd: 0, basis: 'cached' }) }
  snapshot(): SpendEntry[] { return this.entries.map((entry) => ({ ...entry })) }
  reserve(label: string, usd: number) {
    if (!Number.isFinite(usd) || usd < 0) throw new Error('Invalid request cost')
    const total = this.entries.reduce((sum, entry) => sum + entry.usd, 0)
    if (this.stopped || (this.limit !== undefined && total + usd > this.limit)) {
      this.stopped = true
      throw new BudgetExceededError(label, this.limit ?? total, total, usd)
    }
    // A thrown request leaves its reservation as unknown: it may have been billed.
    const entry: SpendEntry = { label, usd, basis: 'unknown' }
    this.entries.push(entry)
    return {
      settle: (cost: number, basis: Exclude<Basis, 'unknown'>) => {
        if (!Number.isFinite(cost) || cost < 0) throw new Error('Invalid settled cost')
        entry.usd = cost
        entry.basis = basis
      },
    }
  }
}
