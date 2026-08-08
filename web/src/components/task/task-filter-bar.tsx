'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import type { Property } from '@/lib/types'
import { TASK_PRIORITIES } from '@/lib/constants'

type TaskFilterBarProps = {
  properties: Pick<Property, 'id' | 'nickname'>[]
}

export function TaskFilterBar({ properties }: TaskFilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      router.push(`/tasks?${params.toString()}`)
    },
    [router, searchParams]
  )

  const propertyId = searchParams.get('propertyId') ?? ''
  const priority = searchParams.get('priority') ?? ''

  return (
    <div className="flex flex-wrap gap-2 items-end">
      <div className="flex flex-col gap-1">
        <label htmlFor="propertyFilter" className="text-sm font-medium">
          Property
        </label>
        <select
          id="propertyFilter"
          value={propertyId}
          onChange={(e) => updateParam('propertyId', e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All properties</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nickname}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="priorityFilter" className="text-sm font-medium">
          Priority
        </label>
        <select
          id="priorityFilter"
          value={priority}
          onChange={(e) => updateParam('priority', e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All priorities</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
