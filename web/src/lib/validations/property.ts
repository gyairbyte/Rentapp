import { z } from 'zod'

export const propertySchema = z.object({
  nickname: z.string().min(1, 'Nickname is required'),
  street_address: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zip: z.string().min(1, 'ZIP is required'),
  property_type: z.string().max(50).optional().transform((v) => v?.trim() || null),
  active: z.union([z.literal('on'), z.undefined()]).transform((v) => v === 'on'),
})

export type PropertyFormData = z.infer<typeof propertySchema>
