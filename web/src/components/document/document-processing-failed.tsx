'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { retryProcessDocument } from '@/lib/actions/documents'

export function DocumentProcessingFailed({
  documentId,
  technicalDetails,
}: {
  documentId: string
  technicalDetails?: string
}) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRetry() {
    setIsPending(true)
    setError(null)
    const result = await retryProcessDocument(documentId)
    setIsPending(false)
    if ('error' in result) {
      setError(result.error)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="rounded-lg border border-red-400 p-4 space-y-3">
      <p className="text-sm font-medium text-red-600">
        Document processing could not be completed. Please retry later.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleRetry}
        disabled={isPending}
        className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10 disabled:opacity-50"
      >
        {isPending ? 'Retrying…' : 'Retry processing'}
      </button>
      {technicalDetails && (
        <details className="text-xs text-foreground/60">
          <summary className="cursor-pointer">Technical details</summary>
          <pre className="mt-1 whitespace-pre-wrap break-all">{technicalDetails}</pre>
        </details>
      )}
    </div>
  )
}
