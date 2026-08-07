import { z } from 'zod'
import { optionalString, requiredDate, requiredNumber } from './helpers'

export const paymentSchema = z.object({
  obligation_id: z.string().uuid('Obligation is required'),
  amount: requiredNumber(),
  payment_date: requiredDate(),
  method: optionalString(),
  confirmation_reference: optionalString(),
  notes: optionalString(),
})

export type PaymentFormData = z.infer<typeof paymentSchema>
