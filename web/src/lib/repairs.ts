import { labelFor } from './utils'
import { REPAIR_STATUSES, REPAIR_PRIORITIES } from './constants'

export const RESOLVED_REPAIR_STATUSES: readonly string[] = ['completed', 'closed']

export function repairStatusLabel(status: string): string {
  return labelFor(status, REPAIR_STATUSES)
}

export function repairPriorityLabel(priority: string): string {
  return labelFor(priority, REPAIR_PRIORITIES)
}

export function isRepairResolved(status: string): boolean {
  return RESOLVED_REPAIR_STATUSES.includes(status)
}

export function isRepairActive(status: string): boolean {
  return !isRepairResolved(status)
}
