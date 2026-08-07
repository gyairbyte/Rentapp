import Link from 'next/link'
import { getDashboardData } from '@/lib/actions/dashboard'
import { labelFor } from '@/lib/utils'
import { OBLIGATION_STATUSES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`
}

function statusBadge(status: string) {
  return (
    <span className="inline-block rounded-full px-2 py-0.5 text-xs border capitalize">
      {labelFor(status, OBLIGATION_STATUSES)}
    </span>
  )
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <section>
        <h2 className="text-lg font-semibold mb-3">Needs attention</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AttentionCard
            title="Overdue bills"
            items={data.needsAttention.overdueBills}
            empty="No overdue bills"
          />
          <AttentionCard
            title="Overdue rent"
            items={data.needsAttention.overdueRent}
            empty="No overdue rent"
          />
          <AttentionCard
            title="Due soon"
            items={data.needsAttention.dueSoon}
            empty="Nothing due soon"
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">This month</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Rent expected" value={formatCurrency(data.thisMonth.rentExpected)} />
          <StatCard label="Rent received" value={formatCurrency(data.thisMonth.rentReceived)} />
          <StatCard label="Rent outstanding" value={formatCurrency(data.thisMonth.rentOutstanding)} />
          <StatCard label="Bills due" value={formatCurrency(data.thisMonth.billsDue)} />
          <StatCard label="Bills paid" value={formatCurrency(data.thisMonth.billsPaid)} />
          <StatCard label="Bills outstanding" value={formatCurrency(data.thisMonth.billsOutstanding)} />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Upcoming (next 30 days)</h2>
          <Link href="/obligations" className="text-sm underline">
            View all
          </Link>
        </div>
        {data.upcoming.length === 0 ? (
          <p className="text-foreground/70">No upcoming obligations.</p>
        ) : (
          <ul className="space-y-2">
            {data.upcoming.map((o) => (
              <li key={o.id} className="rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <Link href={`/obligations/${o.id}`} className="font-medium hover:underline">
                    {o.description || o.category.replace(/_/g, ' ')}
                  </Link>
                  <p className="text-sm text-foreground/70">
                    {o.due_date} · {formatCurrency(o.expected_amount - o.paid_amount)} remaining
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(o.status)}
                  <Link href={`/obligations/${o.id}/pay`} className="text-sm underline">
                    Pay
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Properties</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.properties.map((p) => (
            <Link
              key={p.id}
              href={`/properties/${p.id}`}
              className="rounded-lg border p-4 hover:border-foreground/50 transition-colors"
            >
              <div className="font-medium">{p.nickname}</div>
              <div className="text-sm text-foreground/70 mt-1">
                Rent: {formatCurrency(p.rentReceived)} / {formatCurrency(p.rentExpected)} received
              </div>
              <div className="text-sm text-foreground/70">
                Outstanding: {formatCurrency(p.rentOutstanding)} · {p.openObligations} open obligations
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-foreground/70">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}

function AttentionCard({
  title,
  items,
  empty,
}: {
  title: string
  items: { id: string; description: string | null; category: string; due_date: string; expected_amount: number; paid_amount: number }[]
  empty: string
}) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-medium mb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-foreground/70">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/obligations/${item.id}`} className="text-sm hover:underline">
                {item.description || item.category.replace(/_/g, ' ')} — due {item.due_date}
              </Link>
              <p className="text-sm text-foreground/70">
                {formatCurrency(item.expected_amount - item.paid_amount)} remaining
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
