'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useFormAction } from '@/components/ui/use-form-action'
import { Field, SelectField, TextareaField } from '@/components/ui/form'
import { PARTY_TYPES } from '@/lib/constants'
import type { Party } from '@/lib/types'

type PartyFormProps = {
  party?: Party | null
  properties: { id: string; nickname: string }[]
  action: (formData: FormData) => Promise<{ success: true } | { error: string; errors?: Record<string, string[]> }>
  defaultPropertyId?: string
}

export function PartyForm({ party, properties, action, defaultPropertyId }: PartyFormProps) {
  const router = useRouter()
  const { formAction, error, fieldErrors, isPending } = useFormAction(action, {
    onSuccess: () => {
      router.push('/parties')
      router.refresh()
    },
  })

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <SelectField
        name="property_id"
        label="Property (optional)"
        options={properties.map((p) => ({ value: p.id, label: p.nickname }))}
        defaultValue={party?.property_id ?? defaultPropertyId ?? ''}
        error={fieldErrors.property_id?.[0]}
      />
      <SelectField
        name="party_type"
        label="Type"
        options={PARTY_TYPES}
        defaultValue={party?.party_type ?? ''}
        error={fieldErrors.party_type?.[0]}
        required
      />
      <Field
        name="name"
        label="Name"
        defaultValue={party?.name ?? ''}
        error={fieldErrors.name?.[0]}
        required
      />
      <Field
        name="email"
        label="Email"
        type="email"
        defaultValue={party?.email ?? ''}
        error={fieldErrors.email?.[0]}
      />
      <Field
        name="phone"
        label="Phone"
        defaultValue={party?.phone ?? ''}
        error={fieldErrors.phone?.[0]}
      />
      <TextareaField
        name="notes"
        label="Notes"
        defaultValue={party?.notes ?? ''}
        error={fieldErrors.notes?.[0]}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : party ? 'Save changes' : 'Create party'}
        </button>
        <Link
          href="/parties"
          className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
