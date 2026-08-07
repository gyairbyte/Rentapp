'use client'

import { useState } from 'react'
import { signOut } from '@/lib/actions/auth'

export function SignOutButton() {
  const [isPending, setIsPending] = useState(false)

  async function handleClick() {
    setIsPending(true)
    const result = await signOut()
    setIsPending(false)
    if ('success' in result) {
      window.location.href = '/login'
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="w-full rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-foreground/10 disabled:opacity-50"
    >
      {isPending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
