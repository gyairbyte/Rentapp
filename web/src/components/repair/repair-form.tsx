'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useFormAction } from '@/components/ui/use-form-action'
import { Field, SelectField, TextareaField } from '@/components/ui/form'
import { REPAIR_STATUSES, REPAIR_PRIORITIES } from '@/lib/constants'
import type { Repair, Property, Party } from '@/lib/types'

type RepairFormProps = {
  repair?: Repair | null
  defaultPropertyId?: string
  properties: Pick<Property, 'id' | 'nickname'>[]
  parties: Pick<Party, 'id' | 'name' | 'party_type'>[]
  action: (formData: FormData) => Promise<{ success: true } | { error: string; errors?: Record<string, string[]> }>
  returnUrl?: string
}

export function RepairForm({ repair, defaultPropertyId, properties, parties, action, returnUrl }: RepairFormProps) {
  const router = useRouter()
  const { formAction, error, fieldErrors, isPending } = useFormAction(action, {
    onSuccess: () => {
      const safeReturn = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/repairs'
      router.push(safeReturn)
      router.refresh()
    },
  })

  const today = new Date().toISOString().slice(0, 10)

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <Field
        name="title"
        label="Title / problem"
        defaultValue={repair?.title ?? ''}
        error={fieldErrors.title?.[0]}
        required
      />
      <SelectField
        name="property_id"
        label="Property"
        options={properties.map((p) => ({ value: p.id, label: p.nickname }))}
        defaultValue={repair?.property_id ?? defaultPropertyId ?? ''}
        error={fieldErrors.property_id?.[0]}
        required
      />
      <SelectField
        name="party_id"
        label="Vendor / party (optional)"
        options={parties.map((p) => ({ value: p.id, label: `${p.name} — ${p.party_type.replace(/_/g, ' ')}` }))}
        defaultValue={repair?.party_id ?? ''}
        error={fieldErrors.party_id?.[0]}
      />
      <SelectField
        name="priority"
        label="Priority"
        options={REPAIR_PRIORITIES}
        defaultValue={repair?.priority ?? 'normal'}
        error={fieldErrors.priority?.[0]}
        required
      />
      <SelectField
        name="status"
        label="Status"
        options={REPAIR_STATUSES}
        defaultValue={repair?.status ?? 'reported'}
        error={fieldErrors.status?.[0]}
        required
      />
      <Field
        name="reported_date"
        label="Date reported"
        type="date"
        defaultValue={repair?.reported_date ?? today}
        error={fieldErrors.reported_date?.[0]}
        required
      />
      <Field
        name="scheduled_date"
        label="Scheduled date (optional)"
        type="date"
        defaultValue={repair?.scheduled_date ?? ''}
        error={fieldErrors.scheduled_date?.[0]}
      />
      <Field
        name="completed_date"
        label="Completed date (optional)"
        type="date"
        defaultValue={repair?.completed_date ?? ''}
        error={fieldErrors.completed_date?.[0]}
      />
      <TextareaField
        name="description"
        label="Description / notes"
        defaultValue={repair?.description ?? ''}
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
          {isPending ? 'Saving…' : repair ? 'Save changes' : 'Create repair'}
        </button>
        <Link
          href={returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/repairs'}
          className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
