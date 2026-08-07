import type { PaymentOption } from '@/lib/types'

export const SELECTABLE_OPTION_TYPES = ['full', 'discounted', 'installment_plan'] as const

export function isSelectablePaymentOption(option: PaymentOption | null | undefined): boolean {
  return !!option && SELECTABLE_OPTION_TYPES.includes(option.option_type as (typeof SELECTABLE_OPTION_TYPES)[number])
}

export function getSelectablePaymentOptions(paymentOptions: PaymentOption[]) {
  return paymentOptions
    .map((option, originalIndex) => ({ option, originalIndex }))
    .filter(({ option }) => isSelectablePaymentOption(option))
}

export function getInitialSelectedPaymentOptionIndex(selectableOptions: { originalIndex: number }[]): number | null {
  if (selectableOptions.length === 1) {
    return selectableOptions[0].originalIndex
  }
  return null
}

export function getSelectableOptionsFingerprint(
  selectableOptions: { originalIndex: number; option: PaymentOption }[]
): string {
  return JSON.stringify(
    selectableOptions.map(({ originalIndex, option }) => ({
      originalIndex,
      option: {
        option_type: option.option_type,
        amount: option.amount,
        due_date: option.due_date,
        description: option.description,
        discount_amount: option.discount_amount,
        penalty_amount: option.penalty_amount,
        penalty_date: option.penalty_date,
        late_payment_terms: option.late_payment_terms.map((term) => ({
          term_type: term.term_type,
          amount: term.amount,
          due_date: term.due_date,
          effective_date: term.effective_date,
        })),
        installments: option.installments.map((inst) => ({
          amount: inst.amount,
          due_date: inst.due_date,
          description: inst.description,
          late_payment_terms: inst.late_payment_terms.map((term) => ({
            term_type: term.term_type,
            amount: term.amount,
            due_date: term.due_date,
            effective_date: term.effective_date,
          })),
        })),
      },
    }))
  )
}
