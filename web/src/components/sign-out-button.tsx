'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/actions/auth'

export function SignOutButton() {
  const [isPending, setIsPending] = useState(false)
  const router = useRouter()

  async function handleClick() {
    setIsPending(true)
    const result = await signOut()
    setIsPending(false)
    if ('success' in result) {
      router.push('/login')
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
