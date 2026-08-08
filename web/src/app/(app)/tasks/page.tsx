import Link from 'next/link'
import { getTasks, type TaskFilter } from '@/lib/actions/tasks'
import { getProperties } from '@/lib/actions/property'
import { getParties } from '@/lib/actions/party'
import {
  isTaskOverdue,
  isTaskDueToday,
  isTaskUnscheduled,
  taskStatusLabel,
  taskPriorityLabel,
} from '@/lib/tasks'
import { TaskFilterBar } from '@/components/task/task-filter-bar'
import type { Task } from '@/lib/types'

export const dynamic = 'force-dynamic'

const FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due-today', label: 'Due today' },
  { value: 'due-soon', label: 'Due soon' },
  { value: 'unscheduled', label: 'Unscheduled' },
  { value: 'history', label: 'Completed / history' },
]

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; propertyId?: string; priority?: string }>
}) {
  const { filter, propertyId, priority } = await searchParams
  const activeFilter: TaskFilter = (FILTERS.find((f) => f.value === filter)?.value ?? 'active') as TaskFilter

  const today = new Date()
  const [tasks, properties, parties] = await Promise.all([
    getTasks({ statusFilter: activeFilter, propertyId, priority, today }),
    getProperties(),
    getParties(),
  ])

  const propertyMap = new Map(properties.map((p) => [p.id, p]))
  const partyMap = new Map(parties.map((p) => [p.id, p]))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <Link
          href="/tasks/new"
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
        >
          Add task
        </Link>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Task filters">
        {FILTERS.map((f) => {
          const active = activeFilter === f.value
          const params = new URLSearchParams()
          if (propertyId) params.set('propertyId', propertyId)
          if (priority) params.set('priority', priority)
          if (!active) params.set('filter', f.value)
          const qs = params.toString()
          return (
            <Link
              key={f.value}
              href={`/tasks${qs ? `?${qs}` : ''}`}
              role="tab"
              aria-selected={active}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? 'bg-foreground text-background' : 'border hover:bg-foreground/10'
              }`}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      <TaskFilterBar properties={properties} />

      {tasks.length === 0 ? (
        <div className="rounded-lg border p-6 text-center">
          <p className="text-foreground/70">No tasks match this view.</p>
          <Link href="/tasks/new" className="text-sm underline inline-block mt-2">
            Add a task
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} propertyMap={propertyMap} partyMap={partyMap} today={today} />
          ))}
        </ul>
      )}
    </div>
  )
}

function TaskCard({
  task,
  propertyMap,
  partyMap,
  today,
}: {
  task: Task
  propertyMap: Map<string, { nickname: string }>
  partyMap: Map<string, { name: string }>
  today: Date
}) {
  const property = task.property_id ? propertyMap.get(task.property_id) : null
  const party = task.party_id ? partyMap.get(task.party_id) : null
  const overdue = isTaskOverdue(task, today)
  const dueToday = isTaskDueToday(task, today)
  const unscheduled = isTaskUnscheduled(task)

  return (
    <li>
      <Link
        href={`/tasks/${task.id}`}
        className="block rounded-lg border p-4 hover:border-foreground/50 transition-colors focus:outline-none focus:ring-2 focus:ring-foreground/20"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium">{task.title}</div>
          <TaskStatusBadge status={task.status} />
        </div>
        <div className="mt-2 space-y-1 text-sm text-foreground/70">
          {property && <p>{property.nickname}</p>}
          {party && <p>{party.name}</p>}
          <p className="capitalize">
            Priority: <span className={priorityClass(task.priority)}>{taskPriorityLabel(task.priority ?? '')}</span>
          </p>
          {overdue && <p className="font-semibold text-red-600">Overdue</p>}
          {dueToday && <p className="font-semibold text-amber-700">Due today</p>}
          {task.due_date && !overdue && !dueToday && <p>Due {task.due_date}</p>}
          {unscheduled && <p>No due date</p>}
        </div>
      </Link>
    </li>
  )
}

function TaskStatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-block rounded-full px-2 py-0.5 text-xs border capitalize">
      {taskStatusLabel(status)}
    </span>
  )
}

function priorityClass(priority: string | null): string {
  if (priority === 'urgent') return 'font-semibold text-red-600'
  if (priority === 'high') return 'font-semibold text-amber-700'
  if (priority === 'normal') return 'text-foreground'
  return 'text-foreground/70'
}
