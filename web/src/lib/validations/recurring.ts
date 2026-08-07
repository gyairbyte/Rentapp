import { z } from 'zod'
import { optionalDate, optionalString, optionalUuid, requiredDate, requiredNumber } from './helpers'

export const recurringRuleSchema = z.object({
  property_id: z.string().uuid('Property is required'),
  account_id: optionalUuid(),
  party_id: optionalUuid(),
  direction: z.string().min(1, 'Direction is required'),
  category: z.string().min(1, 'Category is required'),
  description: optionalString(),
  amount: requiredNumber(),
  frequency: z.string().min(1, 'Frequency is required'),
  day_of_month: z.coerce.number().int().min(1).max(31),
  start_date: requiredDate(),
  end_date: optionalDate(),
  active: z.union([z.literal('on'), z.undefined()]).transform((v) => v === 'on'),
})

export type RecurringRuleFormData = z.infer<typeof recurringRuleSchema>
