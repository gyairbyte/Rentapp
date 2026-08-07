'use client'

import { useFormAction } from './use-form-action'

type ActionResult =
  | { success: true }
  | { error: string; errors?: Record<string, string[]> }

export function FormAction({
  action,
  onSuccess,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<ActionResult>
  onSuccess?: () => void
  children: React.ReactNode
  className?: string
}) {
  const { formAction, error, isPending } = useFormAction(action, { onSuccess })

  return (
    <form action={formAction} className={className}>
      {children}
      {isPending && <p className="text-sm text-foreground/70 mt-2">Working…</p>}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </form>
  )
}
