import { notFound } from 'next/navigation'
import { PartyForm } from '@/components/party/party-form'
import { getParty, updateParty } from '@/lib/actions/party'
import { getPropertyOptions } from '@/lib/actions/property'

export const dynamic = 'force-dynamic'

export default async function EditPartyPage({ params }: { params: { id: string } }) {
  const [party, properties] = await Promise.all([getParty(params.id), getPropertyOptions()])

  if (!party) notFound()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit party</h1>
      <PartyForm party={party} properties={properties} action={updateParty.bind(null, party.id)} />
    </div>
  )
}
