import { PartyForm } from '@/components/party/party-form'
import { createParty } from '@/lib/actions/party'
import { getPropertyOptions } from '@/lib/actions/property'

export const dynamic = 'force-dynamic'

export default async function NewPartyPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
  const { propertyId } = await searchParams
  const properties = await getPropertyOptions()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Add party</h1>
      <PartyForm properties={properties} action={createParty} defaultPropertyId={propertyId} />
    </div>
  )
}
