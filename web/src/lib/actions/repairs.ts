'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/client'
import { repairSchema } from '@/lib/validations/repair'
import { requireUser } from './helpers'
import { formatZodErrors } from '@/lib/utils'
import type { Repair } from '@/lib/types'

type ActionResult =
  | { success: true }
  | { error: string; errors?: Record<string, string[]> }

function revalidateRepairPaths(repair: { id: string; property_id: string }) {
  revalidatePath('/repairs')
  revalidatePath(`/repairs/${repair.id}`)
  revalidatePath('/dashboard')
  revalidatePath('/properties')
  revalidatePath(`/properties/${repair.property_id}`)
}

export async function getRepairs(options: { includeResolved?: boolean } = {}): Promise<Repair[]> {
  const user = await requireUser()
  const supabase = await createClient()
  let query = supabase.from('repairs').select('*').eq('user_id', user.id)
  if (!options.includeResolved) {
    query = query.not('status', 'in', '(closed)')
  }
  const { data, error } = await query.order('reported_date', { ascending: false }).returns<Repair[]>()
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getRepair(id: string): Promise<Repair | null> {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('repairs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
    .returns<Repair>()
  if (error) return null
  return data
}

export async function getRepairsForProperty(propertyId: string, options: { includeResolved?: boolean } = {}): Promise<Repair[]> {
  const user = await requireUser()
  const supabase = await createClient()
  let query = supabase.from('repairs').select('*').eq('user_id', user.id).eq('property_id', propertyId)
  if (!options.includeResolved) {
    query = query.not('status', 'in', '(closed)')
  }
  const { data, error } = await query.order('reported_date', { ascending: false }).returns<Repair[]>()
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createRepair(formData: FormData): Promise<ActionResult> {
  const parsed = repairSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const user = await requireUser()
  const supabase = await createClient()

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('id')
    .eq('id', parsed.data.property_id)
    .eq('user_id', user.id)
    .single()

  if (propertyError || !property) return { error: 'Property not found' }

  if (parsed.data.party_id) {
    const { data: party, error: partyError } = await supabase
      .from('parties')
      .select('id')
      .eq('id', parsed.data.party_id)
      .eq('user_id', user.id)
      .single()
    if (partyError || !party) return { error: 'Vendor / party not found' }
  }

  const { error } = await supabase.from('repairs').insert({
    ...parsed.data,
    user_id: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/repairs')
  revalidatePath('/dashboard')
  revalidatePath('/properties')
  revalidatePath(`/properties/${parsed.data.property_id}`)
  return { success: true }
}

export async function updateRepair(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = repairSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const user = await requireUser()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('repairs')
    .select('property_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!existing) return { error: 'Repair not found' }

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('id')
    .eq('id', parsed.data.property_id)
    .eq('user_id', user.id)
    .single()

  if (propertyError || !property) return { error: 'Property not found' }

  if (parsed.data.party_id) {
    const { data: party, error: partyError } = await supabase
      .from('parties')
      .select('id')
      .eq('id', parsed.data.party_id)
      .eq('user_id', user.id)
      .single()
    if (partyError || !party) return { error: 'Vendor / party not found' }
  }

  const { error } = await supabase
    .from('repairs')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidateRepairPaths({ id, property_id: parsed.data.property_id || existing.property_id })
  return { success: true }
}

export async function deleteRepair(id: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('repairs')
    .select('property_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!existing) return { error: 'Repair not found' }

  const { error } = await supabase.from('repairs').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }

  revalidateRepairPaths({ id, property_id: existing.property_id })
  return { success: true }
}
