'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useFormAction } from '@/components/ui/use-form-action'
import { Field, SelectField, TextareaField } from '@/components/ui/form'
import { PAYMENT_METHODS } from '@/lib/constants'
import type { Payment } from '@/lib/types'

type PaymentFormProps = {
  payment?: Payment | null
  obligations: { id: string; description: string | null; expected_amount: number; paid_amount: number; due_date: string }[]
  defaultObligationId?: string
  defaultAmount?: number
  returnUrl?: string
  action: (formData: FormData) => Promise<{ success: true } | { error: string; errors?: Record<string, string[]> }>
}

export function PaymentForm({
  payment,
  obligations,
  defaultObligationId,
  defaultAmount,
  returnUrl,
  action,
}: PaymentFormProps) {
  const router = useRouter()
  const { formAction, error, fieldErrors, isPending } = useFormAction(action, {
    onSuccess: () => {
      const safeReturn = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : null
      router.push(safeReturn ?? '/obligations')
      router.refresh()
    },
  })

  const selectedObligationId = payment?.obligation_id ?? defaultObligationId ?? ''
  const selectedObligation = obligations.find((o) => o.id === selectedObligationId)
  const remaining = selectedObligation
    ? selectedObligation.expected_amount - selectedObligation.paid_amount
    : 0

  const amountDefault = payment?.amount ?? defaultAmount ?? remaining

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <SelectField
        name="obligation_id"
        label="Obligation"
        options={obligations.map((o) => ({
          value: o.id,
          label: `${o.description || 'Obligation'} — $${o.expected_amount.toFixed(2)} due ${o.due_date}`,
        }))}
        defaultValue={selectedObligationId}
        error={fieldErrors.obligation_id?.[0]}
        required
      />
      {selectedObligation && (
        <p className="text-sm text-foreground/70">
          Remaining: <span className="font-medium">${remaining.toFixed(2)}</span>
        </p>
      )}
      <Field
        name="amount"
        label="Amount"
        type="number"
        step="0.01"
        min="0"
        defaultValue={amountDefault > 0 ? amountDefault : ''}
        error={fieldErrors.amount?.[0]}
        required
      />
      <Field
        name="payment_date"
        label="Payment date"
        type="date"
        defaultValue={payment?.payment_date ?? new Date().toISOString().slice(0, 10)}
        error={fieldErrors.payment_date?.[0]}
        required
      />
      <SelectField
        name="method"
        label="Method"
        options={PAYMENT_METHODS}
        defaultValue={payment?.method ?? ''}
        error={fieldErrors.method?.[0]}
      />
      <Field
        name="confirmation_reference"
        label="Confirmation / reference"
        defaultValue={payment?.confirmation_reference ?? ''}
        error={fieldErrors.confirmation_reference?.[0]}
      />
      <TextareaField
        name="notes"
        label="Notes"
        defaultValue={payment?.notes ?? ''}
        error={fieldErrors.notes?.[0]}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : payment ? 'Save changes' : 'Record payment'}
        </button>
        <Link
          href={returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/obligations'}
          className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
