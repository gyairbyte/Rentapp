import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getObligation } from '@/lib/actions/obligations'
import { getPaymentsForObligation } from '@/lib/actions/payments'
import { getProperty } from '@/lib/actions/property'
import { getAccount } from '@/lib/actions/account'
import { getParty } from '@/lib/actions/party'
import { OBLIGATION_STATUSES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`
}

export default async function ObligationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const obligation = await getObligation(id)
  if (!obligation) notFound()

  const [property, account, party, payments] = await Promise.all([
    getProperty(obligation.property_id),
    obligation.account_id ? getAccount(obligation.account_id) : Promise.resolve(null),
    obligation.party_id ? getParty(obligation.party_id) : Promise.resolve(null),
    getPaymentsForObligation(obligation.id),
  ])

  const statusLabel = OBLIGATION_STATUSES.find((s) => s.value === obligation.status)?.label ?? obligation.status.replace(/_/g, ' ')

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold">{obligation.description || obligation.category.replace(/_/g, ' ')}</h1>
        <span className="text-xs rounded-full px-2 py-0.5 border capitalize">{statusLabel}</span>
      </div>
      <div className="text-foreground/70 space-y-1">
        <p>Property: {property?.nickname}</p>
        {account && <p>Account: {account.account_type.replace(/_/g, ' ')} {account.account_number}</p>}
        {party && <p>Party: {party.name}</p>}
        <p>Expected: {formatCurrency(obligation.expected_amount)}</p>
        <p>Paid: {formatCurrency(obligation.paid_amount)}</p>
        <p>Remaining: {formatCurrency(obligation.expected_amount - obligation.paid_amount)}</p>
        <p>Due: {obligation.due_date}</p>
        {obligation.notes && <p>{obligation.notes}</p>}
      </div>
      <div className="flex gap-3">
        <Link href={`/obligations/${obligation.id}/pay`} className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90">
          Record payment
        </Link>
        <Link href={`/obligations/${obligation.id}/edit`} className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10">
          Edit
        </Link>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">Payments</h2>
        {payments.length === 0 ? (
          <p className="text-foreground/70">No payments yet.</p>
        ) : (
          <ul className="space-y-2">
            {payments.map((p) => (
              <li key={p.id} className="rounded-lg border p-3">
                <p className="font-medium">{formatCurrency(p.amount)} on {p.payment_date}</p>
                {p.method && <p className="text-sm text-foreground/70 capitalize">{p.method.replace(/_/g, ' ')}</p>}
                {p.confirmation_reference && <p className="text-sm text-foreground/70">{p.confirmation_reference}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
