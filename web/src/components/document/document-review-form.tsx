'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { confirmDocument, retryProcessDocument, archiveDocument } from '@/lib/actions/documents'
import { Field, SelectField } from '@/components/ui/form'
import { DOCUMENT_TYPES, DIRECTIONS, OBLIGATION_CATEGORIES } from '@/lib/constants'
import type { Document, DocumentExtraction, DocumentMatch } from '@/lib/types'
import type { DuplicateResult } from '@/lib/document-intelligence/duplicates'

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

  // High-confidence deterministic matches may be prefilled, but remain visibly reviewable.
  const suggestedPropertyId = document.property_id ?? (proposedMatch.confidence === 'high' ? proposedMatch.property_id : null)
  const suggestedAccountId = document.account_id ?? (proposedMatch.confidence === 'high' ? proposedMatch.account_id : null)
  const suggestedPartyId = document.party_id ?? (proposedMatch.confidence === 'high' ? proposedMatch.party_id : null)

  const defaultPropertyId = suggestedPropertyId ?? ''

  const filteredAccounts = defaultPropertyId ? accounts.filter((a) => a.property_id === defaultPropertyId) : accounts
  const filteredParties = defaultPropertyId ? parties.filter((p) => p.property_id === defaultPropertyId || p.property_id === null) : parties

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
          <Field
            name="amount"
            label="Amount due"
            type="number"
            step="0.01"
            defaultValue={proposedObligation?.expected_amount ?? extraction.amount_due.value ?? ''}
          />
          <Field
            name="due_date"
            label="Due date"
            type="date"
            defaultValue={proposedObligation?.due_date ?? extraction.due_date.value ?? ''}
          />
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
