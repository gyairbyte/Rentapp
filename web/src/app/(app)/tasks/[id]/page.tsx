import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTask } from '@/lib/actions/tasks'
import { getProperties } from '@/lib/actions/property'
import { getParties } from '@/lib/actions/party'
import { getDocument } from '@/lib/actions/documents'
import { TaskForm } from '@/components/task/task-form'
import { TaskStatusActions } from '@/components/task/task-status-actions'
import { DeleteTaskButton } from '@/components/task/delete-task-button'
import { taskStatusLabel, taskPriorityLabel, isTaskOverdue, isTaskDueToday } from '@/lib/tasks'
import { formatDateOnly } from '@/lib/actions/dates'
import { updateTask } from '@/lib/actions/tasks'

export const dynamic = 'force-dynamic'

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [task, properties, parties] = await Promise.all([getTask(id), getProperties(), getParties()])

  if (!task) notFound()

  const property = task.property_id ? properties.find((p) => p.id === task.property_id) : null
  const party = task.party_id ? parties.find((p) => p.id === task.party_id) : null
  const sourceDocument = task.source_document_id ? await getDocument(task.source_document_id) : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{task.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="inline-block rounded-full px-2 py-0.5 text-xs border capitalize">
              {taskStatusLabel(task.status)}
            </span>
            <span className={`text-sm capitalize ${priorityClass(task.priority)}`}>
              {taskPriorityLabel(task.priority ?? '')} priority
            </span>
            {isTaskOverdue(task, new Date()) && (
              <span className="text-sm font-semibold text-red-600">Overdue</span>
            )}
            {isTaskDueToday(task, new Date()) && (
              <span className="text-sm font-semibold text-amber-700">Due today</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/tasks"
            className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10"
          >
            Back
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold">What & where</h2>
          {property ? (
            <p className="text-sm text-foreground/70">
              <Link href={`/properties/${property.id}`} className="hover:underline">
                {property.nickname}
              </Link>
              <br />
              {property.street_address}, {property.city}, {property.state} {property.zip}
            </p>
          ) : (
            <p className="text-sm text-foreground/70">No property assigned</p>
          )}
          {party && <p className="text-sm text-foreground/70">Party: {party.name}</p>}
          {task.description && <p className="text-sm whitespace-pre-wrap">{task.description}</p>}
          {sourceDocument && (
            <p className="text-sm">
              Source document:{' '}
              <Link href={`/documents/${sourceDocument.id}`} className="underline">
                {sourceDocument.original_filename}
              </Link>
            </p>
          )}
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold">Important dates</h2>
          <div className="text-sm text-foreground/70 space-y-1">
            <p>Created: {formatDateOnly(task.created_at)}</p>
            {task.due_date && <p>Due: {formatDateOnly(task.due_date)}</p>}
            {!task.due_date && <p>No due date</p>}
            {task.completed_at && <p>Completed: {formatDateOnly(task.completed_at)}</p>}
            <p>Updated: {formatDateOnly(task.updated_at)}</p>
          </div>
          <TaskStatusActions id={task.id} status={task.status} />
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Update task</h2>
        <TaskForm
          key={task.updated_at}
          task={task}
          properties={properties}
          parties={parties}
          action={updateTask.bind(null, id)}
          returnUrl={`/tasks/${id}`}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Danger zone</h2>
        <DeleteTaskButton id={id} />
      </section>
    </div>
  )
}

function priorityClass(priority: string | null): string {
  if (priority === 'urgent') return 'font-semibold text-red-600'
  if (priority === 'high') return 'font-semibold text-amber-700'
  if (priority === 'normal') return 'text-foreground'
  return 'text-foreground/70'
}
