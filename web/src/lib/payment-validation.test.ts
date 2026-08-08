import { describe, it, expect } from 'vitest'
import {
  toCents,
  formatCents,
  formatCentsSigned,
  validateInstallmentPlan,
  computeLatePaymentTotalCents,
  formatLatePaymentTerm,
} from './payment-validation'
import type { PaymentOption, PaymentTerm } from './types'

function installmentPlan(installments: { amount: number; due_date: string }[]): PaymentOption {
  return {
    option_type: 'installment_plan',
    amount: 1756.51,
    due_date: '2026-10-31',
    description: 'Four installment plan',
    discount_amount: null,
    penalty_amount: null,
    penalty_date: null,
    late_payment_terms: [],
    installments: installments.map((inst, i) => ({
      ...inst,
      description: `Installment ${i + 1} of ${installments.length}`,
      late_payment_terms: [],
    })),
  }
}

const unbalancedBethlehem = installmentPlan([
  { amount: 439.13, due_date: '2026-08-03' },
  { amount: 439.13, due_date: '2026-09-14' },
  { amount: 439.13, due_date: '2026-10-31' },
  { amount: 439.13, due_date: '2026-12-07' },
])

const correctedBethlehem = installmentPlan([
  { amount: 439.13, due_date: '2026-08-03' },
  { amount: 439.13, due_date: '2026-09-14' },
  { amount: 439.13, due_date: '2026-10-31' },
  { amount: 439.12, due_date: '2026-12-07' },
])

describe('toCents', () => {
  it('converts common money strings to exact cents', () => {
    expect(toCents('1756.51')).toBe(175651)
    expect(toCents('439.13')).toBe(43913)
    expect(toCents('439.12')).toBe(43912)
    expect(toCents('0')).toBe(0)
    expect(toCents('0.01')).toBe(1)
  })

  it('rejects more than two decimal places', () => {
    expect(toCents('1756.519')).toBeNull()
    expect(toCents('abc')).toBeNull()
    expect(toCents('')).toBeNull()
  })

  it('rounds number inputs safely to the nearest cent', () => {
    expect(toCents(1756.51)).toBe(175651)
    expect(toCents(439.13)).toBe(43913)
    expect(toCents(439.12)).toBe(43912)
    expect(toCents(0.295)).toBe(30)
  })
})

describe('formatCents', () => {
  it('formats cents with a dollar sign and two decimals', () => {
    expect(formatCents(175651)).toBe('$1,756.51')
    expect(formatCents(-100)).toBe('-$1.00')
    expect(formatCents(0)).toBe('$0.00')
  })
})

describe('formatCentsSigned', () => {
  it('includes an explicit sign except for zero', () => {
    expect(formatCentsSigned(1)).toBe('+$0.01')
    expect(formatCentsSigned(-1)).toBe('-$0.01')
    expect(formatCentsSigned(0)).toBe('$0.00')
  })
})

describe('validateInstallmentPlan', () => {
  it('reports $1,756.52 vs $1,756.51 as invalid with a +$0.01 difference', () => {
    const result = validateInstallmentPlan(unbalancedBethlehem)

    expect(result.valid).toBe(false)
    expect(result.planTotalFormatted).toBe('$1,756.51')
    expect(result.installmentTotalFormatted).toBe('$1,756.52')
    expect(result.differenceFormatted).toBe('+$0.01')
    expect(result.error).toContain('does not match plan total')
  })

  it('accepts $439.13 + $439.13 + $439.13 + $439.12 as exactly $1,756.51', () => {
    const result = validateInstallmentPlan(correctedBethlehem)

    expect(result.valid).toBe(true)
    expect(result.planTotalCents).toBe(175651)
    expect(result.installmentTotalCents).toBe(175651)
    expect(result.differenceCents).toBe(0)
    expect(result.differenceFormatted).toBe('$0.00')
    expect(result.error).toBeNull()
  })

  it('does not produce floating-point false mismatches for common cent values', () => {
    const option = installmentPlan([
      { amount: 0.1, due_date: '2026-08-01' },
      { amount: 0.2, due_date: '2026-09-01' },
    ])
    option.amount = 0.3

    const result = validateInstallmentPlan(option)
    expect(result.valid).toBe(true)
    expect(result.installmentTotalCents).toBe(30)
    expect(result.differenceCents).toBe(0)
  })

  it('rejects a missing plan amount', () => {
    const option = installmentPlan([{ amount: 100, due_date: '2026-08-01' }])
    option.amount = null

    const result = validateInstallmentPlan(option)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Plan amount')
  })

  it('rejects a nonpositive installment amount', () => {
    const option = installmentPlan([
      { amount: 100, due_date: '2026-08-01' },
      { amount: 0, due_date: '2026-09-01' },
    ])

    const result = validateInstallmentPlan(option)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Installment 2')
  })

  it('rejects an invalid installment due date', () => {
    const option = installmentPlan([{ amount: 100, due_date: '2026-13-01' }])

    const result = validateInstallmentPlan(option)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('due date')
  })

  it('rejects an empty installment list', () => {
    const option = installmentPlan([])

    const result = validateInstallmentPlan(option)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('at least one installment')
  })
})

describe('computeLatePaymentTotalCents', () => {
  it('computes a 10% late total for a $439.13 installment', () => {
    const term: PaymentTerm = { term_type: 'penalty', amount: null, rate: 0.1, effective_date: '2026-08-03', due_date: '2026-08-03', description: 'Late' }
    expect(computeLatePaymentTotalCents(43913, term)).toBe(48304)
  })

  it('computes a 10% late total for a $439.12 installment', () => {
    const term: PaymentTerm = { term_type: 'penalty', amount: null, rate: 0.1, effective_date: '2026-12-07', due_date: '2026-12-07', description: 'Late' }
    expect(computeLatePaymentTotalCents(43912, term)).toBe(48303)
  })

  it('uses the term amount when it is present', () => {
    const term: PaymentTerm = { term_type: 'penalty', amount: 1932.16, rate: 0.1, effective_date: '2026-10-31', due_date: '2026-10-31', description: 'Penalty' }
    expect(computeLatePaymentTotalCents(175651, term)).toBe(193216)
  })
})

describe('formatLatePaymentTerm', () => {
  it('renders a 10% late amount for a $439.12 installment as $483.03', () => {
    const term: PaymentTerm = { term_type: 'penalty', amount: null, rate: 0.1, effective_date: '2026-12-07', due_date: '2026-12-07', description: '10% penalty if late' }
    const formatted = formatLatePaymentTerm(43912, term)

    expect(formatted).toContain('10%')
    expect(formatted).toContain('$483.03')
    expect(formatted).not.toContain('$483.04')
  })
})
