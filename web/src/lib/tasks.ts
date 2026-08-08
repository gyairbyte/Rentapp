import { labelFor } from './utils'
import { TASK_STATUSES, TASK_PRIORITIES } from './constants'
import { toISODate, addDays } from './actions/dates'
import type { Task } from './types'

export const ACTIVE_TASK_STATUSES: readonly string[] = ['open', 'in_progress']
export const RESOLVED_TASK_STATUSES: readonly string[] = ['completed', 'canceled']

export function taskStatusLabel(status: string): string {
  return labelFor(status, TASK_STATUSES)
}

export function taskPriorityLabel(priority: string): string {
  return labelFor(priority, TASK_PRIORITIES)
}

export function isTaskActive(status: string): boolean {
  return ACTIVE_TASK_STATUSES.includes(status)
}

export function isTaskResolved(status: string): boolean {
  return RESOLVED_TASK_STATUSES.includes(status)
}

export function isTaskOverdue(task: Task, today: Date | string): boolean {
  if (!isTaskActive(task.status) || !task.due_date) return false
  const date = typeof today === 'string' ? today : toISODate(today)
  return task.due_date < date
}

export function isTaskDueToday(task: Task, today: Date | string): boolean {
  if (!isTaskActive(task.status) || !task.due_date) return false
  const date = typeof today === 'string' ? today : toISODate(today)
  return task.due_date === date
}

export function isTaskDueSoon(task: Task, today: Date | string): boolean {
  if (!isTaskActive(task.status) || !task.due_date) return false
  const date = typeof today === 'string' ? new Date(`${today}T00:00:00Z`) : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const soon = addDays(date, 7)
  const soonStr = toISODate(soon)
  const dateStr = typeof today === 'string' ? today : toISODate(today)
  return task.due_date > dateStr && task.due_date <= soonStr
}

export function isTaskUnscheduled(task: Task): boolean {
  return isTaskActive(task.status) && !task.due_date
}

export type TaskDueBucket = 'overdue' | 'due-today' | 'due-soon' | 'later' | 'unscheduled'

export function classifyTaskDue(task: Task, today: Date | string): TaskDueBucket {
  if (!isTaskActive(task.status)) return 'later'
  if (isTaskOverdue(task, today)) return 'overdue'
  if (isTaskDueToday(task, today)) return 'due-today'
  if (isTaskDueSoon(task, today)) return 'due-soon'
  if (isTaskUnscheduled(task)) return 'unscheduled'
  return 'later'
}

function priorityWeight(priority: string | null | undefined): number {
  if (priority === 'urgent') return 0
  if (priority === 'high') return 1
  if (priority === 'normal') return 2
  if (priority === 'low') return 3
  return 2
}

type SortBucket = 0 | 1 | 2 | 3 | 4 | 5

function sortBucket(task: Task, today: Date | string): SortBucket {
  if (isTaskOverdue(task, today)) return 0
  if (isTaskDueToday(task, today)) return 1
  if (isTaskActive(task.status) && ['urgent', 'high'].includes(task.priority ?? '')) return 2
  if (isTaskDueSoon(task, today)) return 3
  if (isTaskUnscheduled(task)) return 5
  return 4
}

export function compareTasks(a: Task, b: Task, today: Date | string): number {
  const aBucket = sortBucket(a, today)
  const bBucket = sortBucket(b, today)
  if (aBucket !== bBucket) return aBucket - bBucket

  const aDate = a.due_date ?? '9999-12-31'
  const bDate = b.due_date ?? '9999-12-31'
  if (aDate !== bDate) return aDate.localeCompare(bDate)

  const aPriority = priorityWeight(a.priority)
  const bPriority = priorityWeight(b.priority)
  if (aPriority !== bPriority) return aPriority - bPriority

  const aCreated = a.created_at ?? ''
  const bCreated = b.created_at ?? ''
  if (aCreated !== bCreated) return aCreated.localeCompare(bCreated)

  return a.title.localeCompare(b.title)
}

export function sortTasks(tasks: Task[], today: Date | string): Task[] {
  return [...tasks].sort((a, b) => compareTasks(a, b, today))
}
