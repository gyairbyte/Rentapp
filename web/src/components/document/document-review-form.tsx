'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { confirmDocument, retryProcessDocument, archiveDocument } from '@/lib/actions/documents'
import { Field, SelectField } from '@/components/ui/form'
import { DOCUMENT_TYPES, DIRECTIONS, OBLIGATION_CATEGORIES } from '@/lib/constants'
import type { Document, DocumentExtraction, DocumentMatch, PaymentOption } from '@/lib/types'
import type { DuplicateResult } from '@/lib/document-intelligence/duplicates'

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return ''
  return `$${Number(amount).toFixed(2)}`
}

function formatOptionSummary(option: PaymentOption) {
  const parts: string[] = []
  if (option.amount !== null) parts.push(formatCurrency(option.amount))
  if (option.due_date) parts.push(`due ${option.due_date}`)
  if (option.discount_amount !== null) parts.push(`discount ${formatCurrency(option.discount_amount)}`)
  if (option.penalty_amount !== null) parts.push(`penalty ${formatCurrency(option.penalty_amount)}`)
  if (parts.length > 0) return parts.join(' · ')
  return option.description ?? option.option_type.replace(/_/g, ' ')
}

export function DocumentReviewForm({
  document,
  extraction,
  proposedMatch,
  properties,
  accounts,
  parties,
  duplicates,
}: {
  document: Document
  extraction: DocumentExtraction
  proposedMatch: DocumentMatch
  properties: { id: string; nickname: string; street_address: string; city: string; state: string; zip: string }[]
  accounts: { id: string; property_id: string; account_type: string; account_number: string | null; party_id?: string | null }[]
  parties: { id: string; property_id: string | null; name: string; party_type: string }[]
  duplicates: DuplicateResult[]
}) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const proposedObligation = extraction.proposed_actions.find((a) => a.type === 'obligation')
  const proposedTask = extraction.proposed_actions.find((a) => a.type === 'task')
  const paymentOptions = proposedObligation?.payment_options ?? []
  const hasPaymentOptions = paymentOptions.length > 0
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0)
  const selectedOption = hasPaymentOptions ? paymentOptions[selectedOptionIndex] : null

  // High-confidence deterministic matches may be prefilled, but remain visibly reviewable.
  const suggestedPropertyId = document.property_id ?? (proposedMatch.confidence === 'high' ? proposedMatch.property_id : null)
  const suggestedAccountId = document.account_id ?? (proposedMatch.confidence === 'high' ? proposedMatch.account_id : null)
  const suggestedPartyId = document.party_id ?? (proposedMatch.confidence === 'high' ? proposedMatch.party_id : null)

  const defaultPropertyId = suggestedPropertyId ?? ''

  const filteredAccounts = defaultPropertyId ? accounts.filter((a) => a.property_id === defaultPropertyId) : accounts
  const filteredParties = defaultPropertyId ? parties.filter((p) => p.property_id === defaultPropertyId || p.property_id === null) : parties

  const derivedAmount = selectedOption?.amount ?? proposedObligation?.expected_amount ?? extraction.amount_due.value ?? ''
  const derivedDueDate = selectedOption?.due_date ?? proposedObligation?.due_date ?? extraction.due_date.value ?? ''

  async function handleConfirm(formData: FormData) {
    setIsPending(true)
    setError(null)
    const result = await confirmDocument(document.id, formData)
    setIsPending(false)
    if ('error' in result) {
      setError(result.error)
    } else {
      router.push(`/documents/${document.id}`)
      router.refresh()
    }
  }

  async function handleRetry() {
    setIsPending(true)
    setError(null)
    const result = await retryProcessDocument(document.id)
    setIsPending(false)
    if ('error' in result) {
      setError(result.error)
    } else {
      router.refresh()
    }
  }

  async function handleArchive() {
    setIsPending(true)
    setError(null)
    const result = await archiveDocument(document.id)
    setIsPending(false)
    if ('error' in result) {
      setError(result.error)
    } else {
      router.push('/inbox')
      router.refresh()
    }
  }

  return (
    <form action={handleConfirm} className="space-y-6">
      {duplicates.length > 0 && (
        <div className="rounded-lg border border-amber-400 p-4">
          <h3 className="font-semibold">Possible duplicate</h3>
          <ul className="text-sm mt-2 space-y-1">
            {duplicates.map((dup) => (
              <li key={dup.candidate.id}>
                <a href={`/documents/${dup.candidate.id}/review`} className="underline">
                  {dup.candidate.original_filename}
                </a>
                {' '}- {dup.reason} ({dup.confidence} confidence)
              </li>
            ))}
          </ul>
        </div>
      )}

      {proposedMatch.confidence !== 'high' && proposedMatch.reason && (
        <div className="rounded-lg border border-blue-300 p-4">
          <h3 className="font-semibold">Suggested property/account</h3>
          <p className="text-sm mt-1">{proposedMatch.reason} ({proposedMatch.confidence} confidence)</p>
          <p className="text-sm text-foreground/70">
            Please confirm or correct the property before confirming. A property is required.
          </p>
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Property & account</h2>
        <SelectField
          name="property_id"
          label="Property"
          options={properties.map((p) => ({ value: p.id, label: p.nickname }))}
          defaultValue={defaultPropertyId}
          error={!defaultPropertyId ? 'Property is required' : undefined}
        />
        <SelectField
          name="account_id"
          label="Account (optional)"
          options={[{ value: '', label: '—' }, ...filteredAccounts.map((a) => ({ value: a.id, label: `${a.account_type.replace(/_/g, ' ')}${a.account_number ? ` · ${a.account_number}` : ''}` }))]}
          defaultValue={suggestedAccountId ?? ''}
        />
        <SelectField
          name="party_id"
          label="Provider / party (optional)"
          options={[{ value: '', label: '—' }, ...filteredParties.map((p) => ({ value: p.id, label: p.name }))]}
          defaultValue={suggestedPartyId ?? ''}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Document details</h2>
        <SelectField
          name="document_type"
          label="Document type"
          options={DOCUMENT_TYPES}
          defaultValue={document.document_type ?? extraction.document_type ?? ''}
        />
        <Field
          name="issuer"
          label="Issuer / provider"
          defaultValue={document.issuer ?? extraction.issuer.value ?? ''}
        />
        <Field
          name="document_date"
          label="Document / statement date"
          type="date"
          defaultValue={document.document_date ?? extraction.document_date.value ?? ''}
        />
      </section>

      {hasPaymentOptions && (
        <section className="space-y-4 rounded-lg border p-4">
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
            This document contains multiple payment options and deadlines. Select the plan you intend to follow.
          </div>
          <input type="hidden" name="payment_options" value={JSON.stringify(paymentOptions)} />
          <input type="hidden" name="selected_payment_option_index" value={selectedOptionIndex} />
          <fieldset className="space-y-3">
            <legend className="font-semibold">Payment options</legend>
            {paymentOptions.map((option, idx) => (
              <label
                key={idx}
                className={`block rounded-lg border p-3 cursor-pointer transition-colors ${
                  selectedOptionIndex === idx ? 'border-foreground bg-foreground/5' : 'hover:bg-foreground/5'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="payment_option"
                    value={idx}
                    checked={selectedOptionIndex === idx}
                    onChange={() => setSelectedOptionIndex(idx)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{option.description ?? option.option_type.replace(/_/g, ' ')}</p>
                    <p className="text-sm text-foreground/70">{formatOptionSummary(option)}</p>
                    {option.option_type === 'installment_plan' && option.installments.length > 0 && (
                      <ul className="text-sm text-foreground/70 mt-2 space-y-1 pl-4 list-disc">
                        {option.installments.map((inst, i) => (
                          <li key={i}>
                            {inst.description ?? `Payment ${i + 1}`}: {formatCurrency(inst.amount)} due {inst.due_date}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </label>
            ))}
          </fieldset>
        </section>
      )}

      {extraction.requires !== 'neither' && (
        <section className="space-y-4 rounded-lg border p-4">
          <h2 className="text-lg font-semibold">Proposed obligation</h2>
          <SelectField
            name="direction"
            label="Direction"
            options={DIRECTIONS}
            defaultValue={proposedObligation?.direction ?? extraction.direction.value ?? 'payable'}
          />
          <SelectField
            name="category"
            label="Category"
            options={OBLIGATION_CATEGORIES}
            defaultValue={proposedObligation?.category ?? extraction.likely_category.value ?? 'other'}
          />
          <Field
            name="description"
            label="Description"
            defaultValue={proposedObligation?.description ?? `${extraction.issuer.value ?? document.original_filename} — ${extraction.likely_category.value ?? ''}`}
          />
          {hasPaymentOptions ? (
            <>
              <Field name="amount" label="Amount (set by selected payment option)" type="number" step="0.01" value={derivedAmount} readOnly />
              <Field name="due_date" label="Due date (set by selected payment option)" type="date" value={derivedDueDate} readOnly />
            </>
          ) : (
            <>
              <Field name="amount" label="Amount due" type="number" step="0.01" defaultValue={derivedAmount} />
              <Field name="due_date" label="Due date" type="date" defaultValue={derivedDueDate} />
            </>
          )}
          <Field
            name="period_start"
            label="Service period start (optional)"
            type="date"
            defaultValue={proposedObligation?.period_start ?? extraction.service_period_start.value ?? ''}
          />
          <Field
            name="period_end"
            label="Service period end (optional)"
            type="date"
            defaultValue={proposedObligation?.period_end ?? extraction.service_period_end.value ?? ''}
          />
        </section>
      )}

      {(extraction.requires === 'action' || extraction.requires === 'both' || proposedTask) && (
        <section className="space-y-4 rounded-lg border p-4">
          <h2 className="text-lg font-semibold">Proposed task</h2>
          <Field
            name="task_title"
            label="Task title"
            defaultValue={proposedTask?.title ?? extraction.required_action.value ?? ''}
          />
          <Field
            name="required_action"
            label="Required action"
            defaultValue={proposedTask?.description ?? extraction.required_action.value ?? ''}
          />
          <Field
            name="action_due_date"
            label="Action due date"
            type="date"
            defaultValue={proposedTask?.action_due_date ?? extraction.action_due_date.value ?? ''}
          />
        </section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Confirming…' : 'Confirm'}
        </button>
        <button
          type="button"
          onClick={handleRetry}
          disabled={isPending}
          className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10 disabled:opacity-50"
        >
          Retry processing
        </button>
        <button
          type="button"
          onClick={handleArchive}
          disabled={isPending}
          className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10 disabled:opacity-50"
        >
          Archive / no action
        </button>
      </div>
    </form>
  )
}
