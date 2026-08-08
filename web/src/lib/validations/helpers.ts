import { z } from 'zod'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

export function optionalUuid() {
  return z
    .union([z.literal(''), z.string().uuid()])
    .optional()
    .transform((v) => (v === undefined || v === '' ? null : v))
}

export function optionalString() {
  return z.string().optional().transform((v) => (v === undefined ? null : v.trim() || null))
}

export function optionalText() {
  return z.string().optional().transform((v) => (v === undefined ? null : v.trim() || null))
}

export function optionalDate() {
  return z
    .union([z.literal(''), z.string().regex(dateRegex)])
    .optional()
    .transform((v) => (v === undefined || v === '' ? null : v))
}

export function requiredDate() {
  return z.string().regex(dateRegex, 'A valid date is required')
}

export function requiredNumber() {
  return z.coerce.number({ message: 'A valid number is required' }).nonnegative('Must be zero or greater')
}
