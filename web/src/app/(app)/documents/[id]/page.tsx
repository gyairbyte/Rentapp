import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDocument, getSignedDocumentUrl } from '@/lib/actions/documents'
import { getObligationsForDocument, getObligation } from '@/lib/actions/obligations'
import { getProperty } from '@/lib/actions/property'
import { getAccount } from '@/lib/actions/account'
import { getParty } from '@/lib/actions/party'
import { DeleteDocumentButton } from '@/components/document/delete-document-button'
import { REVIEW_STATUSES, PROCESSING_STATUSES } from '@/lib/constants'
import { formatFileSize } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const document = await getDocument(id)
  if (!document) notFound()

  const [property, account, party, linkedObligation, obligations, signedUrl] = await Promise.all([
    document.property_id ? getProperty(document.property_id) : null,
    document.account_id ? getAccount(document.account_id) : null,
    document.party_id ? getParty(document.party_id) : null,
    document.obligation_id ? getObligation(document.obligation_id) : null,
    getObligationsForDocument(id),
    getSignedDocumentUrl(document.storage_path),
  ])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold break-all">{document.original_filename}</h1>
          <div className="text-sm text-foreground/70 space-y-1">
            <p>
              {formatFileSize(document.file_size)} · {document.mime_type}
            </p>
            <p>
              Uploaded {new Date(document.created_at).toLocaleString()}
            </p>
            <p>
              Review: {REVIEW_STATUSES.find((s) => s.value === document.review_status)?.label ?? document.review_status} ·{' '}
              Processing: {PROCESSING_STATUSES.find((s) => s.value === document.processing_status)?.label ?? document.processing_status}
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href={`/documents/${id}/edit`}
            className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10"
          >
            Edit
          </Link>
          <DeleteDocumentButton id={id} />
        </div>
      </div>

      <div className="text-foreground/70 space-y-1">
        {property && <p>Property: {property.nickname}</p>}
        {account && <p>Account: {account.account_type.replace(/_/g, ' ')} {account.account_number}</p>}
        {party && <p>Party: {party.name}</p>}
        {linkedObligation && (
          <p>
            Obligation:{' '}
            <Link href={`/obligations/${linkedObligation.id}`} className="underline">
              {linkedObligation.description ?? linkedObligation.category}
            </Link>
          </p>
        )}
        {document.document_type && <p className="capitalize">Type: {document.document_type.replace(/_/g, ' ')}</p>}
        {document.issuer && <p>Issuer: {document.issuer}</p>}
        {document.document_date && <p>Date: {document.document_date}</p>}
        {document.notes && <p>Notes: {document.notes}</p>}
      </div>

      {signedUrl ? (
        <div className="rounded-lg border overflow-hidden">
          {document.mime_type?.startsWith('image/') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={signedUrl} alt={document.original_filename} className="max-w-full max-h-[60vh] object-contain mx-auto" />
          ) : (
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 inline-block"
            >
              View file
            </a>
          )}
        </div>
      ) : (
        <p className="text-foreground/70">Unable to generate file link.</p>
      )}

      {obligations.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Obligations created from this document</h2>
          <ul className="space-y-1">
            {obligations.map((obligation) => (
              <li key={obligation.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="font-medium">{obligation.description ?? obligation.category}</p>
                  <p className="text-sm text-foreground/70">
                    {obligation.direction === 'payable' ? 'Pay' : 'Receive'} ${Number(obligation.expected_amount).toFixed(2)} due {obligation.due_date}
                  </p>
                </div>
                <Link href={`/obligations/${obligation.id}`} className="text-sm underline">
                  View
                </Link>
              </li>
            ))}
          </ul>
        </section>
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
