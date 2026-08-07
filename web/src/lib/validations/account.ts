import { z } from 'zod'
import { optionalString, optionalUuid } from './helpers'

export const accountSchema = z.object({
  property_id: z.string().uuid('Property is required'),
  party_id: optionalUuid(),
  account_type: z.string().min(1, 'Account type is required'),
  account_number: optionalString(),
  notes: optionalString(),
})

export type AccountFormData = z.infer<typeof accountSchema>
