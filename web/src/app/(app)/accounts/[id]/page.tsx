import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAccount } from '@/lib/actions/account'
import { getProperty } from '@/lib/actions/property'
import { getParty } from '@/lib/actions/party'

export const dynamic = 'force-dynamic'

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const account = await getAccount(id)
  if (!account) notFound()

  const [property, party] = await Promise.all([
    getProperty(account.property_id),
    account.party_id ? getParty(account.party_id) : Promise.resolve(null),
  ])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold capitalize">{account.account_type.replace(/_/g, ' ')}</h1>
      <div className="text-foreground/70 space-y-1">
        <p>Property: {property?.nickname}</p>
        {account.account_number && <p>Account: {account.account_number}</p>}
        {party && <p>Party: {party.name}</p>}
        {account.notes && <p>{account.notes}</p>}
      </div>
      <Link href={`/accounts/${account.id}/edit`} className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10 inline-block">
        Edit
      </Link>
    </div>
  )
}
