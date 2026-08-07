import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getParty } from '@/lib/actions/party'
import { getProperty } from '@/lib/actions/property'

export const dynamic = 'force-dynamic'

export default async function PartyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const party = await getParty(id)
  if (!party) notFound()

  const property = party.property_id ? await getProperty(party.property_id) : null

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{party.name}</h1>
      <div className="text-foreground/70 space-y-1">
        <p className="capitalize">{party.party_type.replace(/_/g, ' ')}</p>
        {property && <p>Property: {property.nickname}</p>}
        {party.email && <p>{party.email}</p>}
        {party.phone && <p>{party.phone}</p>}
        {party.notes && <p>{party.notes}</p>}
      </div>
      <Link href={`/parties/${party.id}/edit`} className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10 inline-block">
        Edit
      </Link>
    </div>
  )
}
