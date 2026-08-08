'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useFormAction } from '@/components/ui/use-form-action'
import { Field, SelectField, TextareaField } from '@/components/ui/form'
import { DIRECTIONS, OBLIGATION_CATEGORIES } from '@/lib/constants'
import type { Obligation } from '@/lib/types'

type ObligationFormProps = {
  obligation?: Obligation | null
  properties: { id: string; nickname: string }[]
  accounts: { id: string; account_type: string; account_number: string | null; property_id: string }[]
  parties: { id: string; name: string }[]
  action: (formData: FormData) => Promise<{ success: true; id?: string } | { error: string; errors?: Record<string, string[]> }>
  defaultPropertyId?: string
}

export function ObligationForm({
  obligation,
  properties,
  accounts,
  parties,
  action,
  defaultPropertyId,
}: ObligationFormProps) {
  const router = useRouter()
  const { formAction, error, fieldErrors, isPending } = useFormAction(action, {
    onSuccess: (result) => {
      router.push(result.id ? `/obligations/${result.id}` : '/obligations')
      router.refresh()
    },
  })

  const selectedPropertyId = obligation?.property_id ?? defaultPropertyId ?? ''
  const filteredAccounts = accounts.filter((a) => a.property_id === selectedPropertyId)

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      {obligation?.recurring_rule_id && (
        <input type="hidden" name="recurring_rule_id" value={obligation.recurring_rule_id} />
      )}
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
        defaultValue={obligation?.direction ?? 'payable'}
        error={fieldErrors.direction?.[0]}
        required
      />
      <SelectField
        name="category"
        label="Category"
        options={OBLIGATION_CATEGORIES}
        defaultValue={obligation?.category ?? ''}
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
        defaultValue={obligation?.account_id ?? ''}
        error={fieldErrors.account_id?.[0]}
      />
      <SelectField
        name="party_id"
        label="Party / Provider (optional)"
        options={parties.map((p) => ({ value: p.id, label: p.name }))}
        defaultValue={obligation?.party_id ?? ''}
        error={fieldErrors.party_id?.[0]}
      />
      <Field
        name="description"
        label="Description"
        defaultValue={obligation?.description ?? ''}
        error={fieldErrors.description?.[0]}
      />
      <Field
        name="expected_amount"
        label="Expected amount"
        type="number"
        step="0.01"
        min="0"
        defaultValue={obligation?.expected_amount ?? ''}
        error={fieldErrors.expected_amount?.[0]}
        required
      />
      <Field
        name="due_date"
        label="Due date"
        type="date"
        defaultValue={obligation?.due_date ?? ''}
        error={fieldErrors.due_date?.[0]}
        required
      />
      <TextareaField
        name="notes"
        label="Notes"
        defaultValue={obligation?.notes ?? ''}
        error={fieldErrors.notes?.[0]}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : obligation ? 'Save changes' : 'Create obligation'}
        </button>
        <Link
          href="/obligations"
          className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
