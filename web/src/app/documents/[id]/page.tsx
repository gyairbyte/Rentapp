import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDocument } from '@/lib/actions/documents'
import { getProperty } from '@/lib/actions/property'
import { createClient } from '@/lib/supabase/client'
import { REVIEW_STATUSES, PROCESSING_STATUSES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export default async function DocumentDetailPage({ params }: { params: { id: string } }) {
  const document = await getDocument(params.id)
  if (!document) notFound()

  const property = document.property_id ? await getProperty(document.property_id) : null
  const supabase = createClient()
  let signedUrl: string | null = null
  if (document.storage_path) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(document.storage_path, 3600)
    signedUrl = data?.signedUrl ?? null
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold break-all">{document.original_filename}</h1>
      <div className="text-foreground/70 space-y-1">
        {property && <p>Property: {property.nickname}</p>}
        {document.document_type && <p className="capitalize">Type: {document.document_type.replace(/_/g, ' ')}</p>}
        {document.issuer && <p>Issuer: {document.issuer}</p>}
        {document.document_date && <p>Date: {document.document_date}</p>}
        <p>
          Review: {REVIEW_STATUSES.find((s) => s.value === document.review_status)?.label ?? document.review_status}
        </p>
        <p>
          Processing: {PROCESSING_STATUSES.find((s) => s.value === document.processing_status)?.label ?? document.processing_status}
        </p>
      </div>
      {signedUrl ? (
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 inline-block"
        >
          View file
        </a>
      ) : (
        <p className="text-foreground/70">Unable to generate file link.</p>
      )}
      <div>
        <Link href="/documents" className="text-sm underline">
          Back to documents
        </Link>
      </div>
    </div>
  )
}
