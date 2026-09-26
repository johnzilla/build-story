import { describe, expect, it } from 'vitest'
import { BudgetExceededError, SpendBudget } from '../budget.js'

describe('request reservations', () => {
  it('counts in-flight requests before allowing another and stops after rejection', () => {
    const budget = new SpendBudget(1)
    const first = budget.reserve('first', 0.7)
    expect(() => budget.reserve('parallel', 0.4)).toThrow(BudgetExceededError)
    first.settle(0.1, 'usage')
    expect(() => budget.reserve('later', 0.1)).toThrow(BudgetExceededError)
  })
  it('replaces a reservation with reported usage and retains unknown outcomes', () => {
    const budget = new SpendBudget(1)
    budget.reserve('completed', 0.8).settle(0.2, 'usage')
    budget.reserve('lost response', 0.7)
    budget.reuse('cached audio')
    expect(budget.snapshot()).toEqual([
      { label: 'completed', usd: 0.2, basis: 'usage' },
      { label: 'lost response', usd: 0.7, basis: 'unknown' },
      { label: 'cached audio', usd: 0, basis: 'cached' },
    ])
    expect(() => budget.reserve('next', 0.2)).toThrow(BudgetExceededError)
  })
})
