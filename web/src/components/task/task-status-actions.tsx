'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { transitionTask } from '@/lib/actions/tasks'
import { isTaskActive, isTaskResolved } from '@/lib/tasks'

type TaskStatusActionsProps = {
  id: string
  status: string
}

export function TaskStatusActions({ id, status }: TaskStatusActionsProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function transition(nextStatus: string) {
    setIsPending(true)
    setError(null)
    const result = await transitionTask(id, nextStatus)
    setIsPending(false)
    if ('error' in result) {
      setError(result.error)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === 'open' && (
        <button
          type="button"
          onClick={() => transition('in_progress')}
          disabled={isPending}
          className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10 disabled:opacity-50"
        >
          Start task
        </button>
      )}
      {isTaskActive(status) && (
        <button
          type="button"
          onClick={() => transition('completed')}
          disabled={isPending}
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Mark complete
        </button>
      )}
      {isTaskResolved(status) && (
        <button
          type="button"
          onClick={() => transition('open')}
          disabled={isPending}
          className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10 disabled:opacity-50"
        >
          Reopen
        </button>
      )}
      {status !== 'canceled' && (
        <button
          type="button"
          onClick={() => transition('canceled')}
          disabled={isPending}
          className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10 disabled:opacity-50"
        >
          Cancel
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
