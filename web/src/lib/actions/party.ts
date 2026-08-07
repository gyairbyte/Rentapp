'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/client'
import { partySchema } from '@/lib/validations/party'
import { requireUser } from './helpers'
import { formatZodErrors } from '@/lib/utils'
import type { Party } from '@/lib/types'

type ActionResult =
  | { success: true }
  | { error: string; errors?: Record<string, string[]> }

export async function getParties(): Promise<Party[]> {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('parties')
    .select('*')
    .eq('user_id', user.id)
    .order('name', { ascending: true })
    .returns<Party[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getParty(id: string): Promise<Party | null> {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('parties')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
    .returns<Party>()

  if (error) return null
  return data
}

export async function getPartiesForProperty(propertyId: string): Promise<Party[]> {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('parties')
    .select('*')
    .eq('user_id', user.id)
    .or(`property_id.eq.${propertyId},property_id.is.null`)
    .order('name', { ascending: true })
    .returns<Party[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getPartyOptions(): Promise<Pick<Party, 'id' | 'name' | 'party_type'>[]> {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('parties')
    .select('id,name,party_type')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data as Pick<Party, 'id' | 'name' | 'party_type'>[]) ?? []
}

export async function createParty(formData: FormData): Promise<ActionResult> {
  const parsed = partySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const user = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase.from('parties').insert({
    ...parsed.data,
    user_id: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/parties')
  revalidatePath('/dashboard')
  if (parsed.data.property_id) revalidatePath(`/properties/${parsed.data.property_id}`)
  return { success: true }
}

export async function updateParty(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = partySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const user = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('parties')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/parties')
  revalidatePath('/dashboard')
  revalidatePath(`/parties/${id}`)
  if (parsed.data.property_id) revalidatePath(`/properties/${parsed.data.property_id}`)
  return { success: true }
}

export async function deleteParty(id: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('parties')
    .select('property_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase
    .from('parties')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/parties')
  if (existing?.property_id) revalidatePath(`/properties/${existing.property_id}`)
  return { success: true }
}
