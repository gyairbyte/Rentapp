import { describe, it, expect } from 'vitest'
import { calculatePaidDate, recalcObligation } from './utils'

describe('payment balance calculations', () => {
  it('calculates paid_date from chronologically sorted payments', () => {
    const obligation = {
      expectedAmount: 1000,
      dueDate: '2026-08-01',
      payments: [
        { amount: 400, payment_date: '2026-08-03' },
        { amount: 600, payment_date: '2026-08-08' },
      ],
    }

    const paidAmount = obligation.payments.reduce((sum, p) => sum + p.amount, 0)
    const status = recalcObligation(paidAmount, obligation.expectedAmount, obligation.dueDate, 'upcoming')
    const paidDate = calculatePaidDate(obligation.payments, obligation.expectedAmount)

    expect(paidAmount).toBe(1000)
    expect(status).toBe('paid')
    expect(paidDate).toBe('2026-08-08')
  })

  it('returns null paid_date for partial payments', () => {
    const payments = [
      { amount: 300, payment_date: '2026-08-03' },
      { amount: 200, payment_date: '2026-08-08' },
    ]

    const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0)
    const status = recalcObligation(paidAmount, 1000, '2026-08-01', 'upcoming')
    const paidDate = calculatePaidDate(payments, 1000)

    expect(status).toBe('partially_paid')
    expect(paidDate).toBeNull()
  })
})
