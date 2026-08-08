'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  confirmDocument,
  retryProcessDocument,
  archiveDocument,
  saveCorrectedInstallmentSchedule,
} from '@/lib/actions/documents'
import { formatDateOnly } from '@/lib/actions/dates'
import { Field, SelectField } from '@/components/ui/form'
import { DOCUMENT_TYPES, DIRECTIONS, OBLIGATION_CATEGORIES } from '@/lib/constants'
import {
  isSelectablePaymentOption,
  getSelectablePaymentOptions,
  getInitialSelectedPaymentOptionIndex,
  getSelectableOptionsFingerprint,
} from '@/lib/payment-options'
import {
  formatCents,
  toCents,
  validateInstallmentPlan,
  formatLatePaymentTerm,
} from '@/lib/payment-validation'
import type { Document, DocumentExtraction, DocumentMatch, PaymentOption, PaymentTerm } from '@/lib/types'
import type { DuplicateResult } from '@/lib/document-intelligence/duplicates'

function formatCurrency(amount: number | null) {
  return formatCents(toCents(amount))
}

function optionLabel(option: PaymentOption): string {
  if (option.option_type === 'installment_plan') {
    const count = (option.installments ?? []).length
    return count > 0 ? `Pay in ${count} installments` : 'Installment plan'
  }
  if (option.option_type === 'discounted') return 'Discounted full payment'
  if (option.option_type === 'full') return 'Full payment'
  return option.option_type.replace(/_/g, ' ')
}

function optionSummary(option: PaymentOption): string {
  const parts: string[] = []
  if (option.amount !== null) parts.push(formatCurrency(option.amount))
  if (option.due_date) parts.push(`due ${formatDateOnly(option.due_date)}`)
  if (option.discount_amount !== null && option.discount_amount > 0) {
    parts.push(`save ${formatCurrency(option.discount_amount)}`)
  }
  return parts.join(' · ')
}

function allLatePaymentTerms(option: PaymentOption | undefined) {
  if (!option) return []
  const terms = [...(option.late_payment_terms ?? [])]
  if (option.penalty_amount !== null && option.penalty_date) {
    terms.push({
      term_type: 'penalty' as const,
      amount: option.penalty_amount,
      rate: null,
      effective_date: option.penalty_date,
      due_date: option.penalty_date,
      description: `Penalty if not paid by ${formatDateOnly(option.penalty_date)}`,
    })
  }
  return terms
}

type DraftInstallment = {
  amount: number | string | null
  due_date: string | null
  description?: string | null
  late_payment_terms?: PaymentTerm[]
}

function installmentLateDisplay(inst: DraftInstallment): string {
  const baseCents = toCents(inst.amount)
  const lateTerms = inst.late_payment_terms ?? []
  if (baseCents === null || lateTerms.length === 0) return '—'

  const term = lateTerms[0]
  if (term.rate !== null && term.rate > 0) {
    const totalCents = baseCents + Math.round(baseCents * term.rate)
    return `${(term.rate * 100).toFixed(0)}% late ${formatCents(totalCents)}`
  }
  if (term.amount !== null) {
    return formatCents(toCents(term.amount))
  }
  return '—'
}

function InstallmentScheduleEditor({
  option,
  documentId,
  selectedOptionIndex,
  onSaved,
  onCancel,
}: {
  option: PaymentOption
  documentId: string
  selectedOptionIndex: number
  onSaved: () => void
  onCancel: () => void
}) {
  const [installments, setInstallments] = useState<DraftInstallment[]>(
    () => (option.installments ?? []).map((inst) => ({ ...inst })),
  )
  const [isPending, setIsPending] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  function updateInstallment(index: number, patch: Partial<DraftInstallment>) {
    setInstallments((prev) => prev.map((inst, i) => (i === index ? { ...inst, ...patch } : inst)))
  }

  const editValidation = validateInstallmentPlan({ option_type: 'installment_plan', amount: option.amount, installments })

  async function handleSave() {
    if (!editValidation.valid) return
    setIsPending(true)
    setEditError(null)
    const result = await saveCorrectedInstallmentSchedule(
      documentId,
      selectedOptionIndex,
      installments.map(({ amount, due_date }) => ({ amount, due_date })),
    )
    setIsPending(false)
    if ('error' in result) {
      setEditError(result.error)
    } else {
      onSaved()
    }
  }

  return (
    <div className="space-y-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-foreground/60 border-b">
            <th className="pb-2 font-medium">#</th>
            <th className="pb-2 font-medium">Amount</th>
            <th className="pb-2 font-medium">Due date</th>
            <th className="pb-2 font-medium">Late amount</th>
          </tr>
        </thead>
        <tbody>
          {installments.map((inst, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="py-2">{i + 1}</td>
              <td className="py-2 pr-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={inst.amount ?? ''}
                  onChange={(e) =>
                    updateInstallment(i, { amount: e.target.value === '' ? null : e.target.value })
                  }
                  className="w-full rounded-md border px-2 py-1 text-sm"
                  aria-label={`Installment ${i + 1} amount`}
                />
              </td>
              <td className="py-2 pr-2">
                <input
                  type="date"
                  value={inst.due_date ?? ''}
                  onChange={(e) => updateInstallment(i, { due_date: e.target.value })}
                  className="w-full rounded-md border px-2 py-1 text-sm"
                  aria-label={`Installment ${i + 1} due date`}
                />
              </td>
              <td className="py-2 text-foreground/70">{installmentLateDisplay(inst)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="text-sm space-y-1">
        <p>
          Plan total: {editValidation.planTotalFormatted} · Installment total: {editValidation.installmentTotalFormatted} · Difference: {editValidation.differenceFormatted}
        </p>
        {!editValidation.valid && <p className="text-red-600">{editValidation.error}</p>}
        {editError && <p className="text-red-600">{editError}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !editValidation.valid}
            className="rounded-md bg-foreground text-background px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Save corrections
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-foreground/10 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
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
  const [isEditingSchedule, setIsEditingSchedule] = useState(false)

  const proposedObligation = extraction.proposed_actions.find((a) => a.type === 'obligation')
  const proposedTask = extraction.proposed_actions.find((a) => a.type === 'task')
  const paymentOptions = proposedObligation?.payment_options ?? []
  const selectableOptions = getSelectablePaymentOptions(paymentOptions)
  const hasPaymentOptions = selectableOptions.length > 0
  const nonSelectableOptions = paymentOptions.filter((option) => !isSelectablePaymentOption(option))
  const currentFingerprint = getSelectableOptionsFingerprint(selectableOptions)

  const [selection, setSelection] = useState<{
    originalIndex: number | null
    fingerprint: string
  }>(() => ({
    originalIndex: getInitialSelectedPaymentOptionIndex(selectableOptions),
    fingerprint: getSelectableOptionsFingerprint(selectableOptions),
  }))

  const selectionIsCurrent = selection.fingerprint === currentFingerprint
  const effectiveSelectedOriginalIndex =
    selectionIsCurrent &&
    selection.originalIndex !== null &&
    isSelectablePaymentOption(paymentOptions[selection.originalIndex])
      ? selection.originalIndex
      : getInitialSelectedPaymentOptionIndex(selectableOptions)

  const selectedOption = effectiveSelectedOriginalIndex !== null ? paymentOptions[effectiveSelectedOriginalIndex] ?? null : null

  const suggestedPropertyId = document.property_id ?? (proposedMatch.confidence === 'high' ? proposedMatch.property_id : null)
  const suggestedAccountId = document.account_id ?? (proposedMatch.confidence === 'high' ? proposedMatch.account_id : null)
  const suggestedPartyId = document.party_id ?? (proposedMatch.confidence === 'high' ? proposedMatch.party_id : null)

  const defaultPropertyId = suggestedPropertyId ?? ''

  const filteredAccounts = defaultPropertyId ? accounts.filter((a) => a.property_id === defaultPropertyId) : accounts
  const filteredParties = defaultPropertyId
    ? parties.filter((p) => p.property_id === defaultPropertyId || p.property_id === null)
    : parties

  const derivedAmount = selectedOption?.amount ?? proposedObligation?.expected_amount ?? extraction.amount_due.value ?? ''
  const derivedDueDate = selectedOption?.due_date ?? proposedObligation?.due_date ?? extraction.due_date.value ?? ''

  const installmentValidation = selectedOption && selectedOption.option_type === 'installment_plan'
    ? validateInstallmentPlan(selectedOption)
    : null

  const canConfirmPayment =
    !hasPaymentOptions ||
    (effectiveSelectedOriginalIndex !== null && (!installmentValidation || installmentValidation.valid))

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

  function handleScheduleSaved() {
    setIsEditingSchedule(false)
    setSelection({ originalIndex: null, fingerprint: currentFingerprint })
    router.refresh()
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

      {proposedObligation && (
        <section className="rounded-lg border p-4 space-y-3">
          <h2 className="text-lg font-semibold">Bill summary</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {extraction.document_type && (
              <>
                <dt className="text-foreground/60">Document type</dt>
                <dd className="font-medium">{extraction.document_type}</dd>
              </>
            )}
            {extraction.issuer.value && (
              <>
                <dt className="text-foreground/60">Issuer / provider</dt>
                <dd className="font-medium">{extraction.issuer.value}</dd>
              </>
            )}
            {extraction.parcel_number.value && (
              <>
                <dt className="text-foreground/60">Parcel / account</dt>
                <dd className="font-medium">{extraction.parcel_number.value}</dd>
              </>
            )}
            {extraction.account_number.value && (
              <>
                <dt className="text-foreground/60">Account number</dt>
                <dd className="font-medium">{extraction.account_number.value}</dd>
              </>
            )}
            {extraction.amount_due.value !== null && extraction.amount_due.value !== undefined && (
              <>
                <dt className="text-foreground/60">Amount due</dt>
                <dd className="font-medium">{formatCurrency(extraction.amount_due.value)}</dd>
              </>
            )}
            {extraction.service_address.value && (
              <>
                <dt className="text-foreground/60">Service / property address</dt>
                <dd className="font-medium">{extraction.service_address.value}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      {hasPaymentOptions && (
        <section className="space-y-4 rounded-lg border p-4">
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
            This document contains multiple payment options and deadlines. Select the plan you intend to follow.
          </div>
          <input type="hidden" name="selected_payment_option_index" value={effectiveSelectedOriginalIndex ?? ''} />
          <fieldset className="space-y-3">
            <legend className="font-semibold">Payment options</legend>
            {selectableOptions.map(({ option, originalIndex }) => (
              <label
                key={originalIndex}
                className={`block rounded-lg border p-3 cursor-pointer transition-colors ${
                  effectiveSelectedOriginalIndex === originalIndex ? 'border-foreground bg-foreground/5' : 'hover:bg-foreground/5'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="payment_option"
                    value={originalIndex}
                    checked={effectiveSelectedOriginalIndex === originalIndex}
                    onChange={() => {
                      setIsEditingSchedule(false)
                      setSelection({ originalIndex, fingerprint: currentFingerprint })
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{optionLabel(option)}</p>
                    <p className="text-sm text-foreground/70">{optionSummary(option)}</p>
                  </div>
                </div>
              </label>
            ))}
          </fieldset>

          {selectedOption && (
            <div className="rounded-md border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Selected schedule</h3>
                {selectedOption.option_type === 'installment_plan' && !isEditingSchedule && (
                  <button
                    type="button"
                    onClick={() => setIsEditingSchedule(true)}
                    disabled={isPending}
                    className="text-sm underline text-foreground/70 hover:text-foreground disabled:opacity-50"
                  >
                    Edit schedule
                  </button>
                )}
              </div>

              {selectedOption.option_type === 'installment_plan' && (selectedOption.installments ?? []).length > 0 ? (
                <>
                  {isEditingSchedule && effectiveSelectedOriginalIndex !== null ? (
                    <InstallmentScheduleEditor
                      key={`${effectiveSelectedOriginalIndex}-${currentFingerprint}`}
                      option={selectedOption}
                      documentId={document.id}
                      selectedOptionIndex={effectiveSelectedOriginalIndex}
                      onSaved={handleScheduleSaved}
                      onCancel={() => setIsEditingSchedule(false)}
                    />
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-foreground/60 border-b">
                          <th className="pb-2 font-medium">#</th>
                          <th className="pb-2 font-medium">Amount</th>
                          <th className="pb-2 font-medium">Due date</th>
                          <th className="pb-2 font-medium">Late amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedOption.installments ?? []).map((inst, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-2">{i + 1}</td>
                            <td className="py-2">{formatCurrency(inst.amount)}</td>
                            <td className="py-2">{formatDateOnly(inst.due_date)}</td>
                            <td className="py-2 text-foreground/70">{installmentLateDisplay(inst)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {installmentValidation && !installmentValidation.valid && !isEditingSchedule && (
                    <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-900">
                      <p className="font-medium">Schedule cannot be confirmed</p>
                      <p>
                        Plan total {installmentValidation.planTotalFormatted} · Installment total {installmentValidation.installmentTotalFormatted} · Difference {installmentValidation.differenceFormatted}
                      </p>
                      <p>{installmentValidation.error}</p>
                      <p className="text-foreground/70">Edit and save the schedule before confirming.</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm">
                  <p className="font-medium">{formatCurrency(selectedOption.amount)} due {formatDateOnly(selectedOption.due_date)}</p>
                </div>
              )}

              {allLatePaymentTerms(selectedOption).length > 0 && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm">
                  <h4 className="font-medium text-amber-900 mb-1">Late-payment terms</h4>
                  <ul className="space-y-1 list-disc pl-4 text-amber-900/80">
                    {allLatePaymentTerms(selectedOption).map((term, i) => {
                      const baseCents = toCents(selectedOption.amount)
                      return <li key={i}>{baseCents !== null ? formatLatePaymentTerm(baseCents, term) : ''}</li>
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {nonSelectableOptions.length > 0 && (
            <div className="rounded-md border p-3 text-sm text-foreground/70">
              <h4 className="font-medium mb-1">Other terms</h4>
              <ul className="space-y-1 list-disc pl-4">
                {nonSelectableOptions.map((option, i) => (
                  <li key={i}>{option.description ?? option.option_type.replace(/_/g, ' ')} — {optionSummary(option)}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {extraction.requires !== 'neither' && (
        <section className="space-y-4 rounded-lg border p-4">
          <h2 className="text-lg font-semibold">Obligation details</h2>
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
          {!hasPaymentOptions && (
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

      {hasPaymentOptions && effectiveSelectedOriginalIndex === null && (
        <p className="text-sm text-amber-700">Select a payment option before confirming.</p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isPending || !canConfirmPayment}
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
