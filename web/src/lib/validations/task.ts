import { z } from 'zod'
import { optionalDate, optionalString, optionalUuid } from './helpers'
import { TASK_STATUSES, TASK_PRIORITIES } from '@/lib/constants'

const validStatus = TASK_STATUSES.map((s) => s.value)
const validPriority = TASK_PRIORITIES.map((p) => p.value)

export const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  property_id: optionalUuid(),
  party_id: optionalUuid(),
  description: optionalString(),
  due_date: optionalDate(),
  priority: z.enum(validPriority as [string, ...string[]], { message: 'Priority is required' }),
  status: z.enum(validStatus as [string, ...string[]], { message: 'Status is required' }),
})

export const createTaskSchema = taskSchema.partial({
  status: true,
})

export type TaskFormData = z.infer<typeof taskSchema>
