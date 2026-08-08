'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useFormAction } from '@/components/ui/use-form-action'
import { Field, SelectField, TextareaField } from '@/components/ui/form'
import { TASK_STATUSES, TASK_PRIORITIES } from '@/lib/constants'
import type { Task, Property, Party } from '@/lib/types'

type TaskFormProps = {
  task?: Task | null
  defaultPropertyId?: string
  properties: Pick<Property, 'id' | 'nickname'>[]
  parties: (Pick<Party, 'id' | 'name' | 'party_type'> & { property_id: string | null })[]
  action: (formData: FormData) => Promise<{ success: true; id?: string } | { error: string; errors?: Record<string, string[]> }>
  returnUrl?: string
}

export function TaskForm({ task, defaultPropertyId, properties, parties, action, returnUrl }: TaskFormProps) {
  const router = useRouter()
  const [propertyId, setPropertyId] = useState(task?.property_id ?? defaultPropertyId ?? '')

  const filteredParties = useMemo(() => {
    if (!propertyId) return parties
    return parties.filter((p) => p.property_id === null || p.property_id === propertyId)
  }, [parties, propertyId])

  const safeReturn =
    returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/tasks'

  const { formAction, error, fieldErrors, isPending } = useFormAction(action, {
    onSuccess: (res) => {
      if (res.id) {
        router.push(`/tasks/${res.id}`)
      } else {
        router.push(safeReturn)
      }
      router.refresh()
    },
  })

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <Field
        name="title"
        label="Title"
        defaultValue={task?.title ?? ''}
        error={fieldErrors.title?.[0]}
        required
      />
      <SelectField
        name="property_id"
        label="Property (optional)"
        options={properties.map((p) => ({ value: p.id, label: p.nickname }))}
        defaultValue={propertyId}
        onChange={(e) => setPropertyId(e.target.value)}
        error={fieldErrors.property_id?.[0]}
        placeholder="Select a property"
      />
      <SelectField
        name="party_id"
        label="Party (optional)"
        options={filteredParties.map((p) => ({ value: p.id, label: `${p.name} — ${p.party_type.replace(/_/g, ' ')}` }))}
        defaultValue={task?.party_id ?? ''}
        error={fieldErrors.party_id?.[0]}
        placeholder={propertyId ? 'Select a party' : 'Select a property first or choose a global party'}
      />
      <SelectField
        name="priority"
        label="Priority"
        options={TASK_PRIORITIES}
        defaultValue={task?.priority ?? 'normal'}
        error={fieldErrors.priority?.[0]}
        required
      />
      <SelectField
        name="status"
        label="Status"
        options={TASK_STATUSES}
        defaultValue={task?.status ?? 'open'}
        error={fieldErrors.status?.[0]}
        required
      />
      <Field
        name="due_date"
        label="Due date (optional)"
        type="date"
        defaultValue={task?.due_date ?? ''}
        error={fieldErrors.due_date?.[0]}
      />
      <TextareaField
        name="description"
        label="Description / notes"
        defaultValue={task?.description ?? ''}
        error={fieldErrors.description?.[0]}
        rows={4}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : task ? 'Save changes' : 'Create task'}
        </button>
        <Link
          href={safeReturn}
          className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
