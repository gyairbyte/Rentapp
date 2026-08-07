import { describe, it, expect } from 'vitest'
import { generateRecurringDueDates } from './dates'

function rule(overrides: Partial<{ start_date: string; end_date: string | null; frequency: string; day_of_month: number }> = {}) {
  return {
    start_date: '2026-01-01',
    end_date: null,
    frequency: 'monthly',
    day_of_month: 1,
    ...overrides,
  }
}

describe('generateRecurringDueDates', () => {
  it('advances past old due dates when regenerating from a later date', () => {
    const today = new Date('2026-08-07T00:00:00Z')
    const dates = generateRecurringDueDates(rule(), '2026-08-07', today)

    expect(dates[0]).toBe('2026-09-01')
    expect(dates[1]).toBe('2026-10-01')
    expect(dates[2]).toBe('2026-11-01')
    expect(dates[dates.length - 1]).toMatch(/^2027-08-01$/)
  })

  it('includes the current-period due date when day_of_month is in the future relative to fromDate', () => {
    const today = new Date('2026-08-07T00:00:00Z')
    const dates = generateRecurringDueDates(rule({ day_of_month: 15 }), '2026-08-07', today)

    expect(dates[0]).toBe('2026-08-15')
    expect(dates[1]).toBe('2026-09-15')
  })

  it('generates the next future quarterly obligation from a past start date', () => {
    const today = new Date('2026-08-07T00:00:00Z')
    const dates = generateRecurringDueDates(
      rule({ start_date: '2026-01-01', frequency: 'quarterly', day_of_month: 1 }),
      '2026-08-07',
      today
    )

    expect(dates[0]).toBe('2026-10-01')
    expect(dates[1]).toBe('2027-01-01')
    expect(dates[2]).toBe('2027-04-01')
  })

  it('returns the same dates on repeated runs (idempotent)', () => {
    const today = new Date('2026-08-07T00:00:00Z')
    const first = generateRecurringDueDates(rule({ start_date: '2026-01-01' }), '2026-08-07', today)
    const second = generateRecurringDueDates(rule({ start_date: '2026-01-01' }), '2026-08-07', today)

    expect(first).toEqual(second)
  })

  it('starts at the rule start_date when no fromDate is provided', () => {
    const today = new Date('2026-08-07T00:00:00Z')
    const dates = generateRecurringDueDates(rule({ start_date: '2026-06-01' }), undefined, today)

    expect(dates[0]).toBe('2026-06-01')
    expect(dates[1]).toBe('2026-07-01')
    expect(dates[2]).toBe('2026-08-01')
  })

  it('does not generate due dates before the rule start_date', () => {
    const today = new Date('2026-08-07T00:00:00Z')
    const dates = generateRecurringDueDates(
      rule({ start_date: '2026-08-15', day_of_month: 1 }),
      undefined,
      today
    )

    expect(dates[0]).toBe('2026-09-01')
    expect(dates.every((d) => d >= '2026-08-15')).toBe(true)
  })

  it('respects an explicit end_date', () => {
    const today = new Date('2026-08-07T00:00:00Z')
    const dates = generateRecurringDueDates(
      rule({ end_date: '2026-12-15' }),
      undefined,
      today
    )

    expect(dates[dates.length - 1]).toBe('2026-12-01')
    expect(dates.every((d) => d <= '2026-12-15')).toBe(true)
  })
})
