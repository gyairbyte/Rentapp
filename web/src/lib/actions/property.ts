'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/client'
import { propertySchema } from '@/lib/validations/property'
import { requireUser } from './helpers'
import { formatZodErrors } from '@/lib/utils'
import type { Property } from '@/lib/types'

type ActionResult =
  | { success: true }
  | { error: string; errors?: Record<string, string[]> }

export async function getProperties(): Promise<Property[]> {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('user_id', user.id)
    .eq('archived', false)
    .order('nickname', { ascending: true })
    .returns<Property[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getProperty(id: string): Promise<Property | null> {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
    .returns<Property>()

  if (error) return null
  return data
}

export async function getPropertyOptions(): Promise<Pick<Property, 'id' | 'nickname'>[]> {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('properties')
    .select('id,nickname')
    .eq('user_id', user.id)
    .eq('archived', false)
    .order('nickname', { ascending: true })

  if (error) throw new Error(error.message)
  return (data as Pick<Property, 'id' | 'nickname'>[]) ?? []
}

export async function createProperty(formData: FormData): Promise<ActionResult> {
  const parsed = propertySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const user = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase.from('properties').insert({
    ...parsed.data,
    user_id: user.id,
    archived: false,
  })

  if (error) return { error: error.message }

  revalidatePath('/properties')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateProperty(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = propertySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const user = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('properties')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/properties')
  revalidatePath('/dashboard')
  revalidatePath(`/properties/${id}`)
  return { success: true }
}

export async function archiveProperty(id: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('properties')
    .update({ archived: true, active: false })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/properties')
  revalidatePath('/dashboard')
  revalidatePath(`/properties/${id}`)
  return { success: true }
}
