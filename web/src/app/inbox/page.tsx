import Link from 'next/link'
import { getDocuments } from '@/lib/actions/documents'
import { getPropertyOptions } from '@/lib/actions/property'
import { createClient } from '@/lib/supabase/client'
import { REVIEW_STATUSES, PROCESSING_STATUSES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  const [documents, properties] = await Promise.all([getDocuments(), getPropertyOptions()])
  const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p.nickname]))

  const inboxItems = documents.filter(
    (d) => d.review_status === 'pending' || d.processing_status === 'pending' || d.processing_status === 'processing'
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <Link href="/documents/new" className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90">
          Upload
        </Link>
      </div>
      {inboxItems.length === 0 ? (
        <p className="text-foreground/70">Nothing to review.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {inboxItems.map((doc) => (
            <InboxCard key={doc.id} document={doc} propertyMap={propertyMap} />
          ))}
        </ul>
      )}
    </div>
  )
}

async function InboxCard({
  document: doc,
  propertyMap,
}: {
  document: Awaited<ReturnType<typeof getDocuments>>[number]
  propertyMap: Record<string, string>
}) {
  const supabase = createClient()
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
        {propertyMap[doc.property_id ?? ''] ?? 'Unknown property'}
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
