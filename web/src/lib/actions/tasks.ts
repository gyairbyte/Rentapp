'use server'

import { createClient } from '@/lib/supabase/client'
import { requireUser } from './helpers'
import { toISODate, addDays } from './dates'
import type { Task } from '@/lib/types'

export async function getTasks(options: { propertyId?: string; status?: string; includeCompleted?: boolean } = {}): Promise<Task[]> {
  const user = await requireUser()
  const supabase = await createClient()

  let query = supabase.from('tasks').select('*').eq('user_id', user.id)

  if (options.propertyId) query = query.eq('property_id', options.propertyId)
  if (options.status) query = query.eq('status', options.status)
  if (!options.includeCompleted) query = query.not('status', 'in', '(completed,canceled)')

  const { data, error } = await query.order('due_date', { ascending: true, nullsFirst: false }).returns<Task[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getTask(id: string): Promise<Task | null> {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
    .returns<Task>()

  if (error) return null
  return data
}

export async function getTasksForDashboard() {
  const user = await requireUser()
  const supabase = await createClient()
  const nextWeek = toISODate(addDays(new Date(), 7))

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .not('status', 'in', '(completed,canceled)')
    .or(`due_date.lte.${nextWeek},due_date.is.null`)
    .order('due_date', { ascending: true, nullsFirst: false })
    .returns<Task[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}
