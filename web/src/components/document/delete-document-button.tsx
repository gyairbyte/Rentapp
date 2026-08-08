'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteDocument } from '@/lib/actions/documents'

export function DeleteDocumentButton({ id }: { id: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setIsDeleting(true)
    setError(null)
    const result = await deleteDocument(id)
    setIsDeleting(false)
    if ('error' in result) {
      setError(result.error)
      setConfirming(false)
    } else {
      router.push('/documents')
      router.refresh()
    }
  }

  if (confirming) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <p className="font-medium">Delete this document?</p>
        <p className="text-red-800/80">The file and record will both be removed. This cannot be undone.</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={isDeleting}
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium hover:bg-red-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-md bg-red-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
        {error && <p className="mt-2 text-red-700">{error}</p>}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="rounded-md border border-red-200 text-red-700 px-4 py-2 text-sm font-medium hover:bg-red-50"
    >
      Delete
    </button>
  )
}
