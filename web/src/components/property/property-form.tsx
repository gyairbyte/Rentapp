'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Property } from '@/lib/types'

type PropertyFormProps = {
  property?: Property | null
  action: (formData: FormData) => Promise<
    { success: true } | { error: string; errors?: Record<string, string[]> }
  >
}

export function PropertyForm({ property, action }: PropertyFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPending(true)
    setError(null)
    setFieldErrors({})
    const formData = new FormData(e.currentTarget)
    const result = await action(formData)
    setIsPending(false)

    if ('error' in result) {
      setError(result.error)
      if (result.errors) setFieldErrors(result.errors)
    } else {
      router.push('/properties')
      router.refresh()
    }
  }

  const inputClass = 'w-full rounded-md border px-3 py-2 text-sm'
  const labelClass = 'block text-sm font-medium mb-1'

  return (
    <form onSubmit={handleSubmit} className="max-w-xl flex flex-col gap-4">
      <div>
        <label htmlFor="nickname" className={labelClass}>
          Nickname
        </label>
        <input
          id="nickname"
          name="nickname"
          defaultValue={property?.nickname ?? ''}
          className={inputClass}
        />
        {fieldErrors.nickname && (
          <p className="text-sm text-red-600 mt-1">{fieldErrors.nickname[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="street_address" className={labelClass}>
          Street address
        </label>
        <input
          id="street_address"
          name="street_address"
          defaultValue={property?.street_address ?? ''}
          className={inputClass}
        />
        {fieldErrors.street_address && (
          <p className="text-sm text-red-600 mt-1">{fieldErrors.street_address[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="city" className={labelClass}>
            City
          </label>
          <input
            id="city"
            name="city"
            defaultValue={property?.city ?? ''}
            className={inputClass}
          />
          {fieldErrors.city && (
            <p className="text-sm text-red-600 mt-1">{fieldErrors.city[0]}</p>
          )}
        </div>
        <div>
          <label htmlFor="state" className={labelClass}>
            State
          </label>
          <input
            id="state"
            name="state"
            defaultValue={property?.state ?? ''}
            className={inputClass}
          />
          {fieldErrors.state && (
            <p className="text-sm text-red-600 mt-1">{fieldErrors.state[0]}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="zip" className={labelClass}>
            ZIP
          </label>
          <input
            id="zip"
            name="zip"
            defaultValue={property?.zip ?? ''}
            className={inputClass}
          />
          {fieldErrors.zip && (
            <p className="text-sm text-red-600 mt-1">{fieldErrors.zip[0]}</p>
          )}
        </div>
        <div>
          <label htmlFor="property_type" className={labelClass}>
            Property type
          </label>
          <select
            id="property_type"
            name="property_type"
            defaultValue={property?.property_type ?? ''}
            className={inputClass}
          >
            <option value="">Select…</option>
            <option value="single-family">Single-family</option>
            <option value="multi-family">Multi-family</option>
            <option value="condo">Condo</option>
            <option value="townhouse">Townhouse</option>
            <option value="apartment">Apartment</option>
            <option value="commercial">Commercial</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={property?.active ?? true}
          value="on"
        />
        Active property
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : property ? 'Save changes' : 'Create property'}
        </button>
        <Link
          href="/properties"
          className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
