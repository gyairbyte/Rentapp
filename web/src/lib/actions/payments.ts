'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/client'
import { paymentSchema } from '@/lib/validations/payment'
import { requireUser } from './helpers'
import { formatZodErrors } from '@/lib/utils'
import { syncObligationPayments } from './obligations'
import { toCents } from '@/lib/payment-validation'
import type { Payment } from '@/lib/types'

type ActionResult =
  | { success: true }
  | { error: string; errors?: Record<string, string[]> }

function billDetailPath(obligation: { source_document_id: string | null; id: string }): string {
  return `/bills/${obligation.source_document_id ?? obligation.id}`
}

function revalidatePaymentPaths(obligation: { id: string; property_id: string | null; source_document_id: string | null }) {
  revalidatePath('/obligations')
  revalidatePath('/dashboard')
  revalidatePath('/bills')
  revalidatePath(`/obligations/${obligation.id}`)
  revalidatePath(billDetailPath(obligation))
  if (obligation.property_id) {
    revalidatePath(`/properties/${obligation.property_id}`)
  }
}

export async function getPayments(): Promise<Payment[]> {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', user.id)
    .order('payment_date', { ascending: false })
    .returns<Payment[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getPaymentsForObligation(obligationId: string): Promise<Payment[]> {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('obligation_id', obligationId)
    .eq('user_id', user.id)
    .order('payment_date', { ascending: false })
    .returns<Payment[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createPayment(formData: FormData): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const paymentCents = toCents(parsed.data.amount)
  if (paymentCents === null || paymentCents <= 0) {
    return { error: 'Payment amount must be a positive money value valid to cents' }
  }

  const user = await requireUser()
  const supabase = await createClient()

  const { data: obligation, error: obError } = await supabase
    .from('obligations')
    .select('expected_amount, paid_amount, status, property_id, source_document_id')
    .eq('id', parsed.data.obligation_id)
    .eq('user_id', user.id)
    .single()

  if (obError || !obligation) return { error: 'Obligation not found' }
  if (['canceled', 'waived'].includes(obligation.status)) {
    return { error: 'Cannot record payment on a canceled or waived obligation' }
  }

  const expectedCents = toCents(obligation.expected_amount) ?? 0
  const paidCents = toCents(obligation.paid_amount) ?? 0
  if (paidCents + paymentCents > expectedCents) {
    return { error: 'Payment amount exceeds the remaining balance' }
  }

  const { error } = await supabase.from('payments').insert({
    ...parsed.data,
    user_id: user.id,
    property_id: obligation.property_id,
  })

  if (error) return { error: error.message }

  await syncObligationPayments(parsed.data.obligation_id)

  revalidatePaymentPaths({
    id: parsed.data.obligation_id,
    property_id: obligation.property_id,
    source_document_id: obligation.source_document_id,
  })

  return { success: true }
}

export async function updatePayment(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const paymentCents = toCents(parsed.data.amount)
  if (paymentCents === null || paymentCents <= 0) {
    return { error: 'Payment amount must be a positive money value valid to cents' }
  }

  const user = await requireUser()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('payments')
    .select('obligation_id, amount')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!existing) return { error: 'Payment not found' }

  // The obligation is immutable when editing an existing payment; only the
  // amount, date, method, reference, and notes can be updated.
  if (parsed.data.obligation_id !== existing.obligation_id) {
    return { error: 'Payment obligation cannot be changed' }
  }

  const { data: obligation } = await supabase
    .from('obligations')
    .select('expected_amount, paid_amount, status, property_id, source_document_id')
    .eq('id', existing.obligation_id)
    .eq('user_id', user.id)
    .single()

  if (!obligation) return { error: 'Obligation not found' }
  if (['canceled', 'waived'].includes(obligation.status)) {
    return { error: 'Cannot record payment on a canceled or waived obligation' }
  }

  const existingPaymentCents = toCents(existing.amount) ?? 0
  const expectedCents = toCents(obligation.expected_amount) ?? 0
  const paidCents = toCents(obligation.paid_amount) ?? 0
  const newPaidCents = paidCents - existingPaymentCents + paymentCents

  if (newPaidCents > expectedCents) {
    return { error: 'Payment amount exceeds the remaining balance' }
  }

  const { error } = await supabase
    .from('payments')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  await syncObligationPayments(existing.obligation_id)

  revalidatePaymentPaths({
    id: existing.obligation_id,
    property_id: obligation.property_id,
    source_document_id: obligation.source_document_id,
  })

  return { success: true }
}

export async function deletePayment(id: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('payments')
    .select('obligation_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!existing) return { error: 'Payment not found' }

  const { data: obligation } = await supabase
    .from('obligations')
    .select('property_id, source_document_id')
    .eq('id', existing.obligation_id)
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  await syncObligationPayments(existing.obligation_id)

  revalidatePaymentPaths({
    id: existing.obligation_id,
    property_id: obligation?.property_id ?? null,
    source_document_id: obligation?.source_document_id ?? null,
  })

  return { success: true }
}
