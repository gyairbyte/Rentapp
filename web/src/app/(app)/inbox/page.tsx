import Link from 'next/link'
import { getDocuments, getSignedDocumentUrl } from '@/lib/actions/documents'
import { getPropertyOptions } from '@/lib/actions/property'
import { REVIEW_STATUSES, PROCESSING_STATUSES } from '@/lib/constants'
import type { Document } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  const [documents, properties] = await Promise.all([getDocuments(), getPropertyOptions()])
  const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p.nickname]))

  const needsReview = documents.filter((d) => d.review_status === 'needs_review')
  const processing = documents.filter((d) => d.processing_status === 'processing' || d.processing_status === 'uploaded')
  const failed = documents.filter((d) => d.processing_status === 'failed')
  const recentlyConfirmed = documents
    .filter((d) => d.review_status === 'confirmed')
    .slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <Link href="/documents/new" className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90">
          Upload
        </Link>
      </div>

      <InboxSection title="Needs review" empty="Nothing needs review" items={needsReview} propertyMap={propertyMap} />
      <InboxSection title="Processing" empty="Nothing is processing" items={processing} propertyMap={propertyMap} />
      <InboxSection title="Failed" empty="No failed documents" items={failed} propertyMap={propertyMap} />
      <InboxSection title="Recently confirmed" empty="No recently confirmed documents" items={recentlyConfirmed} propertyMap={propertyMap} />
    </div>
  )
}

async function InboxSection({
  title,
  empty,
  items,
  propertyMap,
}: {
  title: string
  empty: string
  items: Document[]
  propertyMap: Record<string, string>
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-foreground/70">{empty}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((doc) => (
            <InboxCard key={doc.id} document={doc} propertyMap={propertyMap} />
          ))}
        </ul>
      )}
    </section>
  )
}

async function InboxCard({ document: doc, propertyMap }: { document: Document; propertyMap: Record<string, string> }) {
  const signedUrl = await getSignedDocumentUrl(doc.storage_path, 600)

  return (
    <li className="rounded-lg border p-4">
      <Link href={`/documents/${doc.id}/review`} className="font-semibold hover:underline break-all">
        {doc.original_filename}
      </Link>
      <p className="text-sm text-foreground/70">
        {propertyMap[doc.property_id ?? ''] ?? 'Unknown property'}
      </p>
      <p className="text-sm text-foreground/70">
        {doc.issuer ? `${doc.issuer} · ` : ''}
        {doc.document_type ? doc.document_type.replace(/_/g, ' ') : 'Document'} ·{' '}
        {REVIEW_STATUSES.find((s) => s.value === doc.review_status)?.label ?? doc.review_status} ·{' '}
        {PROCESSING_STATUSES.find((s) => s.value === doc.processing_status)?.label ?? doc.processing_status}
      </p>
      {signedUrl && doc.mime_type?.startsWith('image/') && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={signedUrl} alt={doc.original_filename} className="mt-2 max-h-32 rounded border object-cover" />
      )}
    </li>
  )
}
