import { describe, it, expect } from 'vitest'
import {
  isTaskActive,
  isTaskResolved,
  isTaskOverdue,
  isTaskDueToday,
  isTaskDueSoon,
  isTaskUnscheduled,
  classifyTaskDue,
  sortTasks,
  taskStatusLabel,
  taskPriorityLabel,
} from './tasks'
import type { Task } from './types'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    user_id: 'user-1',
    property_id: null,
    party_id: null,
    source_document_id: null,
    title: 'A task',
    description: null,
    due_date: null,
    status: 'open',
    priority: 'normal',
    completed_at: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  } as Task
}

describe('task classification', () => {
  it('treats open and in_progress as active', () => {
    expect(isTaskActive('open')).toBe(true)
    expect(isTaskActive('in_progress')).toBe(true)
    expect(isTaskActive('completed')).toBe(false)
    expect(isTaskActive('canceled')).toBe(false)
  })

  it('treats completed and canceled as resolved', () => {
    expect(isTaskResolved('completed')).toBe(true)
    expect(isTaskResolved('canceled')).toBe(true)
    expect(isTaskResolved('open')).toBe(false)
    expect(isTaskResolved('in_progress')).toBe(false)
  })

  it('identifies overdue active tasks', () => {
    const today = '2026-08-07'
    expect(isTaskOverdue(task({ due_date: '2026-08-06' }), today)).toBe(true)
    expect(isTaskOverdue(task({ due_date: '2026-08-07' }), today)).toBe(false)
    expect(isTaskOverdue(task({ due_date: '2026-08-08' }), today)).toBe(false)
    expect(isTaskOverdue(task({ due_date: '2026-08-06', status: 'completed' }), today)).toBe(false)
  })

  it('identifies due today', () => {
    const today = '2026-08-07'
    expect(isTaskDueToday(task({ due_date: '2026-08-07' }), today)).toBe(true)
    expect(isTaskDueToday(task({ due_date: '2026-08-06' }), today)).toBe(false)
  })

  it('identifies due soon', () => {
    const today = '2026-08-07'
    expect(isTaskDueSoon(task({ due_date: '2026-08-08' }), today)).toBe(true)
    expect(isTaskDueSoon(task({ due_date: '2026-08-14' }), today)).toBe(true)
    expect(isTaskDueSoon(task({ due_date: '2026-08-15' }), today)).toBe(false)
    expect(isTaskDueSoon(task({ due_date: '2026-08-07' }), today)).toBe(false)
    expect(isTaskDueSoon(task({ due_date: '2026-08-06' }), today)).toBe(false)
  })

  it('identifies unscheduled active tasks', () => {
    expect(isTaskUnscheduled(task({ due_date: null }))).toBe(true)
    expect(isTaskUnscheduled(task({ due_date: '2026-08-07' }))).toBe(false)
    expect(isTaskUnscheduled(task({ due_date: null, status: 'completed' }))).toBe(false)
  })

  it('classifies buckets', () => {
    const today = '2026-08-07'
    expect(classifyTaskDue(task({ due_date: '2026-08-06' }), today)).toBe('overdue')
    expect(classifyTaskDue(task({ due_date: '2026-08-07' }), today)).toBe('due-today')
    expect(classifyTaskDue(task({ due_date: '2026-08-10' }), today)).toBe('due-soon')
    expect(classifyTaskDue(task({ due_date: '2026-08-20' }), today)).toBe('later')
    expect(classifyTaskDue(task({ due_date: null }), today)).toBe('unscheduled')
    expect(classifyTaskDue(task({ due_date: '2026-08-06', status: 'completed' }), today)).toBe('later')
  })
})

describe('task ordering', () => {
  it('orders overdue before due today before later before unscheduled', () => {
    const today = '2026-08-07'
    const overdue = task({ id: 'overdue', due_date: '2026-08-06', title: 'Overdue' })
    const dueToday = task({ id: 'today', due_date: '2026-08-07', title: 'Today' })
    const later = task({ id: 'later', due_date: '2026-08-20', title: 'Later' })
    const unscheduled = task({ id: 'unscheduled', due_date: null, title: 'Unscheduled' })
    const sorted = sortTasks([unscheduled, later, dueToday, overdue], today)
    expect(sorted.map((t) => t.id)).toEqual(['overdue', 'today', 'later', 'unscheduled'])
  })

  it('orders urgent/high priority before other active tasks with the same due date', () => {
    const today = '2026-08-07'
    const low = task({ id: 'low', due_date: '2026-08-10', priority: 'low' })
    const urgent = task({ id: 'urgent', due_date: '2026-08-10', priority: 'urgent' })
    const normal = task({ id: 'normal', due_date: '2026-08-10', priority: 'normal' })
    const high = task({ id: 'high', due_date: '2026-08-10', priority: 'high' })
    const sorted = sortTasks([low, normal, high, urgent], today)
    expect(sorted.map((t) => t.id)).toEqual(['urgent', 'high', 'normal', 'low'])
  })

  it('keeps completed and canceled tasks out of active ordering buckets', () => {
    const today = '2026-08-07'
    const completed = task({ id: 'completed', due_date: '2026-08-06', status: 'completed' })
    const canceled = task({ id: 'canceled', due_date: '2026-08-06', status: 'canceled' })
    const active = task({ id: 'active', due_date: '2026-08-06' })
    const sorted = sortTasks([completed, active, canceled], today)
    expect(sorted[0].id).toBe('active')
  })
})

describe('labels', () => {
  it('returns status and priority labels', () => {
    expect(taskStatusLabel('in_progress')).toBe('In progress')
    expect(taskPriorityLabel('urgent')).toBe('Urgent')
  })
})
