import { describe, it, expect } from 'vitest'
import { isRepairActive, isRepairResolved, RESOLVED_REPAIR_STATUSES } from './repairs'

describe('repair status helpers', () => {
  it('considers completed and closed as resolved', () => {
    expect(RESOLVED_REPAIR_STATUSES).toContain('completed')
    expect(RESOLVED_REPAIR_STATUSES).toContain('closed')
  })

  it('identifies active statuses', () => {
    expect(isRepairActive('reported')).toBe(true)
    expect(isRepairActive('evaluating')).toBe(true)
    expect(isRepairActive('assigned')).toBe(true)
    expect(isRepairActive('scheduled')).toBe(true)
  })

  it('identifies resolved statuses', () => {
    expect(isRepairResolved('completed')).toBe(true)
    expect(isRepairResolved('closed')).toBe(true)
    expect(isRepairActive('completed')).toBe(false)
    expect(isRepairActive('closed')).toBe(false)
  })
})
