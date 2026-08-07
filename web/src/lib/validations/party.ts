import { z } from 'zod'
import { optionalString, optionalUuid } from './helpers'

export const partySchema = z.object({
  property_id: optionalUuid(),
  name: z.string().min(1, 'Name is required'),
  party_type: z.string().min(1, 'Type is required'),
  email: optionalString().pipe(z.union([z.literal(null), z.string().email()])),
  phone: optionalString(),
  notes: optionalString(),
})

export type PartyFormData = z.infer<typeof partySchema>
