'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFormAction } from '@/components/ui/use-form-action'
import { Field, SelectField, TextareaField } from '@/components/ui/form'
import { DOCUMENT_TYPES } from '@/lib/constants'
import type { Document } from '@/lib/types'

const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

type CreateDocumentSuccess = { success: true; id?: string; duplicateDocumentId?: string }
type CreateDocumentResult = CreateDocumentSuccess | { error: string; errors?: Record<string, string[]>; duplicateDocumentId?: string }

type AccountOption = { id: string; account_type: string; account_number: string | null; property_id: string }
type PartyOption = { id: string; name: string; party_type: string; property_id: string | null }
type ObligationOption = { id: string; description: string | null; category: string; property_id: string }

type DocumentFormProps = {
  document?: Document | null
  properties: { id: string; nickname: string }[]
  accounts: AccountOption[]
  parties: PartyOption[]
  obligations: ObligationOption[]
  action: (formData: FormData) => Promise<CreateDocumentResult>
  defaultPropertyId?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function validateFile(file: File | null): string | null {
  if (!file || file.size === 0) return 'A file is required'
  if (!ACCEPTED_MIME_TYPES.includes(file.type.toLowerCase())) {
    return 'Unsupported file type. Use JPEG, PNG, WebP, or PDF.'
  }
  if (file.size > MAX_FILE_SIZE_BYTES) return 'File too large. Maximum size is 10 MB.'
  return null
}

export function DocumentForm({
  document: doc,
  properties,
  accounts,
  parties,
  obligations,
  action,
  defaultPropertyId,
}: DocumentFormProps) {
  const router = useRouter()
  const [propertyId, setPropertyId] = useState(doc?.property_id ?? defaultPropertyId ?? '')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [duplicateInfo, setDuplicateInfo] = useState<{ id: string } | null>(null)

  const filteredAccounts = useMemo(() => {
    if (!propertyId) return accounts
    return accounts.filter((a) => a.property_id === propertyId)
  }, [accounts, propertyId])

  const filteredParties = useMemo(() => {
    if (!propertyId) return parties
    return parties.filter((p) => p.property_id === null || p.property_id === propertyId)
  }, [parties, propertyId])

  const filteredObligations = useMemo(() => {
    if (!propertyId) return obligations
    return obligations.filter((o) => o.property_id === propertyId)
  }, [obligations, propertyId])

  const { formAction, error, fieldErrors, isPending } = useFormAction<CreateDocumentSuccess>(action, {
    onSuccess: (res) => {
      if (res.duplicateDocumentId) {
        setDuplicateInfo({ id: res.duplicateDocumentId })
        return
      }
      const id = res.id
      if (id) {
        router.push(`/documents/${id}`)
      } else {
        router.push('/documents')
      }
      router.refresh()
    },
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setSelectedFile(file)
    setFileError(validateFile(file))
  }

  async function handleSubmit(formData: FormData) {
    setDuplicateInfo(null)
    if (!doc) {
      const validation = validateFile(selectedFile)
      if (validation) {
        setFileError(validation)
        return
      }
    }
    await formAction(formData)
  }

  const accountOptions = filteredAccounts.map((a) => ({
    value: a.id,
    label: `${a.account_type.replace(/_/g, ' ')}${a.account_number ? ` · ${a.account_number}` : ''}`,
  }))

  const partyOptions = filteredParties.map((p) => ({
    value: p.id,
    label: `${p.name} · ${p.party_type.replace(/_/g, ' ')}`,
  }))

  const obligationOptions = filteredObligations.map((o) => ({
    value: o.id,
    label: o.description || o.category.replace(/_/g, ' '),
  }))

  return (
    <form action={handleSubmit} className="max-w-xl space-y-4">
      <SelectField
        name="property_id"
        label="Property (optional)"
        options={properties.map((p) => ({ value: p.id, label: p.nickname }))}
        defaultValue={propertyId}
        onChange={(e) => setPropertyId(e.target.value)}
        error={fieldErrors.property_id?.[0]}
      />
      <SelectField
        name="document_type"
        label="Document type"
        options={DOCUMENT_TYPES}
        defaultValue={doc?.document_type ?? 'other'}
        error={fieldErrors.document_type?.[0]}
      />
      <SelectField
        name="account_id"
        label="Account (optional)"
        options={accountOptions}
        defaultValue={doc?.account_id ?? ''}
        placeholder={propertyId ? 'Select an account' : 'Select a property first or choose an account'}
        error={fieldErrors.account_id?.[0]}
      />
      <SelectField
        name="party_id"
        label="Party (optional)"
        options={partyOptions}
        defaultValue={doc?.party_id ?? ''}
        placeholder={propertyId ? 'Select a party' : 'Select a property first or choose a party'}
        error={fieldErrors.party_id?.[0]}
      />
      <SelectField
        name="obligation_id"
        label="Obligation (optional)"
        options={obligationOptions}
        defaultValue={doc?.obligation_id ?? ''}
        placeholder={propertyId ? 'Select an obligation' : 'Select a property first or choose an obligation'}
        error={fieldErrors.obligation_id?.[0]}
      />
      <Field
        name="issuer"
        label="Issuer (optional)"
        defaultValue={doc?.issuer ?? ''}
        error={fieldErrors.issuer?.[0]}
      />
      <Field
        name="document_date"
        label="Document date (optional)"
        type="date"
        defaultValue={doc?.document_date ?? ''}
        error={fieldErrors.document_date?.[0]}
      />
      <TextareaField
        name="notes"
        label="Notes (optional)"
        defaultValue={doc?.notes ?? ''}
        error={fieldErrors.notes?.[0]}
        rows={3}
      />
      {!doc && (
        <div className="flex flex-col gap-1">
          <label htmlFor="file" className="text-sm font-medium">
            File
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFileChange}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <p className="text-xs text-foreground/60">
            JPEG, PNG, WebP, or PDF up to {formatFileSize(MAX_FILE_SIZE_BYTES)}.
          </p>
          {selectedFile && (
            <p className="text-xs text-foreground/70">
              Selected: {selectedFile.name} · {formatFileSize(selectedFile.size)}
            </p>
          )}
          {fileError && <p className="text-sm text-red-600">{fileError}</p>}
          {fieldErrors.file?.[0] && <p className="text-sm text-red-600">{fieldErrors.file[0]}</p>}
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {duplicateInfo && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
          <p className="font-medium">This file has already been uploaded.</p>
          <p className="text-amber-800/80">No new document was created.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push(`/documents/${duplicateInfo.id}`)}
              className="rounded-md bg-amber-900 text-amber-50 px-3 py-1.5 text-sm font-medium hover:bg-amber-800"
            >
              View existing document
            </button>
          </div>
        </div>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending || (!doc && (fileError !== null || !selectedFile)) || Boolean(duplicateInfo)}
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : doc ? 'Update document' : 'Upload document'}
        </button>
      </div>
    </form>
  )
}
