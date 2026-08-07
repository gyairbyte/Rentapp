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
