import { labelFor } from './utils'
import { REPAIR_STATUSES, REPAIR_PRIORITIES } from './constants'

export function repairStatusLabel(status: string): string {
  return labelFor(status, REPAIR_STATUSES)
}

export function repairPriorityLabel(priority: string): string {
  return labelFor(priority, REPAIR_PRIORITIES)
}

export function isRepairActive(status: string): boolean {
  return status !== 'closed'
}
