'use client'

import { useRouter } from 'next/navigation'
import { archiveProperty } from '@/lib/actions/property'
import { FormAction } from '@/components/ui/form-action'

export function ArchivePropertyButton({ id }: { id: string }) {
  const router = useRouter()

  return (
    <FormAction action={archiveProperty.bind(null, id)} onSuccess={() => router.push('/properties')}>
      <button
        type="submit"
        className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
      >
        Archive
      </button>
    </FormAction>
  )
}
