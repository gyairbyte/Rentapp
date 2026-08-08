'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { deleteTask } from '@/lib/actions/tasks'

export function DeleteTaskButton({ id }: { id: string }) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (!confirm('Are you sure you want to delete this task?')) return
    setIsPending(true)
    setError(null)
    const result = await deleteTask(id)
    setIsPending(false)
    if ('error' in result) {
      setError(result.error)
    } else {
      router.push('/tasks')
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
        {isPending ? 'Deleting…' : 'Delete task'}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
