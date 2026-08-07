'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/client'
import { getURL } from '@/lib/utils'

type ActionResult = { success: true } | { error: string }

export async function signIn(formData: FormData): Promise<ActionResult> {
  const supabase = createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function signUp(formData: FormData): Promise<ActionResult> {
  const supabase = createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: getURL() },
  })
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function signOut(): Promise<ActionResult> {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}
