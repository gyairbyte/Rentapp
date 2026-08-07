'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/client'
import { propertySchema } from '@/lib/validations/property'
import type { Property } from '@/lib/types'

type ActionResult =
  | { success: true }
  | { error: string; errors?: Record<string, string[]> }

export async function getProperties(): Promise<Property[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .order('nickname', { ascending: true })
    .returns<Property[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getProperty(id: string): Promise<Property | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .single()
    .returns<Property>()

  if (error) return null
  return data
}

export async function createProperty(formData: FormData): Promise<ActionResult> {
  const parsed = propertySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: parsed.error.flatten().fieldErrors }
  }

  const supabase = createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('properties').insert({
    ...parsed.data,
    user_id: userData.user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/properties')
  return { success: true }
}

export async function updateProperty(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const parsed = propertySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: parsed.error.flatten().fieldErrors }
  }

  const supabase = createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('properties')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', userData.user.id)

  if (error) return { error: error.message }

  revalidatePath('/properties')
  revalidatePath(`/properties/${id}`)
  return { success: true }
}

export async function deleteProperty(id: string): Promise<ActionResult> {
  const supabase = createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('properties')
    .delete()
    .eq('id', id)
    .eq('user_id', userData.user.id)

  if (error) return { error: error.message }

  revalidatePath('/properties')
  return { success: true }
}
