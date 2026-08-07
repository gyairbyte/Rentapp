'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/client'
import { recurringRuleSchema } from '@/lib/validations/recurring'
import { requireUser } from './helpers'
import { formatZodErrors } from '@/lib/utils'
import { toISODate, addMonths, getPeriodStart } from './dates'
import { recalcObligation } from '@/lib/utils'
import type { RecurringRule, ObligationInsert } from '@/lib/types'

type ActionResult =
  | { success: true; generated?: number }
  | { error: string; errors?: Record<string, string[]> }

export async function getRecurringRules(): Promise<RecurringRule[]> {
  const user = await requireUser()
  const supabase = createClient()
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
  const supabase = createClient()
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
  const supabase = createClient()
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
  const supabase = createClient()

  const { data, error } = await supabase
    .from('recurring_rules')
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single()

  if (error) return { error: error.message }

  if (data) {
    await generateObligationsForRule(data as RecurringRule)
  }

  revalidatePath('/recurring')
  revalidatePath('/obligations')
  revalidatePath('/dashboard')
  revalidatePath(`/properties/${parsed.data.property_id}`)
  return { success: true, generated: 0 }
}

export async function updateRecurringRule(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = recurringRuleSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const user = await requireUser()
  const supabase = createClient()

  const { error } = await supabase
    .from('recurring_rules')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/recurring')
  revalidatePath('/obligations')
  revalidatePath('/dashboard')
  revalidatePath(`/recurring/${id}`)
  revalidatePath(`/properties/${parsed.data.property_id}`)
  return { success: true }
}

export async function deleteRecurringRule(id: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = createClient()

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

export async function generateObligationsForRule(rule: RecurringRule): Promise<number> {
  const supabase = createClient()
  const user = await requireUser()

  const start = new Date(rule.start_date)
  const horizon = addMonths(new Date(), 12)
  const end = rule.end_date ? new Date(rule.end_date) : horizon
  const limit = end < horizon ? end : horizon

  const monthsToAdd =
    rule.frequency === 'monthly'
      ? 1
      : rule.frequency === 'quarterly'
      ? 3
      : rule.frequency === 'semiannual'
      ? 6
      : 12

  const generated: ObligationInsert[] = []
  let cursor = new Date(start)

  while (cursor <= limit) {
    const year = cursor.getUTCFullYear()
    const month = cursor.getUTCMonth()
    const day = Math.min(rule.day_of_month, daysInMonth(year, month))
    const dueDate = new Date(Date.UTC(year, month, day))
    const periodStart = getPeriodStart(rule.frequency, year, month)

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
      due_date: toISODate(dueDate),
      status: recalcObligation(0, rule.amount, toISODate(dueDate), 'upcoming'),
      paid_date: null,
      period_start: toISODate(periodStart),
      period_end: toISODate(dueDate),
      notes: null,
    }

    generated.push(obligation)
    cursor = addMonths(cursor, monthsToAdd)
  }

  let count = 0
  for (const obligation of generated) {
    const { data: existing } = await supabase
      .from('obligations')
      .select('id')
      .eq('recurring_rule_id', rule.id)
      .eq('due_date', obligation.due_date)
      .maybeSingle()

    if (!existing) {
      const { error } = await supabase.from('obligations').insert(obligation)
      if (!error) count++
    }
  }

  revalidatePath('/obligations')
  revalidatePath('/dashboard')
  revalidatePath(`/properties/${rule.property_id}`)
  return count
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}
