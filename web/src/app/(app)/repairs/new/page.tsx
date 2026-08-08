import { RepairForm } from '@/components/repair/repair-form'
import { createRepair } from '@/lib/actions/repairs'
import { getProperties } from '@/lib/actions/property'
import { getParties } from '@/lib/actions/party'

export const dynamic = 'force-dynamic'

export default async function NewRepairPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>
}) {
  const { propertyId } = await searchParams
  const [properties, parties] = await Promise.all([getProperties(), getParties()])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Add repair</h1>
      <RepairForm
        action={createRepair}
        properties={properties}
        parties={parties}
        defaultPropertyId={propertyId}
      />
    </div>
  )
}
