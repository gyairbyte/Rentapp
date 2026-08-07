import { describe, it, expect } from 'vitest'
import {
  isSelectablePaymentOption,
  getSelectablePaymentOptions,
  getInitialSelectedPaymentOptionIndex,
  getSelectableOptionsFingerprint,
  SELECTABLE_OPTION_TYPES,
} from './payment-options'
import type { PaymentOption } from './types'

function option(overrides: Partial<PaymentOption> & { option_type: PaymentOption['option_type'] }): PaymentOption {
  return {
    option_type: overrides.option_type,
    amount: overrides.amount ?? null,
    due_date: overrides.due_date ?? null,
    description: overrides.description ?? null,
    discount_amount: overrides.discount_amount ?? null,
    penalty_amount: overrides.penalty_amount ?? null,
    penalty_date: overrides.penalty_date ?? null,
    late_payment_terms: overrides.late_payment_terms ?? [],
    installments: overrides.installments ?? [],
  }
}

describe('isSelectablePaymentOption', () => {
  it.each([
    ['full', true],
    ['discounted', true],
    ['installment_plan', true],
    ['other', false],
    ['penalty', false],
    ['late_fee', false],
  ] as const)('option_type %s selectable: %s', (optionType, expected) => {
    expect(isSelectablePaymentOption(option({ option_type: optionType }))).toBe(expected)
  })
})

describe('getSelectablePaymentOptions', () => {
  it('returns only selectable options with original indexes', () => {
    const options: PaymentOption[] = [
      option({ option_type: 'discounted', description: 'Discount' }),
      option({ option_type: 'penalty', description: 'Penalty' }),
      option({ option_type: 'full', description: 'Full' }),
      option({ option_type: 'late_fee', description: 'Late fee' }),
      option({ option_type: 'installment_plan', description: 'Installments' }),
    ]
    const selectable = getSelectablePaymentOptions(options)
    expect(selectable).toHaveLength(3)
    expect(selectable[0].originalIndex).toBe(0)
    expect(selectable[1].originalIndex).toBe(2)
    expect(selectable[2].originalIndex).toBe(4)
  })

  it('returns an empty array when no options are selectable', () => {
    const options: PaymentOption[] = [
      option({ option_type: 'penalty' }),
      option({ option_type: 'late_fee' }),
    ]
    expect(getSelectablePaymentOptions(options)).toHaveLength(0)
  })
})

describe('getInitialSelectedPaymentOptionIndex', () => {
  it('selects the first and only option when there is exactly one selectable option', () => {
    expect(getInitialSelectedPaymentOptionIndex([{ originalIndex: 3 }])).toBe(3)
  })

  it('does not preselect an option when multiple selectable options exist', () => {
    expect(getInitialSelectedPaymentOptionIndex([{ originalIndex: 0 }, { originalIndex: 2 }])).toBeNull()
  })

  it('does not preselect an option when no selectable options exist', () => {
    expect(getInitialSelectedPaymentOptionIndex([])).toBeNull()
  })
})

describe('SELECTABLE_OPTION_TYPES', () => {
  it('contains only genuine user-selectable payment paths', () => {
    expect(SELECTABLE_OPTION_TYPES).toEqual(['full', 'discounted', 'installment_plan'])
  })
})

describe('getSelectableOptionsFingerprint', () => {
  it('is stable for identical selectable option sets', () => {
    const options: PaymentOption[] = [
      option({ option_type: 'discounted', amount: 1703.81, due_date: '2026-08-31' }),
      option({ option_type: 'full', amount: 1756.51, due_date: '2026-10-31' }),
    ]
    const selectable = getSelectablePaymentOptions(options)
    const first = getSelectableOptionsFingerprint(selectable)
    const second = getSelectableOptionsFingerprint(getSelectablePaymentOptions(options))
    expect(first).toBe(second)
  })

  it('changes when option amounts or dates change', () => {
    const base = getSelectableOptionsFingerprint(
      getSelectablePaymentOptions([option({ option_type: 'full', amount: 1756.51, due_date: '2026-10-31' })])
    )
    const changed = getSelectableOptionsFingerprint(
      getSelectablePaymentOptions([option({ option_type: 'full', amount: 1800, due_date: '2026-10-31' })])
    )
    expect(changed).not.toBe(base)
  })

  it('changes when option order changes', () => {
    const a = option({ option_type: 'discounted', amount: 1703.81, due_date: '2026-08-31' })
    const b = option({ option_type: 'full', amount: 1756.51, due_date: '2026-10-31' })
    const first = getSelectableOptionsFingerprint(getSelectablePaymentOptions([a, b]))
    const second = getSelectableOptionsFingerprint(getSelectablePaymentOptions([b, a]))
    expect(second).not.toBe(first)
  })

  it('changes when installment details change', () => {
    const base = option({
      option_type: 'installment_plan',
      amount: 1756.51,
      due_date: '2026-10-31',
      installments: [{ amount: 439.13, due_date: '2026-08-03', description: 'Installment 1', late_payment_terms: [] }],
    })
    const changed = option({
      option_type: 'installment_plan',
      amount: 1756.51,
      due_date: '2026-10-31',
      installments: [{ amount: 440, due_date: '2026-08-03', description: 'Installment 1', late_payment_terms: [] }],
    })
    const baseFingerprint = getSelectableOptionsFingerprint(getSelectablePaymentOptions([base]))
    const changedFingerprint = getSelectableOptionsFingerprint(getSelectablePaymentOptions([changed]))
    expect(changedFingerprint).not.toBe(baseFingerprint)
  })
})
