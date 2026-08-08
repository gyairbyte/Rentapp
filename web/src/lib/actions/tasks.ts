'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/client'
import { taskSchema, createTaskSchema } from '@/lib/validations/task'
import { requireUser } from './helpers'
import { formatZodErrors } from '@/lib/utils'
import {
  isTaskActive,
  isTaskResolved,
  isTaskOverdue,
  isTaskDueToday,
  isTaskDueSoon,
  isTaskUnscheduled,
  sortTasks,
} from '@/lib/tasks'
import type { Task } from '@/lib/types'

export type TaskFilter =
  | 'active'
  | 'overdue'
  | 'due-today'
  | 'due-soon'
  | 'unscheduled'
  | 'completed'
  | 'canceled'
  | 'history'
  | 'all'

type ActionResult = { success: true; id?: string } | { error: string; errors?: Record<string, string[]> }

function revalidateTaskPaths(task: { id: string; property_id: string | null; source_document_id: string | null }) {
  revalidatePath('/tasks')
  revalidatePath(`/tasks/${task.id}`)
  revalidatePath('/dashboard')
  revalidatePath('/properties')
  if (task.property_id) {
    revalidatePath(`/properties/${task.property_id}`)
  }
  if (task.source_document_id) {
    revalidatePath(`/documents/${task.source_document_id}`)
    revalidatePath(`/documents/${task.source_document_id}/review`)
  }
}

async function validateTaskFks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  propertyId: string | null,
  partyId: string | null,
): Promise<string | null> {
  if (propertyId) {
    const { data: property, error } = await supabase
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .eq('user_id', userId)
      .single()
    if (error || !property) return 'Property not found'
  }

  if (partyId) {
    const { data: party, error } = await supabase
      .from('parties')
      .select('id, property_id')
      .eq('id', partyId)
      .eq('user_id', userId)
      .single()
    if (error || !party) return 'Party not found'
    if (party.property_id !== null && party.property_id !== propertyId) {
      return 'Party does not belong to the selected property'
    }
  }

  return null
}

function completedAtForStatus(status: string, existingCompletedAt: string | null): string | null {
  if (status === 'completed') {
    return existingCompletedAt ?? new Date().toISOString()
  }
  return null
}

export async function getTasks(options: {
  statusFilter?: TaskFilter
  propertyId?: string
  priority?: string
  today?: Date | string
  limit?: number
} = {}): Promise<Task[]> {
  const user = await requireUser()
  const supabase = await createClient()

  let query = supabase.from('tasks').select('*').eq('user_id', user.id)
  if (options.propertyId) query = query.eq('property_id', options.propertyId)
  if (options.priority) query = query.eq('priority', options.priority)

  const { data, error } = await query.order('created_at', { ascending: false }).returns<Task[]>()
  if (error) throw new Error(error.message)

  const today = options.today ?? new Date()
  let tasks = data ?? []

  switch (options.statusFilter) {
    case 'active':
      tasks = tasks.filter((t) => isTaskActive(t.status))
      break
    case 'overdue':
      tasks = tasks.filter((t) => isTaskOverdue(t, today))
      break
    case 'due-today':
      tasks = tasks.filter((t) => isTaskDueToday(t, today))
      break
    case 'due-soon':
      tasks = tasks.filter((t) => isTaskDueSoon(t, today))
      break
    case 'unscheduled':
      tasks = tasks.filter((t) => isTaskUnscheduled(t))
      break
    case 'completed':
      tasks = tasks.filter((t) => t.status === 'completed')
      break
    case 'canceled':
      tasks = tasks.filter((t) => t.status === 'canceled')
      break
    case 'history':
      tasks = tasks.filter((t) => isTaskResolved(t.status))
      break
    case 'all':
    default:
      break
  }

  const sorted = sortTasks(tasks, today)
  if (options.limit) return sorted.slice(0, options.limit)
  return sorted
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

export async function getTasksForProperty(propertyId: string, options: { today?: Date | string } = {}): Promise<Task[]> {
  return getTasks({ statusFilter: 'all', propertyId, today: options.today })
}

export async function getTasksForDashboard(today?: Date | string): Promise<Task[]> {
  return getTasks({ statusFilter: 'active', today, limit: 10 })
}

export async function getTaskByDocumentId(documentId: string): Promise<Task | null> {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('source_document_id', documentId)
    .eq('user_id', user.id)
    .single()
    .returns<Task>()
  if (error) return null
  return data
}

export async function createTask(formData: FormData): Promise<ActionResult> {
  const parsed = createTaskSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const user = await requireUser()
  const supabase = await createClient()

  const fkError = await validateTaskFks(supabase, user.id, parsed.data.property_id ?? null, parsed.data.party_id ?? null)
  if (fkError) return { error: fkError }

  const status = parsed.data.status ?? 'open'
  const completed_at = status === 'completed' ? new Date().toISOString() : null

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      ...parsed.data,
      user_id: user.id,
      status,
      completed_at,
      source_document_id: null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  revalidatePath('/properties')
  if (parsed.data.property_id) {
    revalidatePath(`/properties/${parsed.data.property_id}`)
  }

  return { success: true, id: data?.id }
}

export async function updateTask(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const user = await requireUser()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('tasks')
    .select('source_document_id, completed_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!existing) return { error: 'Task not found' }

  const fkError = await validateTaskFks(supabase, user.id, parsed.data.property_id ?? null, parsed.data.party_id ?? null)
  if (fkError) return { error: fkError }

  const completed_at = completedAtForStatus(parsed.data.status, existing.completed_at)

  const { error } = await supabase
    .from('tasks')
    .update({
      ...parsed.data,
      completed_at,
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidateTaskPaths({ id, property_id: parsed.data.property_id ?? null, source_document_id: existing.source_document_id })
  return { success: true, id }
}

export async function deleteTask(id: string): Promise<{ success: true } | { error: string }> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('tasks')
    .select('property_id, source_document_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!existing) return { error: 'Task not found' }

  const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }

  revalidateTaskPaths({ id, property_id: existing.property_id, source_document_id: existing.source_document_id })
  return { success: true }
}

export async function transitionTask(id: string, status: string): Promise<{ success: true } | { error: string }> {
  if (!['open', 'in_progress', 'completed', 'canceled'].includes(status)) {
    return { error: 'Invalid task status' }
  }

  const user = await requireUser()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('tasks')
    .select('status, completed_at, property_id, source_document_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!existing) return { error: 'Task not found' }

  const completed_at = completedAtForStatus(status, existing.completed_at)

  const { error } = await supabase
    .from('tasks')
    .update({ status, completed_at })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidateTaskPaths({ id, property_id: existing.property_id, source_document_id: existing.source_document_id })
  return { success: true }
}
