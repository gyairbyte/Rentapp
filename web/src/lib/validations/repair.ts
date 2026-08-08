import { z } from 'zod'
import { optionalDate, optionalString, optionalUuid, requiredDate } from './helpers'
import { REPAIR_STATUSES, REPAIR_PRIORITIES } from '@/lib/constants'

const validStatus = REPAIR_STATUSES.map((s) => s.value)
const validPriority = REPAIR_PRIORITIES.map((p) => p.value)

export const repairSchema = z.object({
  property_id: z.string().uuid('Property is required'),
  party_id: optionalUuid(),
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: optionalString(),
  priority: z.enum(validPriority as [string, ...string[]], { message: 'Priority is required' }),
  status: z.enum(validStatus as [string, ...string[]], { message: 'Status is required' }),
  reported_date: requiredDate(),
  scheduled_date: optionalDate(),
  completed_date: optionalDate(),
})

export type RepairFormData = z.infer<typeof repairSchema>
