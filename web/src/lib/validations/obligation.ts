import { z } from 'zod'
import { optionalDate, optionalString, optionalUuid, requiredDate, requiredNumber } from './helpers'

export const obligationSchema = z.object({
  property_id: z.string().uuid('Property is required'),
  account_id: optionalUuid(),
  party_id: optionalUuid(),
  recurring_rule_id: optionalUuid(),
  direction: z.string().min(1, 'Direction is required'),
  category: z.string().min(1, 'Category is required'),
  description: optionalString(),
  expected_amount: requiredNumber(),
  due_date: requiredDate(),
  status: z.string().optional(),
  notes: optionalString(),
  period_start: optionalDate(),
  period_end: optionalDate(),
})

export type ObligationFormData = z.infer<typeof obligationSchema>
