import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProperty } from '@/lib/actions/property'
import { DeletePropertyButton } from '@/components/property/delete-property-button'

export const dynamic = 'force-dynamic'

export default async function PropertyDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const property = await getProperty(params.id)
  if (!property) notFound()

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold">{property.nickname}</h1>
        <span className="text-xs rounded-full px-2 py-0.5 border">
          {property.active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <p className="text-foreground/70">
        {property.street_address}
        <br />
        {property.city}, {property.state} {property.zip}
      </p>
      {property.property_type && (
        <p className="text-foreground/70 capitalize">{property.property_type}</p>
      )}
      <div className="flex gap-3">
        <Link
          href={`/properties/${property.id}/edit`}
          className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10"
        >
          Edit
        </Link>
        <DeletePropertyButton id={property.id} />
      </div>
    </div>
  )
}
