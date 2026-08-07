import { notFound } from 'next/navigation'
import { getProperty, updateProperty } from '@/lib/actions/property'
import { PropertyForm } from '@/components/property/property-form'

export const dynamic = 'force-dynamic'

export default async function EditPropertyPage({
  params,
}: {
  params: { id: string }
}) {
  const property = await getProperty(params.id)
  if (!property) notFound()

  const action = updateProperty.bind(null, property.id)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit property</h1>
      <PropertyForm property={property} action={action} />
    </div>
  )
}
