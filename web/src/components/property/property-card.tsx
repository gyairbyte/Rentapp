import Link from 'next/link'
import { ArchivePropertyButton } from './archive-property-button'
import type { Property } from '@/lib/types'

export function PropertyCard({ property }: { property: Property }) {
  return (
    <div className="rounded-lg border p-4 flex flex-col gap-1 hover:border-foreground/50 transition-colors">
      <div className="flex items-start justify-between">
        <Link href={`/properties/${property.id}`} className="font-semibold hover:underline">
          {property.nickname}
        </Link>
        <span className="text-xs rounded-full px-2 py-0.5 border">
          {property.active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <p className="text-sm text-foreground/70">
        {property.street_address}
        <br />
        {property.city}, {property.state} {property.zip}
      </p>
      {property.property_type && (
        <p className="text-sm text-foreground/70 capitalize">
          {property.property_type.replace(/_/g, ' ')}
        </p>
      )}
      <div className="mt-2 flex gap-2 items-center">
        <Link
          href={`/properties/${property.id}/edit`}
          className="text-sm underline"
        >
          Edit
        </Link>
        <ArchivePropertyButton id={property.id} />
      </div>
    </div>
  )
}
