import Link from 'next/link'
import { PropertyList } from '@/components/property/property-list'

export const dynamic = 'force-dynamic'

export default function PropertiesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Properties</h1>
        <Link
          href="/properties/new"
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
        >
          Add property
        </Link>
      </div>
      <PropertyList />
    </div>
  )
}
