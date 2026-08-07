import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDocument, getSignedDocumentUrl } from '@/lib/actions/documents'
import { getProperty } from '@/lib/actions/property'
import { getAccount } from '@/lib/actions/account'
import { getParty } from '@/lib/actions/party'
import { REVIEW_STATUSES, PROCESSING_STATUSES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const document = await getDocument(id)
  if (!document) notFound()

  const [property, account, party] = await Promise.all([
    document.property_id ? getProperty(document.property_id) : null,
    document.account_id ? getAccount(document.account_id) : null,
    document.party_id ? getParty(document.party_id) : null,
  ])

  const signedUrl = await getSignedDocumentUrl(document.storage_path)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold break-all">{document.original_filename}</h1>
      <div className="text-foreground/70 space-y-1">
        {property && <p>Property: {property.nickname}</p>}
        {account && <p>Account: {account.account_type.replace(/_/g, ' ')} {account.account_number}</p>}
        {party && <p>Party: {party.name}</p>}
        {document.document_type && <p className="capitalize">Type: {document.document_type.replace(/_/g, ' ')}</p>}
        {document.issuer && <p>Issuer: {document.issuer}</p>}
        {document.document_date && <p>Date: {document.document_date}</p>}
        <p>
          Review: {REVIEW_STATUSES.find((s) => s.value === document.review_status)?.label ?? document.review_status}
        </p>
        <p>
          Processing: {PROCESSING_STATUSES.find((s) => s.value === document.processing_status)?.label ?? document.processing_status}
        </p>
        {document.confirmed_obligation_id && (
          <p>
            Obligation:{' '}
            <Link href={`/obligations/${document.confirmed_obligation_id}`} className="underline">
              View obligation
            </Link>
          </p>
        )}
        {document.confirmed_task_id && (
          <p>
            Task:{' '}
            <Link href={`/tasks/${document.confirmed_task_id}`} className="underline">
              View task
            </Link>
          </p>
        )}
      </div>
      {signedUrl ? (
        document.mime_type?.startsWith('image/') ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signedUrl} alt={document.original_filename} className="max-w-full max-h-[60vh] object-contain rounded-lg border" />
        ) : (
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 inline-block"
          >
            View file
          </a>
        )
      ) : (
        <p className="text-foreground/70">Unable to generate file link.</p>
      )}
      <div className="flex gap-3">
        <Link href={`/documents/${id}/review`} className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 inline-block">
          {document.review_status === 'confirmed' ? 'Edit confirmation' : 'Review'}
        </Link>
        <Link href="/documents" className="text-sm underline py-2">
          Back to documents
        </Link>
      </div>
    </div>
  )
}
