'use client'

import { useState } from 'react'

type ActionResult =
  | { success: true }
  | { error: string; errors?: Record<string, string[]> }

export function useFormAction(
  action: (formData: FormData) => Promise<ActionResult>,
  { onSuccess }: { onSuccess?: () => void } = {}
) {
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [isPending, setIsPending] = useState(false)

  async function formAction(formData: FormData) {
    setError(null)
    setFieldErrors({})
    setIsPending(true)

    const result = await action(formData)
    setIsPending(false)

    if ('error' in result) {
      setError(result.error)
      if (result.errors) setFieldErrors(result.errors)
    } else {
      onSuccess?.()
    }
  }

  return { formAction, error, fieldErrors, isPending }
}
