'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useFormAction } from '@/components/ui/use-form-action'
import { Field, SelectField, TextareaField } from '@/components/ui/form'
import { ACCOUNT_TYPES } from '@/lib/constants'
import type { Account } from '@/lib/types'

type AccountFormProps = {
  account?: Account | null
  properties: { id: string; nickname: string }[]
  parties: { id: string; name: string }[]
  action: (formData: FormData) => Promise<{ success: true } | { error: string; errors?: Record<string, string[]> }>
  defaultPropertyId?: string
}

export function AccountForm({ account, properties, parties, action, defaultPropertyId }: AccountFormProps) {
  const router = useRouter()
  const { formAction, error, fieldErrors, isPending } = useFormAction(action, {
    onSuccess: () => {
      router.push('/accounts')
      router.refresh()
    },
  })

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <SelectField
        name="property_id"
        label="Property"
        options={properties.map((p) => ({ value: p.id, label: p.nickname }))}
        defaultValue={account?.property_id ?? defaultPropertyId ?? ''}
        error={fieldErrors.property_id?.[0]}
        required
      />
      <SelectField
        name="party_id"
        label="Provider / Party (optional)"
        options={parties.map((p) => ({ value: p.id, label: p.name }))}
        defaultValue={account?.party_id ?? ''}
        error={fieldErrors.party_id?.[0]}
      />
      <SelectField
        name="account_type"
        label="Account type"
        options={ACCOUNT_TYPES}
        defaultValue={account?.account_type ?? ''}
        error={fieldErrors.account_type?.[0]}
        required
      />
      <Field
        name="account_number"
        label="Account number"
        defaultValue={account?.account_number ?? ''}
        error={fieldErrors.account_number?.[0]}
      />
      <TextareaField
        name="notes"
        label="Notes"
        defaultValue={account?.notes ?? ''}
        error={fieldErrors.notes?.[0]}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : account ? 'Save changes' : 'Create account'}
        </button>
        <Link
          href="/accounts"
          className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
