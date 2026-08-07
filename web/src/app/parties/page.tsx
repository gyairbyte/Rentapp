import Link from 'next/link'
import { getParties } from '@/lib/actions/party'
import { getPropertyOptions } from '@/lib/actions/property'

export const dynamic = 'force-dynamic'

export default async function PartiesPage() {
  const [parties, properties] = await Promise.all([getParties(), getPropertyOptions()])
  const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p.nickname]))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Parties</h1>
        <Link href="/parties/new" className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90">
          Add party
        </Link>
      </div>
      {parties.length === 0 ? (
        <p className="text-foreground/70">No parties yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {parties.map((party) => (
            <li key={party.id} className="rounded-lg border p-4">
              <Link href={`/parties/${party.id}`} className="font-semibold hover:underline">
                {party.name}
              </Link>
              <p className="text-sm text-foreground/70 capitalize">
                {party.party_type.replace(/_/g, ' ')}
              </p>
              {party.property_id && (
                <p className="text-sm text-foreground/70">{propertyMap[party.property_id]}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
