import Link from 'next/link'
import { getDocuments } from '@/lib/actions/documents'
import { getPropertyOptions } from '@/lib/actions/property'
import { createClient } from '@/lib/supabase/client'
import { REVIEW_STATUSES, PROCESSING_STATUSES, DOCUMENT_TYPES } from '@/lib/constants'
import { formatFileSize } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; type?: string }>
}) {
  const { property, type } = await searchParams
  const [documents, properties] = await Promise.all([getDocuments(), getPropertyOptions()])
  const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p.nickname]))

  const filtered = documents.filter((doc) => {
    if (property && doc.property_id !== property) return false
    if (type && doc.document_type !== type) return false
    return true
  })

  const hasFilters = !!property || !!type

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Documents</h1>
        <Link
          href="/documents/new"
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
        >
          Upload document
        </Link>
      </div>

      <form action="/documents" method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="property" className="text-sm font-medium">
            Property
          </label>
          <select
            id="property"
            name="property"
            defaultValue={property ?? ''}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nickname}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="type" className="text-sm font-medium">
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={type ?? ''}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10"
        >
          Filter
        </button>
        {hasFilters && (
          <Link
            href="/documents"
            className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10"
          >
            Clear
          </Link>
        )}
      </form>

      {filtered.length === 0 ? (
        <p className="text-foreground/70">
          {documents.length === 0 ? 'No documents yet.' : 'No documents match the selected filters.'}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc) => (
            <DocumentCard key={doc.id} document={doc} propertyMap={propertyMap} />
          ))}
        </ul>
      )}
    </div>
  )
}

async function DocumentCard({
  document: doc,
  propertyMap,
}: {
  document: Awaited<ReturnType<typeof getDocuments>>[number]
  propertyMap: Record<string, string>
}) {
  const supabase = await createClient()
  let signedUrl: string | null = null
  if (doc.storage_path) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 3600)
    signedUrl = data?.signedUrl ?? null
  }

  return (
    <li className="rounded-lg border p-4 space-y-2">
      <Link href={`/documents/${doc.id}`} className="font-semibold hover:underline break-all block">
        {doc.original_filename}
      </Link>
      <div className="text-sm text-foreground/70 space-y-1">
        <p className="capitalize">{doc.document_type ? doc.document_type.replace(/_/g, ' ') : 'Document'}</p>
        {doc.property_id && <p>{propertyMap[doc.property_id] ?? ''}</p>}
        <p>
          {formatFileSize(doc.file_size)} · {doc.mime_type}
        </p>
        <p>
          {REVIEW_STATUSES.find((s) => s.value === doc.review_status)?.label ?? doc.review_status} ·{' '}
          {PROCESSING_STATUSES.find((s) => s.value === doc.processing_status)?.label ?? doc.processing_status}
        </p>
        <p>Uploaded {new Date(doc.created_at).toLocaleDateString()}</p>
      </div>
      {signedUrl && (
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline inline-block"
        >
          View file
        </a>
      )}
    </li>
  )
}
