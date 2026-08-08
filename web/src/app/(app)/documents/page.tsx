import Link from 'next/link'
import { getDocuments } from '@/lib/actions/documents'
import { getPropertyOptions } from '@/lib/actions/property'
import { createClient } from '@/lib/supabase/client'
import { REVIEW_STATUSES, PROCESSING_STATUSES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export default async function DocumentsPage() {
  const [documents, properties] = await Promise.all([getDocuments(), getPropertyOptions()])
  const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p.nickname]))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Documents</h1>
        <Link href="/documents/capture" className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90">
          Scan bill
        </Link>
      </div>
      {documents.length === 0 ? (
        <p className="text-foreground/70">No documents yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
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
    <li className="rounded-lg border p-4">
      <Link href={`/documents/${doc.id}`} className="font-semibold hover:underline break-all">
        {doc.original_filename}
      </Link>
      <p className="text-sm text-foreground/70">
        {doc.document_type ? doc.document_type.replace(/_/g, ' ') : 'Document'}
        {doc.property_id ? ` · ${propertyMap[doc.property_id] ?? ''}` : ''}
      </p>
      <p className="text-sm text-foreground/70">
        {REVIEW_STATUSES.find((s) => s.value === doc.review_status)?.label ?? doc.review_status} ·{' '}
        {PROCESSING_STATUSES.find((s) => s.value === doc.processing_status)?.label ?? doc.processing_status}
      </p>
      {signedUrl && (
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline mt-2 inline-block"
        >
          View file
        </a>
      )}
    </li>
  )
}
