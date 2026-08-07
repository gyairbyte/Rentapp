import { notFound } from 'next/navigation'
import { getDocumentWithDetails } from '@/lib/actions/documents'
import { getSignedDocumentUrl } from '@/lib/actions/documents'
import { DocumentReviewForm } from '@/components/document/document-review-form'
import { PROCESSING_STATUSES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export default async function DocumentReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const details = await getDocumentWithDetails(id)
  if (!details) notFound()

  const { document, extraction, run, proposedMatch, properties, accounts, parties, duplicates } = details
  const signedUrl = await getSignedDocumentUrl(document.storage_path)

  const isProcessed = document.processing_status === 'processed'
  const isFailed = document.processing_status === 'failed'

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold break-all">{document.original_filename}</h1>
          <p className="text-sm text-foreground/70">
            {PROCESSING_STATUSES.find((s) => s.value === document.processing_status)?.label ?? document.processing_status}
          </p>
          {isFailed && document.processing_error && (
            <p className="text-sm text-red-600 mt-1">{document.processing_error}</p>
          )}
        </div>
      </div>

      {signedUrl && (
        <div className="rounded-lg border overflow-hidden">
          {document.mime_type?.startsWith('image/') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={signedUrl} alt={document.original_filename} className="max-w-full max-h-[60vh] object-contain mx-auto" />
          ) : (
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-6 text-center underline"
            >
              View original file
            </a>
          )}
        </div>
      )}

      {isProcessed || (isFailed && !run) ? (
        <DocumentReviewForm
          document={document}
          extraction={extraction}
          proposedMatch={proposedMatch}
          properties={properties}
          accounts={accounts}
          parties={parties}
          duplicates={duplicates}
          processingError={isFailed ? document.processing_error : null}
        />
      ) : isFailed ? (
        <p className="text-foreground/70">Processing failed. Try uploading a clearer image or PDF.</p>
      ) : (
        <p className="text-foreground/70">Processing… check back in a moment.</p>
      )}
    </div>
  )
}
