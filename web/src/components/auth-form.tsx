'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type AuthFormProps = {
  mode: 'signin' | 'signup'
  action: (formData: FormData) => Promise<{ success: true } | { error: string }>
}

export function AuthForm({ mode, action }: AuthFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPending(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const result = await action(formData)
    setIsPending(false)

    if ('error' in result) {
      setError(result.error)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  const title = mode === 'signin' ? 'Sign in' : 'Create account'
  const otherHref = mode === 'signin' ? '/signup' : '/login'
  const otherLabel = mode === 'signin' ? 'Create an account' : 'Sign in instead'

  return (
    <div className="max-w-sm mx-auto mt-16 p-6 border rounded-lg shadow-sm">
      <h1 className="text-2xl font-bold mb-6">{title}</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              className="w-full rounded-md border px-3 py-2 pr-10 text-sm"
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((show) => !show)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-foreground/70 hover:text-foreground"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? (mode === 'signin' ? 'Signing in…' : 'Creating…') : title}
        </button>
      </form>
      <p className="mt-4 text-sm text-center">
        <Link href={otherHref} className="underline">
          {otherLabel}
        </Link>
      </p>
    </div>
  )
}
