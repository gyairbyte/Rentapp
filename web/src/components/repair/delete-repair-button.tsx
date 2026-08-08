'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { deleteRepair } from '@/lib/actions/repairs'

export function DeleteRepairButton({ id }: { id: string }) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setIsPending(true)
    setError(null)
    const result = await deleteRepair(id)
    setIsPending(false)
    if ('error' in result) {
      setError(result.error)
    } else {
      router.push('/repairs')
      router.refresh()
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-md border border-red-200 text-red-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? 'Deleting…' : 'Delete repair'}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
