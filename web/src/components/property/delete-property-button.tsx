'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteProperty } from '@/lib/actions/property'

export function DeletePropertyButton({ id }: { id: string }) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  async function handleClick() {
    if (!confirm('Delete this property?')) return
    setIsPending(true)
    const result = await deleteProperty(id)
    setIsPending(false)
    if ('success' in result) {
      router.push('/properties')
      router.refresh()
    } else {
      alert(result.error)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="text-sm text-red-600 underline disabled:opacity-50"
    >
      {isPending ? 'Deleting…' : 'Delete'}
    </button>
  )
}
