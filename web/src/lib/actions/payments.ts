'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/client'
import { paymentSchema } from '@/lib/validations/payment'
import { requireUser } from './helpers'
import { formatZodErrors } from '@/lib/utils'
import { syncObligationPayments } from './obligations'
import type { Payment } from '@/lib/types'

type ActionResult =
  | { success: true }
  | { error: string; errors?: Record<string, string[]> }

export async function getPayments(): Promise<Payment[]> {
  const user = await requireUser()
  const supabase = createClient()
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
  const supabase = createClient()
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

  const user = await requireUser()
  const supabase = createClient()

  const { data: obligation, error: obError } = await supabase
    .from('obligations')
    .select('property_id')
    .eq('id', parsed.data.obligation_id)
    .eq('user_id', user.id)
    .single()

  if (obError || !obligation) return { error: 'Obligation not found' }

  const { error } = await supabase.from('payments').insert({
    ...parsed.data,
    user_id: user.id,
    property_id: obligation.property_id,
  })

  if (error) return { error: error.message }

  await syncObligationPayments(parsed.data.obligation_id)

  revalidatePath('/obligations')
  revalidatePath('/dashboard')
  revalidatePath(`/obligations/${parsed.data.obligation_id}`)
  revalidatePath(`/properties/${obligation.property_id}`)
  return { success: true }
}

export async function updatePayment(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const user = await requireUser()
  const supabase = createClient()

  const { data: existing } = await supabase
    .from('payments')
    .select('obligation_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase
    .from('payments')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  if (existing?.obligation_id) {
    await syncObligationPayments(existing.obligation_id)
  }

  revalidatePath('/obligations')
  revalidatePath('/dashboard')
  revalidatePath(`/obligations/${existing?.obligation_id}`)
  return { success: true }
}

export async function deletePayment(id: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = createClient()

  const { data: existing } = await supabase
    .from('payments')
    .select('obligation_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  if (existing?.obligation_id) {
    await syncObligationPayments(existing.obligation_id)
  }

  revalidatePath('/obligations')
  revalidatePath('/dashboard')
  revalidatePath(`/obligations/${existing?.obligation_id}`)
  return { success: true }
}
