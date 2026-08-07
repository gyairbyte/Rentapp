import { getProperties } from '@/lib/actions/property'
import { PropertyCard } from './property-card'

export async function PropertyList() {
  const properties = await getProperties()

  if (properties.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-foreground/70">No properties yet.</p>
      </div>
    )
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map((property) => (
        <li key={property.id}>
          <PropertyCard property={property} />
        </li>
      ))}
    </ul>
  )
}
