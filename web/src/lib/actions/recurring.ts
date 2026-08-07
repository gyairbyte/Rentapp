'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/client'
import { recurringRuleSchema } from '@/lib/validations/recurring'
import { requireUser } from './helpers'
import { formatZodErrors } from '@/lib/utils'
import { toISODate, addMonths } from './dates'
import { recalcObligation } from '@/lib/utils'
import type { RecurringRule, ObligationInsert } from '@/lib/types'

type ActionResult =
  | { success: true; generated?: number }
  | { error: string; errors?: Record<string, string[]> }

export async function getRecurringRules(): Promise<RecurringRule[]> {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recurring_rules')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .returns<RecurringRule[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getRecurringRulesForProperty(propertyId: string): Promise<RecurringRule[]> {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recurring_rules')
    .select('*')
    .eq('user_id', user.id)
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .returns<RecurringRule[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getRecurringRule(id: string): Promise<RecurringRule | null> {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recurring_rules')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
    .returns<RecurringRule>()

  if (error) return null
  return data
}

export async function createRecurringRule(formData: FormData): Promise<ActionResult> {
  const parsed = recurringRuleSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const user = await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('recurring_rules')
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single()

  if (error) return { error: error.message }

  let generated = 0
  if (data) {
    generated = await generateObligationsForRule(data as RecurringRule)
  }

  revalidatePath('/recurring')
  revalidatePath('/obligations')
  revalidatePath('/dashboard')
  revalidatePath(`/properties/${parsed.data.property_id}`)
  return { success: true, generated }
}

export async function updateRecurringRule(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = recurringRuleSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const user = await requireUser()
  const supabase = await createClient()

  const { data: current, error: fetchError } = await supabase
    .from('recurring_rules')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
    .returns<RecurringRule>()

  if (fetchError || !current) return { error: fetchError?.message ?? 'Recurring rule not found' }

  const { error } = await supabase
    .from('recurring_rules')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  // Reconcile future unpaid obligations against the updated rule.
  // Historical obligations and obligations with payments are left untouched.
  const today = toISODate(new Date())
  await supabase
    .from('obligations')
    .delete()
    .eq('recurring_rule_id', id)
    .eq('user_id', user.id)
    .gte('due_date', today)
    .eq('paid_amount', 0)

  let generated = 0
  const updated = { ...current, ...parsed.data }
  if (updated.active) {
    generated = await generateObligationsForRule(updated, today)
  }

  revalidatePath('/recurring')
  revalidatePath('/obligations')
  revalidatePath('/dashboard')
  revalidatePath(`/recurring/${id}`)
  revalidatePath(`/properties/${updated.property_id}`)
  if (current.property_id !== updated.property_id) {
    revalidatePath(`/properties/${current.property_id}`)
  }
  return { success: true, generated }
}

export async function deleteRecurringRule(id: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: rule } = await supabase
    .from('recurring_rules')
    .select('property_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase
    .from('recurring_rules')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/recurring')
  revalidatePath('/dashboard')
  if (rule?.property_id) revalidatePath(`/properties/${rule.property_id}`)
  return { success: true }
}

export async function generateObligationsForRule(
  rule: RecurringRule,
  fromDate?: string
): Promise<number> {
  if (!rule.active) return 0

  const user = await requireUser()
  const supabase = await createClient()

  const monthsToAdd =
    rule.frequency === 'monthly'
      ? 1
      : rule.frequency === 'quarterly'
      ? 3
      : rule.frequency === 'semiannual'
      ? 6
      : 12

  const start = new Date(`${rule.start_date}T00:00:00Z`)
  const horizon = addMonths(new Date(), 12)
  const end = rule.end_date ? new Date(`${rule.end_date}T00:00:00Z`) : horizon
  const limit = end < horizon ? end : horizon
  const limitDate = toISODate(limit)

  const startDate = toISODate(start)
  const minDate = fromDate && fromDate > startDate ? fromDate : startDate

  let cursor = new Date(`${rule.start_date}T00:00:00Z`)
  let dueDate = computeDueDate(cursor, rule.day_of_month)

  // Advance cursor until the due date is on or after the rule's start date.
  while (dueDate < startDate) {
    cursor = addMonths(cursor, monthsToAdd)
    dueDate = computeDueDate(cursor, rule.day_of_month)
  }

  const generated: ObligationInsert[] = []
  while (dueDate <= limitDate && dueDate >= minDate) {
    const obligation: ObligationInsert = {
      user_id: user.id,
      property_id: rule.property_id,
      account_id: rule.account_id,
      party_id: rule.party_id,
      recurring_rule_id: rule.id,
      direction: rule.direction,
      category: rule.category,
      description: rule.description ?? `${rule.category.replace(/_/g, ' ')} (${rule.frequency})`,
      expected_amount: rule.amount,
      paid_amount: 0,
      due_date: dueDate,
      status: recalcObligation(0, rule.amount, dueDate, 'upcoming'),
      paid_date: null,
      period_start: null,
      period_end: null,
      notes: null,
    }

    generated.push(obligation)
    cursor = addMonths(cursor, monthsToAdd)
    dueDate = computeDueDate(cursor, rule.day_of_month)
  }

  if (generated.length === 0) return 0

  const { error, count } = await supabase
    .from('obligations')
    .upsert(generated, {
      onConflict: 'recurring_rule_id,due_date',
      ignoreDuplicates: true,
      count: 'exact',
    })

  if (error) throw new Error(error.message)

  revalidatePath('/obligations')
  revalidatePath('/dashboard')
  revalidatePath(`/properties/${rule.property_id}`)
  return count ?? generated.length
}

function computeDueDate(cursor: Date, dayOfMonth: number): string {
  const year = cursor.getUTCFullYear()
  const month = cursor.getUTCMonth()
  const day = Math.min(dayOfMonth, daysInMonth(year, month))
  const due = new Date(Date.UTC(year, month, day))
  return toISODate(due)
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}
