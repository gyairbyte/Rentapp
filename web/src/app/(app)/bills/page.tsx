import Link from 'next/link'
import { getBills } from '@/lib/actions/bills'
import { labelFor } from '@/lib/utils'
import { OBLIGATION_STATUSES, OBLIGATION_CATEGORIES } from '@/lib/constants'
import { formatMoney, formatDueDate, getBillHref } from '@/lib/bills'

export const dynamic = 'force-dynamic'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'outstanding', label: 'Outstanding' },
  { value: 'due-this-month', label: 'Due this month' },
  { value: 'overdue', label: 'Overdue' },
]

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter } = await searchParams
  const { bills, filter: activeFilter } = await getBills({ filter })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">Bills</h1>
        <Link href="/obligations/new" className="text-sm underline">
          Add obligation
        </Link>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Bill filters">
        {FILTERS.map((f) => {
          const active = activeFilter === f.value
          return (
            <Link
              key={f.value}
              href={`/bills?filter=${f.value}`}
              role="tab"
              aria-selected={active}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-foreground text-background'
                  : 'border hover:bg-foreground/10'
              }`}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {bills.length === 0 ? (
        <div className="rounded-lg border p-6 text-center">
          <p className="text-foreground/70">
            {activeFilter === 'overdue'
              ? 'No overdue bills.'
              : activeFilter === 'due-this-month'
              ? 'No bills due this month.'
              : activeFilter === 'outstanding'
              ? 'No outstanding bills.'
              : 'No bills yet.'}
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bills.map((bill) => (
            <li key={bill.id}>
              <Link
                href={getBillHref(bill)}
                className="block rounded-lg border p-4 hover:border-foreground/50 transition-colors focus:outline-none focus:ring-2 focus:ring-foreground/20"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{bill.title}</div>
                  {bill.status && (
                    <StatusBadge status={bill.status} />
                  )}
                </div>

                <div className="mt-2 space-y-1 text-sm text-foreground/70">
                  {bill.property && <p>Property: {bill.property.nickname}</p>}
                  {bill.category && (
                    <p className="capitalize">Category: {labelFor(bill.category, OBLIGATION_CATEGORIES)}</p>
                  )}
                  <p>Total: {formatMoney(bill.total_cents)}</p>
                  <p>Remaining: {formatMoney(bill.remaining_cents)}</p>
                  {bill.earliest_due_date && (
                    <p>Next due: {formatDueDate(bill.earliest_due_date)}</p>
                  )}
                  {bill.is_document_backed && (
                    <p className="text-xs">Source document attached</p>
                  )}
                  {bill.account_label && (
                    <p className="text-xs">Account: {bill.account_label}</p>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-foreground/70">
                    {bill.paid_count} of {bill.total_count} paid
                  </span>
                  {bill.attention_summary && (
                    <span className="text-foreground/80">{bill.attention_summary}</span>
                  )}
                </div>
              </Link>
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
