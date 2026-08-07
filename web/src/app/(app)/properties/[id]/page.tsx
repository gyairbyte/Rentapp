import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProperty } from '@/lib/actions/property'
import { getObligationsForProperty } from '@/lib/actions/obligations'
import { getAccountsForProperty } from '@/lib/actions/account'
import { getRecurringRulesForProperty } from '@/lib/actions/recurring'
import { getDocumentsForProperty } from '@/lib/actions/documents'
import { getPartiesForProperty } from '@/lib/actions/party'
import { ArchivePropertyButton } from '@/components/property/archive-property-button'
import { startOfMonth, endOfMonth, toISODate } from '@/lib/actions/dates'

export const dynamic = 'force-dynamic'

function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`
}

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const property = await getProperty(id)
  if (!property) notFound()

  const [obligations, accounts, recurring, documents, parties] = await Promise.all([
    getObligationsForProperty(id),
    getAccountsForProperty(id),
    getRecurringRulesForProperty(id),
    getDocumentsForProperty(id),
    getPartiesForProperty(id),
  ])

  const today = toISODate(new Date())
  const monthStart = toISODate(startOfMonth(new Date()))
  const monthEnd = toISODate(endOfMonth(new Date()))
  const inMonth = (dueDate: string) => dueDate >= monthStart && dueDate <= monthEnd

  const rentObligations = obligations.filter((o) => o.category === 'rent' && inMonth(o.due_date))
  const rentExpected = rentObligations.reduce((sum, o) => sum + o.expected_amount, 0)
  const rentReceived = rentObligations.reduce((sum, o) => sum + o.paid_amount, 0)

  const bills = obligations.filter((o) => o.direction === 'payable' && inMonth(o.due_date))
  const billsDue = bills.reduce((sum, o) => sum + o.expected_amount, 0)
  const billsPaid = bills.reduce((sum, o) => sum + o.paid_amount, 0)

  const outstanding = obligations.filter((o) => o.paid_amount < o.expected_amount)
  const upcoming = obligations
    .filter((o) => o.due_date >= today && o.paid_amount < o.expected_amount)
    .slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{property.nickname}</h1>
          <p className="text-foreground/70">
            {property.street_address}
            <br />
            {property.city}, {property.state} {property.zip}
          </p>
          {property.property_type && (
            <p className="text-foreground/70 capitalize mt-1">
              {property.property_type.replace(/_/g, ' ')}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/properties/${property.id}/edit`}
            className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10"
          >
            Edit
          </Link>
          <ArchivePropertyButton id={property.id} />
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-foreground/70">Rent expected</p>
          <p className="text-xl font-semibold">{formatCurrency(rentExpected)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-foreground/70">Rent received</p>
          <p className="text-xl font-semibold">{formatCurrency(rentReceived)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-foreground/70">Rent outstanding</p>
          <p className="text-xl font-semibold">{formatCurrency(rentExpected - rentReceived)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-foreground/70">Open obligations</p>
          <p className="text-xl font-semibold">{outstanding.length}</p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">This month</h2>
        <p className="text-foreground/70">
          Bills due: {formatCurrency(billsDue)} · Bills paid: {formatCurrency(billsPaid)} · Outstanding: {formatCurrency(billsDue - billsPaid)}
        </p>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Upcoming</h2>
          <Link href={`/obligations/new?propertyId=${property.id}`} className="text-sm underline">
            Add obligation
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-foreground/70">No upcoming obligations.</p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((o) => (
              <li key={o.id} className="rounded-lg border p-3 flex items-center justify-between">
                <div>
                  <Link href={`/obligations/${o.id}`} className="font-medium hover:underline">
                    {o.description || o.category.replace(/_/g, ' ')}
                  </Link>
                  <p className="text-sm text-foreground/70">
                    {o.due_date} · {formatCurrency(o.expected_amount - o.paid_amount)} remaining
                  </p>
                </div>
                <Link href={`/obligations/${o.id}/pay`} className="text-sm underline">
                  Pay
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Accounts</h2>
          <Link href={`/accounts/new?propertyId=${property.id}`} className="text-sm underline">
            Add account
          </Link>
        </div>
        {accounts.length === 0 ? (
          <p className="text-foreground/70">No accounts yet.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {accounts.map((a) => (
              <li key={a.id} className="rounded-lg border p-3">
                <Link href={`/accounts/${a.id}`} className="font-medium hover:underline">
                  {a.account_type.replace(/_/g, ' ')}
                </Link>
                {a.account_number && <p className="text-sm text-foreground/70">{a.account_number}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Recurring rules</h2>
          <Link href={`/recurring/new?propertyId=${property.id}`} className="text-sm underline">
            Add recurring
          </Link>
        </div>
        {recurring.length === 0 ? (
          <p className="text-foreground/70">No recurring rules yet.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {recurring.map((r) => (
              <li key={r.id} className="rounded-lg border p-3">
                <Link href={`/recurring/${r.id}`} className="font-medium hover:underline">
                  {r.description || r.category.replace(/_/g, ' ')}
                </Link>
                <p className="text-sm text-foreground/70">
                  {formatCurrency(r.amount)} {r.frequency} on day {r.day_of_month}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Parties</h2>
          <Link href={`/parties/new?propertyId=${property.id}`} className="text-sm underline">
            Add party
          </Link>
        </div>
        {parties.length === 0 ? (
          <p className="text-foreground/70">No parties linked yet.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {parties.map((p) => (
              <li key={p.id} className="rounded-lg border p-3">
                <Link href={`/parties/${p.id}`} className="font-medium hover:underline">
                  {p.name}
                </Link>
                <p className="text-sm text-foreground/70 capitalize">
                  {p.party_type.replace(/_/g, ' ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Documents</h2>
          <Link href={`/documents/new?propertyId=${property.id}`} className="text-sm underline">
            Upload
          </Link>
        </div>
        {documents.length === 0 ? (
          <p className="text-foreground/70">No documents yet.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {documents.slice(0, 5).map((d) => (
              <li key={d.id} className="rounded-lg border p-3">
                <Link href={`/documents/${d.id}`} className="font-medium hover:underline">
                  {d.original_filename}
                </Link>
                <p className="text-sm text-foreground/70">
                  {d.document_type || 'Document'} · {d.review_status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Repairs</h2>
        <p className="text-foreground/70">Repair tracking will be added in a future ticket.</p>
      </section>
    </div>
  )
}
