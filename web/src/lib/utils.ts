import { type ZodError } from 'zod'
import { toISODate, addDays } from './actions/dates'
import { toCents } from './payment-validation'

export function getURL() {
  let url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    'http://localhost:3000'
  url = url.startsWith('http') ? url : `https://${url}`
  return url.replace(/\/$/, '')
}

export function formatZodErrors(error: ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'root'
    result[path] = result[path] ?? []
    result[path].push(issue.message)
  }
  return result
}

export function labelFor(value: string, options: { value: string; label: string }[]) {
  return options.find((o) => o.value === value)?.label ?? value.replace(/_/g, ' ')
}

function toMoneyCents(amount: number | string | null | undefined): number {
  return toCents(amount ?? 0) ?? 0
}

export function recalcObligation(
  paidAmount: number,
  expectedAmount: number,
  dueDate: string,
  currentStatus: string
): string {
  if (['canceled', 'waived', 'disputed'].includes(currentStatus)) {
    return currentStatus
  }

  const paidCents = toMoneyCents(paidAmount)
  const expectedCents = toMoneyCents(expectedAmount)

  if (paidCents >= expectedCents) return 'paid'
  if (paidCents > 0) return 'partially_paid'

  const today = toISODate(new Date())
  if (dueDate < today) return 'overdue'
  if (dueDate <= toISODate(addDays(new Date(), 7))) return 'due'
  return 'upcoming'
}

export function calculatePaidDate(
  payments: { amount: number; payment_date: string }[],
  expectedAmount: number
): string | null {
  const sorted = [...payments].sort((a, b) => a.payment_date.localeCompare(b.payment_date))
  const expectedCents = toMoneyCents(expectedAmount)
  let cumulative = 0
  for (const payment of sorted) {
    cumulative += toMoneyCents(payment.amount)
    if (cumulative >= expectedCents) {
      return payment.payment_date
    }
  }
  return null
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes < 0) return 'Unknown size'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
