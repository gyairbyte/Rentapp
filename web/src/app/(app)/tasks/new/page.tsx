import { notFound } from 'next/navigation'
import { getProperties } from '@/lib/actions/property'
import { getParties } from '@/lib/actions/party'
import { createTask } from '@/lib/actions/tasks'
import { TaskForm } from '@/components/task/task-form'

export const dynamic = 'force-dynamic'

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>
}) {
  const { propertyId } = await searchParams
  const [properties, parties] = await Promise.all([getProperties(), getParties()])

  if (propertyId && !properties.some((p) => p.id === propertyId)) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Add task</h1>
      <TaskForm
        properties={properties}
        parties={parties}
        action={createTask}
        defaultPropertyId={propertyId}
        returnUrl="/tasks"
      />
    </div>
  )
}
