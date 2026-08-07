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
