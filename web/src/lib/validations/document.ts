import { z } from 'zod'
import { optionalDate, optionalString, optionalUuid } from './helpers'

export const documentSchema = z.object({
  property_id: optionalUuid(),
  document_type: optionalString(),
  issuer: optionalString(),
  document_date: optionalDate(),
  file: z.any().optional(),
})

export type DocumentFormData = z.infer<typeof documentSchema>
