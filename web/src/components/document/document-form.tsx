'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useFormAction } from '@/components/ui/use-form-action'
import { Field, SelectField } from '@/components/ui/form'
import { DOCUMENT_TYPES } from '@/lib/constants'
import type { Document } from '@/lib/types'

type DocumentFormProps = {
  document?: Document | null
  properties: { id: string; nickname: string }[]
  action: (formData: FormData) => Promise<{ success: true } | { error: string; errors?: Record<string, string[]> }>
  defaultPropertyId?: string
}

export function DocumentForm({ document: doc, properties, action, defaultPropertyId }: DocumentFormProps) {
  const router = useRouter()
  const { formAction, error, fieldErrors, isPending } = useFormAction(action, {
    onSuccess: () => {
      router.push('/documents')
      router.refresh()
    },
  })

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <SelectField
        name="property_id"
        label="Property (optional)"
        options={properties.map((p) => ({ value: p.id, label: p.nickname }))}
        defaultValue={doc?.property_id ?? defaultPropertyId ?? ''}
        error={fieldErrors.property_id?.[0]}
      />
      <SelectField
        name="document_type"
        label="Document type (optional)"
        options={DOCUMENT_TYPES}
        defaultValue={doc?.document_type ?? ''}
        error={fieldErrors.document_type?.[0]}
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
      {!doc && (
        <div className="flex flex-col gap-1">
          <label htmlFor="file" className="text-sm font-medium">
            File
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept="image/*,application/pdf"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {fieldErrors.file?.[0] && <p className="text-sm text-red-600">{fieldErrors.file[0]}</p>}
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Uploading…' : doc ? 'Update document' : 'Upload document'}
        </button>
        <Link
          href="/documents"
          className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
