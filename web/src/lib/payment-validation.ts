import { formatDateOnly } from '@/lib/actions/dates'
import type { PaymentOption, PaymentTerm } from '@/lib/types'

export type InstallmentPlanValidationResult = {
  valid: boolean
  planTotalCents: number | null
  installmentTotalCents: number | null
  differenceCents: number | null
  planTotalFormatted: string
  installmentTotalFormatted: string
  differenceFormatted: string
  error: string | null
}

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isValidDateOnly(value: string | null | undefined): value is string {
  if (!value) return false
  const match = DATE_ONLY_RE.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function toCents(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    const scaled = value * 100
    const rounded = Math.round(scaled)
    // Reject amounts with precision finer than one cent instead of silently
    // rounding them into validity.
    if (Math.abs(scaled - rounded) > 0.0001) return null
    return rounded
  }

  const str = String(value).trim()
  if (!str) return null

  const match = str.match(/^-?(\d+)\.?(\d{0,2})$/)
  if (!match) return null

  const [, dollars, cents] = match
  const sign = str.startsWith('-') ? -1 : 1
  const centPart = cents.padEnd(2, '0').slice(0, 2)
  return sign * (Number(dollars) * 100 + Number(centPart))
}

export function formatCents(cents: number | null): string {
  if (cents === null) return ''
  const abs = Math.abs(cents)
  const dollars = Math.floor(abs / 100)
  const centPart = abs % 100
  return `${cents < 0 ? '-' : ''}$${dollars.toLocaleString('en-US')}.${String(centPart).padStart(2, '0')}`
}

export function formatCentsSigned(cents: number | null): string {
  if (cents === null) return ''
  if (cents === 0) return '$0.00'
  const sign = cents > 0 ? '+' : '-'
  return `${sign}${formatCents(cents).replace(/^-/, '')}`
}

export function roundCents(value: number): number {
  return Math.round(value)
}

type InstallmentLike = {
  amount: number | string | null
  due_date: string | null
  description?: string | null
  late_payment_terms?: PaymentTerm[]
}

type InstallmentPlanLike = {
  option_type: 'installment_plan'
  amount: number | string | null
  installments: InstallmentLike[] | null | undefined
  description?: string | null
  late_payment_terms?: PaymentTerm[]
}

export function validateInstallmentPlan(option: PaymentOption | InstallmentPlanLike | null | undefined): InstallmentPlanValidationResult {
  const empty: InstallmentPlanValidationResult = {
    valid: false,
    planTotalCents: null,
    installmentTotalCents: null,
    differenceCents: null,
    planTotalFormatted: '',
    installmentTotalFormatted: '',
    differenceFormatted: '',
    error: 'Not an installment plan',
  }

  if (!option || option.option_type !== 'installment_plan') {
    return empty
  }

  const planCents = toCents(option.amount)
  if (planCents === null || planCents <= 0) {
    return {
      ...empty,
      error: 'Plan amount must be a positive money value valid to cents',
    }
  }

  const installments = option.installments ?? []
  if (installments.length === 0) {
    return {
      ...empty,
      planTotalCents: planCents,
      planTotalFormatted: formatCents(planCents),
      error: 'Installment plan must contain at least one installment',
    }
  }

  let totalCents = 0

  for (let i = 0; i < installments.length; i++) {
    const inst = installments[i]
    const instCents = toCents(inst.amount)

    if (instCents === null || instCents <= 0) {
      return {
        ...empty,
        planTotalCents: planCents,
        planTotalFormatted: formatCents(planCents),
        error: `Installment ${i + 1} amount must be a positive money value valid to cents`,
      }
    }

    if (!isValidDateOnly(inst.due_date)) {
      return {
        ...empty,
        planTotalCents: planCents,
        planTotalFormatted: formatCents(planCents),
        error: `Installment ${i + 1} due date must be a valid date`,
      }
    }

    totalCents += instCents
  }

  const difference = totalCents - planCents
  const balanced = difference === 0

  return {
    valid: balanced,
    planTotalCents: planCents,
    installmentTotalCents: totalCents,
    differenceCents: difference,
    planTotalFormatted: formatCents(planCents),
    installmentTotalFormatted: formatCents(totalCents),
    differenceFormatted: formatCentsSigned(difference),
    error: balanced
      ? null
      : `Installment total ${formatCents(totalCents)} does not match plan total ${formatCents(planCents)} (difference ${formatCentsSigned(difference)})`,
  }
}

export function computeLatePaymentTotalCents(baseAmountCents: number, term: PaymentTerm): number | null {
  const termAmountCents = toCents(term.amount)

  if (termAmountCents !== null) {
    return termAmountCents
  }

  if (term.rate !== null && term.rate > 0 && baseAmountCents > 0) {
    const totalCents = baseAmountCents + roundCents(baseAmountCents * term.rate)
    return totalCents
  }

  return null
}

export function formatLatePaymentTerm(baseAmountCents: number, term: PaymentTerm): string {
  const parts: string[] = []

  if (term.term_type) parts.push(term.term_type.replace(/_/g, ' '))
  if (term.rate !== null && term.rate > 0) parts.push(`${(term.rate * 100).toFixed(0)}%`)

  const totalCents = computeLatePaymentTotalCents(baseAmountCents, term)
  if (totalCents !== null) {
    parts.push(formatCents(totalCents))
  } else if (term.amount !== null) {
    parts.push(formatCents(toCents(term.amount)))
  }

  if (term.effective_date) parts.push(`effective ${formatDateOnly(term.effective_date)}`)
  if (term.due_date) parts.push(`due ${formatDateOnly(term.due_date)}`)
  if (term.description) parts.push(term.description)

  return parts.filter(Boolean).join(' · ')
}
