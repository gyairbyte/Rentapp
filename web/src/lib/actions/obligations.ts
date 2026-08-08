'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/client'
import { obligationSchema } from '@/lib/validations/obligation'
import { requireUser } from './helpers'
import { formatZodErrors, recalcObligation, calculatePaidDate } from '@/lib/utils'
import { toMoneyCents } from '@/lib/bills'
import type { Obligation, Payment } from '@/lib/types'

type ActionResult =
  | { success: true; id?: string }
  | { error: string; errors?: Record<string, string[]> }

type ObligationFkData = {
  property_id: string
  account_id: string | null
  party_id: string | null
  recurring_rule_id: string | null
}

async function validateObligationOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  data: ObligationFkData,
): Promise<string | null> {
  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('id')
    .eq('id', data.property_id)
    .eq('user_id', userId)
    .single()

  if (propertyError || !property) return 'Property not found'

  if (data.account_id) {
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', data.account_id)
      .eq('user_id', userId)
      .single()
    if (accountError || !account) return 'Account not found'
  }

  if (data.party_id) {
    const { data: party, error: partyError } = await supabase
      .from('parties')
      .select('id')
      .eq('id', data.party_id)
      .eq('user_id', userId)
      .single()
    if (partyError || !party) return 'Party not found'
  }

  if (data.recurring_rule_id) {
    const { data: rule, error: ruleError } = await supabase
      .from('recurring_rules')
      .select('id')
      .eq('id', data.recurring_rule_id)
      .eq('user_id', userId)
      .single()
    if (ruleError || !rule) return 'Recurring rule not found'
  }

  return null
}

export async function getObligations(
  options: { propertyId?: string; direction?: string; status?: string; includeResolved?: boolean } = {}
): Promise<Obligation[]> {
  const user = await requireUser()
  const supabase = await createClient()

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
  const supabase = await createClient()
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

export async function getObligationsForDocument(documentId: string): Promise<Obligation[]> {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('obligations')
    .select('*')
    .eq('user_id', user.id)
    .eq('source_document_id', documentId)
    .order('due_date', { ascending: true })
    .returns<Obligation[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createObligation(formData: FormData): Promise<ActionResult> {
  const parsed = obligationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const user = await requireUser()
  const supabase = await createClient()

  const ownershipError = await validateObligationOwnership(supabase, user.id, {
    property_id: parsed.data.property_id,
    account_id: parsed.data.account_id,
    party_id: parsed.data.party_id,
    recurring_rule_id: parsed.data.recurring_rule_id,
  })
  if (ownershipError) return { error: ownershipError }

  const status = recalcObligation(0, parsed.data.expected_amount, parsed.data.due_date, 'upcoming')

  const { data, error } = await supabase
    .from('obligations')
    .insert({
      ...parsed.data,
      user_id: user.id,
      paid_amount: 0,
      status,
      paid_date: null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/obligations')
  revalidatePath('/dashboard')
  revalidatePath(`/properties/${parsed.data.property_id}`)
  return { success: true, id: data?.id }
}

export async function updateObligation(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = obligationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const user = await requireUser()
  const supabase = await createClient()

  const { data: existing, error: existingError } = await supabase
    .from('obligations')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (existingError || !existing) return { error: 'Obligation not found' }

  const ownershipError = await validateObligationOwnership(supabase, user.id, {
    property_id: parsed.data.property_id,
    account_id: parsed.data.account_id,
    party_id: parsed.data.party_id,
    recurring_rule_id: parsed.data.recurring_rule_id,
  })
  if (ownershipError) return { error: ownershipError }

  const paidAmount = existing.paid_amount ?? 0
  const status = recalcObligation(paidAmount, parsed.data.expected_amount, parsed.data.due_date, existing.status)

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
  if (existing.property_id !== parsed.data.property_id) revalidatePath(`/properties/${existing.property_id}`)
  return { success: true }
}

export async function cancelObligation(id: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

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
  const supabase = await createClient()

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
    .select('amount, payment_date')
    .eq('obligation_id', obligationId)
    .eq('user_id', user.id)
    .order('payment_date', { ascending: true })
    .returns<Payment[]>()

  if (payError) throw new Error(payError.message)

  // Sum payments in integer cents to avoid binary floating-point drift.
  const paidCents = (payments ?? []).reduce((sum, p) => sum + toMoneyCents(p.amount), 0)
  const paidAmount = paidCents / 100
  const status = recalcObligation(paidAmount, obligation.expected_amount, obligation.due_date, obligation.status)
  const paidDate = calculatePaidDate(payments ?? [], obligation.expected_amount)

  await supabase
    .from('obligations')
    .update({ paid_amount: paidAmount, status, paid_date: paidDate })
    .eq('id', obligationId)
    .eq('user_id', user.id)
}
