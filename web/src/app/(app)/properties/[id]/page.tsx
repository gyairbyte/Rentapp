import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProperty } from '@/lib/actions/property'
import { getObligationsForProperty } from '@/lib/actions/obligations'
import { getAccountsForProperty } from '@/lib/actions/account'
import { getRecurringRulesForProperty } from '@/lib/actions/recurring'
import { getDocumentsForProperty } from '@/lib/actions/documents'
import { getPartiesForProperty } from '@/lib/actions/party'
import { ArchivePropertyButton } from '@/components/property/archive-property-button'
import { toISODate } from '@/lib/actions/dates'
import { formatMoney, buildPropertySummary, toMoneyCents } from '@/lib/bills'

export const dynamic = 'force-dynamic'

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

  const summary = buildPropertySummary(
    property,
    obligations,
    { documents, accounts, parties, payments: [] },
    today,
  )

  const {
    rentExpectedCents,
    rentReceivedCents,
    rentOutstandingCents,
    billsDueCents,
    billsPaidCents,
    totalOutstandingCents,
    openObligations,
    upcoming,
  } = summary

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
            href={`/documents/capture?propertyId=${property.id}`}
            className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
          >
            Scan bill
          </Link>
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
          <p className="text-xl font-semibold">{formatMoney(rentExpectedCents)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-foreground/70">Rent received</p>
          <p className="text-xl font-semibold">{formatMoney(rentReceivedCents)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-foreground/70">Rent outstanding</p>
          <p className="text-xl font-semibold">{formatMoney(rentOutstandingCents)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-foreground/70">Outstanding</p>
          <p className="text-xl font-semibold">{formatMoney(totalOutstandingCents)}</p>
          <p className="text-sm text-foreground/70">{openObligations} open obligations</p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">This month</h2>
        <p className="text-foreground/70">
          Bills due: {formatMoney(billsDueCents)} · Bills paid: {formatMoney(billsPaidCents)} · Outstanding: {formatMoney(totalOutstandingCents)}
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
            {upcoming.map((item) => {
              const { obligation: o, href } = item
              return (
                <li key={o.id} className="rounded-lg border p-3 flex items-center justify-between">
                  <div>
                    <Link href={href} className="font-medium hover:underline">
                      {o.description || o.category.replace(/_/g, ' ')}
                    </Link>
                    <p className="text-sm text-foreground/70">
                      {o.due_date} · {formatMoney(o.remaining_cents)} remaining
                    </p>
                  </div>
                  <Link href={href} className="text-sm underline">
                    View
                  </Link>
                </li>
              )
            })}
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
                  {formatMoney(toMoneyCents(r.amount))} {r.frequency} on day {r.day_of_month}
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
