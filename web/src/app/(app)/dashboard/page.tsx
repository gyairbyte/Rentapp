import Link from 'next/link'
import { getDashboardData } from '@/lib/actions/dashboard'
import { labelFor } from '@/lib/utils'
import { OBLIGATION_STATUSES } from '@/lib/constants'
import { formatMoney, formatDueDate, getBillHref } from '@/lib/bills'

export const dynamic = 'force-dynamic'

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
            viewAllHref="/bills?filter=overdue"
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
            viewAllHref="/bills?filter=due-this-month"
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">This month</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Rent expected" value={formatMoney(data.thisMonth.rentExpectedCents)} />
          <StatCard label="Rent received" value={formatMoney(data.thisMonth.rentReceivedCents)} />
          <StatCard label="Rent outstanding" value={formatMoney(data.thisMonth.rentOutstandingCents)} />
          <StatCardLink label="Bills due" value={formatMoney(data.thisMonth.billsDueCents)} href="/bills?filter=due-this-month" />
          <StatCardLink label="Bills paid" value={formatMoney(data.thisMonth.billsPaidCents)} href="/bills?filter=due-this-month" />
          <StatCardLink label="Bills outstanding" value={formatMoney(data.thisMonth.billsOutstandingCents)} href="/bills?filter=outstanding" />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Upcoming (next 30 days)</h2>
          <Link href="/bills" className="text-sm underline">
            View all bills
          </Link>
        </div>
        {data.upcoming.length === 0 ? (
          <p className="text-foreground/70">No upcoming obligations.</p>
        ) : (
          <ul className="space-y-2">
            {data.upcoming.map((bill) => (
              <li key={bill.id} className="rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <Link href={getBillHref(bill)} className="font-medium hover:underline">
                    {bill.title}
                  </Link>
                  <p className="text-sm text-foreground/70">
                    {formatDueDate(bill.earliest_due_date)} · {formatMoney(bill.remaining_cents)} remaining
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={bill.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Documents & tasks</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AttentionCard
            title="Needs review"
            items={data.documents.filter((d) => d.review_status === 'needs_review').map((d) => ({
              id: d.id,
              description: d.original_filename,
              category: 'Document',
              due_date: '',
              expected_amount: 0,
              paid_amount: 0,
              href: `/documents/${d.id}/review`,
            }))}
            empty="No documents need review"
          />
          <AttentionCard
            title="Processing failed"
            items={data.documents.filter((d) => d.processing_status === 'failed').map((d) => ({
              id: d.id,
              description: d.original_filename,
              category: 'Document',
              due_date: '',
              expected_amount: 0,
              paid_amount: 0,
              href: `/documents/${d.id}/review`,
            }))}
            empty="No failed processing"
          />
          <AttentionCard
            title="Tasks due"
            items={data.tasks.map((t) => ({
              id: t.id,
              description: t.title,
              category: 'Task',
              due_date: t.due_date ?? '',
              expected_amount: 0,
              paid_amount: 0,
              href: `/tasks/${t.id}`,
            }))}
            empty="No tasks due soon"
          />
        </div>
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
                Rent: {formatMoney(p.rentReceivedCents)} / {formatMoney(p.rentExpectedCents)} received
              </div>
              <div className="text-sm text-foreground/70">
                Outstanding: {formatMoney(p.totalOutstandingCents)} · {p.openObligations} open obligations
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

function StatCardLink({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link
      href={href}
      className="block rounded-lg border p-4 hover:border-foreground/50 transition-colors focus:outline-none focus:ring-2 focus:ring-foreground/20"
    >
      <p className="text-sm text-foreground/70">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </Link>
  )
}

function AttentionCard({
  title,
  items,
  empty,
  viewAllHref,
}: {
  title: string
  items: { id: string; description: string | null; category: string; due_date: string; expected_amount: number; paid_amount: number; href?: string }[]
  empty: string
  viewAllHref?: string
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium">{title}</h3>
        {viewAllHref && items.length > 0 && (
          <Link href={viewAllHref} className="text-xs underline">
            View all
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-foreground/70">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href ?? `/obligations/${item.id}`} className="text-sm hover:underline">
                {item.description || item.category.replace(/_/g, ' ')} {item.due_date ? `— due ${item.due_date}` : ''}
              </Link>
              {item.expected_amount > 0 && (
                <p className="text-sm text-foreground/70">
                  {formatMoney((item.expected_amount - item.paid_amount) * 100)} remaining
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-block rounded-full px-2 py-0.5 text-xs border capitalize">
      {labelFor(status, OBLIGATION_STATUSES)}
    </span>
  )
}
