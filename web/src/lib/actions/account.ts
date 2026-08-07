'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/client'
import { accountSchema } from '@/lib/validations/account'
import { requireUser } from './helpers'
import { formatZodErrors } from '@/lib/utils'
import type { Account } from '@/lib/types'

type ActionResult =
  | { success: true }
  | { error: string; errors?: Record<string, string[]> }

export async function getAccounts(): Promise<Account[]> {
  const user = await requireUser()
  const supabase = createClient()
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('account_type', { ascending: true })
    .returns<Account[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getAccount(id: string): Promise<Account | null> {
  const user = await requireUser()
  const supabase = createClient()
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
    .returns<Account>()

  if (error) return null
  return data
}

export async function getAccountsForProperty(propertyId: string): Promise<Account[]> {
  const user = await requireUser()
  const supabase = createClient()
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('property_id', propertyId)
    .order('account_type', { ascending: true })
    .returns<Account[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getAccountOptions(): Promise<Pick<Account, 'id' | 'account_type' | 'account_number' | 'property_id'>[]> {
  const user = await requireUser()
  const supabase = createClient()
  const { data, error } = await supabase
    .from('accounts')
    .select('id,account_type,account_number,property_id')
    .eq('user_id', user.id)
    .order('account_type', { ascending: true })

  if (error) throw new Error(error.message)
  return (data as Pick<Account, 'id' | 'account_type' | 'account_number' | 'property_id'>[]) ?? []
}

export async function createAccount(formData: FormData): Promise<ActionResult> {
  const parsed = accountSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const user = await requireUser()
  const supabase = createClient()

  const { error } = await supabase.from('accounts').insert({
    ...parsed.data,
    user_id: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/accounts')
  revalidatePath('/dashboard')
  revalidatePath(`/properties/${parsed.data.property_id}`)
  return { success: true }
}

export async function updateAccount(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = accountSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const user = await requireUser()
  const supabase = createClient()

  const { error } = await supabase
    .from('accounts')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/accounts')
  revalidatePath('/dashboard')
  revalidatePath(`/accounts/${id}`)
  revalidatePath(`/properties/${parsed.data.property_id}`)
  return { success: true }
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = createClient()

  const { data: existing } = await supabase
    .from('accounts')
    .select('property_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/accounts')
  revalidatePath('/dashboard')
  if (existing?.property_id) revalidatePath(`/properties/${existing.property_id}`)
  return { success: true }
}
