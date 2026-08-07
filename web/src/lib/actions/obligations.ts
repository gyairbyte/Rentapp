'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/client'
import { obligationSchema } from '@/lib/validations/obligation'
import { requireUser } from './helpers'
import { formatZodErrors, recalcObligation } from '@/lib/utils'
import type { Obligation, Payment } from '@/lib/types'

type ActionResult =
  | { success: true }
  | { error: string; errors?: Record<string, string[]> }

export async function getObligations(
  options: { propertyId?: string; direction?: string; status?: string; includeResolved?: boolean } = {}
): Promise<Obligation[]> {
  const user = await requireUser()
  const supabase = createClient()

  let query = supabase.from('obligations').select('*').eq('user_id', user.id)

  if (options.propertyId) query = query.eq('property_id', options.propertyId)
  if (options.direction) query = query.eq('direction', options.direction)
  if (options.status) query = query.eq('status', options.status)
  if (!options.includeResolved) {
    query = query.not('status', 'in', '(paid,canceled,waived)')
  }

  const { data, error } = await query
    .order('due_date', { ascending: true })
    .returns<Obligation[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getObligation(id: string): Promise<Obligation | null> {
  const user = await requireUser()
  const supabase = createClient()
  const { data, error } = await supabase
    .from('obligations')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
    .returns<Obligation>()

  if (error) return null
  return data
}

export async function getObligationsForProperty(propertyId: string): Promise<Obligation[]> {
  return getObligations({ propertyId, includeResolved: false })
}

export async function createObligation(formData: FormData): Promise<ActionResult> {
  const parsed = obligationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const user = await requireUser()
  const supabase = createClient()

  const status = recalcObligation(0, parsed.data.expected_amount, parsed.data.due_date, 'upcoming')

  const { error } = await supabase.from('obligations').insert({
    ...parsed.data,
    user_id: user.id,
    paid_amount: 0,
    status,
    paid_date: null,
  })

  if (error) return { error: error.message }

  revalidatePath('/obligations')
  revalidatePath('/dashboard')
  revalidatePath(`/properties/${parsed.data.property_id}`)
  return { success: true }
}

export async function updateObligation(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = obligationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const user = await requireUser()
  const supabase = createClient()

  const { data: existing } = await supabase
    .from('obligations')
    .select('paid_amount')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const paidAmount = existing?.paid_amount ?? 0
  const status = recalcObligation(paidAmount, parsed.data.expected_amount, parsed.data.due_date, parsed.data.status ?? 'upcoming')

  const { error } = await supabase
    .from('obligations')
    .update({ ...parsed.data, status })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/obligations')
  revalidatePath('/dashboard')
  revalidatePath(`/obligations/${id}`)
  if (parsed.data.property_id) revalidatePath(`/properties/${parsed.data.property_id}`)
  return { success: true }
}

export async function cancelObligation(id: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = createClient()

  const { data: existing } = await supabase
    .from('obligations')
    .select('property_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase
    .from('obligations')
    .update({ status: 'canceled' })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/obligations')
  revalidatePath('/dashboard')
  if (existing?.property_id) revalidatePath(`/properties/${existing.property_id}`)
  return { success: true }
}

export async function syncObligationPayments(obligationId: string) {
  const user = await requireUser()
  const supabase = createClient()

  const { data: obligation, error: obError } = await supabase
    .from('obligations')
    .select('*')
    .eq('id', obligationId)
    .eq('user_id', user.id)
    .single()
    .returns<Obligation>()

  if (obError || !obligation) return

  const { data: payments, error: payError } = await supabase
    .from('payments')
    .select('amount')
    .eq('obligation_id', obligationId)
    .eq('user_id', user.id)
    .returns<Payment[]>()

  if (payError) throw new Error(payError.message)

  const paidAmount = (payments ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0)
  const status = recalcObligation(paidAmount, obligation.expected_amount, obligation.due_date, obligation.status)
  const paidDate = status === 'paid' ? obligation.due_date : null

  await supabase
    .from('obligations')
    .update({ paid_amount: paidAmount, status, paid_date: paidDate })
    .eq('id', obligationId)
    .eq('user_id', user.id)
}
