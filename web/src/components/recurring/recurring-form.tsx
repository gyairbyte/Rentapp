'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useFormAction } from '@/components/ui/use-form-action'
import { Field, SelectField, TextareaField, CheckboxField } from '@/components/ui/form'
import { DIRECTIONS, OBLIGATION_CATEGORIES, FREQUENCIES } from '@/lib/constants'
import type { RecurringRule } from '@/lib/types'

type RecurringFormProps = {
  rule?: RecurringRule | null
  properties: { id: string; nickname: string }[]
  accounts: { id: string; account_type: string; account_number: string | null; property_id: string }[]
  parties: { id: string; name: string }[]
  action: (formData: FormData) => Promise<{ success: true } | { error: string; errors?: Record<string, string[]> }>
  defaultPropertyId?: string
}

export function RecurringForm({
  rule,
  properties,
  accounts,
  parties,
  action,
  defaultPropertyId,
}: RecurringFormProps) {
  const router = useRouter()
  const { formAction, error, fieldErrors, isPending } = useFormAction(action, {
    onSuccess: () => {
      router.push('/recurring')
      router.refresh()
    },
  })

  const selectedPropertyId = rule?.property_id ?? defaultPropertyId ?? ''
  const filteredAccounts = accounts.filter((a) => a.property_id === selectedPropertyId)

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <SelectField
        name="property_id"
        label="Property"
        options={properties.map((p) => ({ value: p.id, label: p.nickname }))}
        defaultValue={selectedPropertyId}
        error={fieldErrors.property_id?.[0]}
        required
      />
      <SelectField
        name="direction"
        label="Direction"
        options={DIRECTIONS}
        defaultValue={rule?.direction ?? 'payable'}
        error={fieldErrors.direction?.[0]}
        required
      />
      <SelectField
        name="category"
        label="Category"
        options={OBLIGATION_CATEGORIES}
        defaultValue={rule?.category ?? ''}
        error={fieldErrors.category?.[0]}
        required
      />
      <SelectField
        name="account_id"
        label="Account (optional)"
        options={filteredAccounts.map((a) => ({
          value: a.id,
          label: `${a.account_type.replace(/_/g, ' ')}${a.account_number ? ` — ${a.account_number}` : ''}`,
        }))}
        defaultValue={rule?.account_id ?? ''}
        error={fieldErrors.account_id?.[0]}
      />
      <SelectField
        name="party_id"
        label="Party / Provider (optional)"
        options={parties.map((p) => ({ value: p.id, label: p.name }))}
        defaultValue={rule?.party_id ?? ''}
        error={fieldErrors.party_id?.[0]}
      />
      <Field
        name="description"
        label="Description"
        defaultValue={rule?.description ?? ''}
        error={fieldErrors.description?.[0]}
      />
      <Field
        name="amount"
        label="Amount"
        type="number"
        step="0.01"
        min="0"
        defaultValue={rule?.amount ?? ''}
        error={fieldErrors.amount?.[0]}
        required
      />
      <SelectField
        name="frequency"
        label="Frequency"
        options={FREQUENCIES}
        defaultValue={rule?.frequency ?? ''}
        error={fieldErrors.frequency?.[0]}
        required
      />
      <Field
        name="day_of_month"
        label="Day of month"
        type="number"
        min="1"
        max="31"
        defaultValue={rule?.day_of_month ?? 1}
        error={fieldErrors.day_of_month?.[0]}
        required
      />
      <Field
        name="start_date"
        label="Start date"
        type="date"
        defaultValue={rule?.start_date ?? ''}
        error={fieldErrors.start_date?.[0]}
        required
      />
      <Field
        name="end_date"
        label="End date (optional)"
        type="date"
        defaultValue={rule?.end_date ?? ''}
        error={fieldErrors.end_date?.[0]}
      />
      <CheckboxField
        name="active"
        label="Active"
        defaultChecked={rule?.active ?? true}
        value="on"
      />
      <TextareaField
        name="notes"
        label="Notes"
        defaultValue={rule?.notes ?? ''}
        error={fieldErrors.notes?.[0]}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : rule ? 'Save changes' : 'Create rule'}
        </button>
        <Link
          href="/recurring"
          className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
