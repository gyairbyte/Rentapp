'use server'

import { createClient } from '@/lib/supabase/client'

export async function requireUser() {
  const supabase = createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new Error('Not authenticated')
  }
  return data.user
}
