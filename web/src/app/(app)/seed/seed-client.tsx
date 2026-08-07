'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { seedDemoData } from '@/lib/actions/seed'

export function SeedClient() {
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const router = useRouter()

  async function handleSeed() {
    setPending(true)
    const result = await seedDemoData()
    setPending(false)
    setMessage(result.message)
    if (result.success) {
      router.refresh()
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-bold">Development seed</h1>
      <p className="text-foreground/70">
        Create sample properties, tenants, utility accounts, recurring rules, obligations, and payments. This only runs when the account has no existing properties.
      </p>
      <button
        onClick={handleSeed}
        disabled={pending}
        className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Seeding…' : 'Seed demo data'}
      </button>
      {message && <p className="text-sm text-foreground/70">{message}</p>}
    </div>
  )
}
