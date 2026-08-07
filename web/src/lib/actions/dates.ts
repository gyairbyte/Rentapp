export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  next.setUTCMonth(next.getUTCMonth() + months)
  return next
}

export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

export function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
}

export function getPeriodStart(frequency: string, year: number, month: number): Date {
  if (frequency === 'monthly') return new Date(Date.UTC(year, month, 1))
  if (frequency === 'quarterly') return new Date(Date.UTC(year, month - (month % 3), 1))
  if (frequency === 'semiannual') return new Date(Date.UTC(year, month < 6 ? 0 : 6, 1))
  if (frequency === 'annual') return new Date(Date.UTC(year, 0, 1))
  return new Date(Date.UTC(year, month, 1))
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

function computeDueDate(cursor: Date, dayOfMonth: number): string {
  const year = cursor.getUTCFullYear()
  const month = cursor.getUTCMonth()
  const day = Math.min(dayOfMonth, daysInMonth(year, month))
  const due = new Date(Date.UTC(year, month, day))
  return toISODate(due)
}

export function generateRecurringDueDates(
  rule: { start_date: string; end_date: string | null; frequency: string; day_of_month: number },
  fromDate: string | undefined,
  today: Date
): string[] {
  const monthsToAdd =
    rule.frequency === 'monthly'
      ? 1
      : rule.frequency === 'quarterly'
      ? 3
      : rule.frequency === 'semiannual'
      ? 6
      : 12

  const start = new Date(`${rule.start_date}T00:00:00Z`)
  const horizon = addMonths(today, 12)
  const end = rule.end_date ? new Date(`${rule.end_date}T00:00:00Z`) : horizon
  const limit = end < horizon ? end : horizon
  const limitDate = toISODate(limit)

  const startDate = toISODate(start)
  const minDate = fromDate && fromDate > startDate ? fromDate : startDate

  let cursor = new Date(start)
  let dueDate = computeDueDate(cursor, rule.day_of_month)

  // Advance to the first due date that is both >= start_date and >= fromDate.
  while (dueDate < startDate || dueDate < minDate) {
    cursor = addMonths(cursor, monthsToAdd)
    dueDate = computeDueDate(cursor, rule.day_of_month)
  }

  const dates: string[] = []
  while (dueDate <= limitDate) {
    dates.push(dueDate)
    cursor = addMonths(cursor, monthsToAdd)
    dueDate = computeDueDate(cursor, rule.day_of_month)
  }

  return dates
}
