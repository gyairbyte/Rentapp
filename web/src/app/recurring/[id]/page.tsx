import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getRecurringRule } from '@/lib/actions/recurring'
import { getProperty } from '@/lib/actions/property'
import { getAccount } from '@/lib/actions/account'
import { getParty } from '@/lib/actions/party'

export const dynamic = 'force-dynamic'

function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`
}

export default async function RecurringDetailPage({ params }: { params: { id: string } }) {
  const rule = await getRecurringRule(params.id)
  if (!rule) notFound()

  const [property, account, party] = await Promise.all([
    getProperty(rule.property_id),
    rule.account_id ? getAccount(rule.account_id) : Promise.resolve(null),
    rule.party_id ? getParty(rule.party_id) : Promise.resolve(null),
  ])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{rule.description || rule.category.replace(/_/g, ' ')}</h1>
      <div className="text-foreground/70 space-y-1">
        <p>Property: {property?.nickname}</p>
        {account && <p>Account: {account.account_type.replace(/_/g, ' ')} {account.account_number}</p>}
        {party && <p>Party: {party.name}</p>}
        <p>
          {formatCurrency(rule.amount)} {rule.frequency} on day {rule.day_of_month} starting {rule.start_date}
        </p>
        <p>Direction: {rule.direction}</p>
        <p className="capitalize">Status: {rule.active ? 'Active' : 'Inactive'}</p>
      </div>
      <div className="flex gap-3">
        <Link href={`/recurring/${rule.id}/edit`} className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10">
          Edit
        </Link>
      </div>
    </div>
  )
}
