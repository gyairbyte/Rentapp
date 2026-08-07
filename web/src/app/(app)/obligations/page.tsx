import Link from 'next/link'
import { getObligations } from '@/lib/actions/obligations'
import { getPropertyOptions } from '@/lib/actions/property'
import { OBLIGATION_STATUSES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`
}

export default async function ObligationsPage() {
  const [obligations, properties] = await Promise.all([getObligations(), getPropertyOptions()])
  const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p.nickname]))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Obligations</h1>
        <Link href="/obligations/new" className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90">
          Add obligation
        </Link>
      </div>
      {obligations.length === 0 ? (
        <p className="text-foreground/70">No obligations yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {obligations.map((o) => (
            <li key={o.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <Link href={`/obligations/${o.id}`} className="font-semibold hover:underline">
                  {o.description || o.category.replace(/_/g, ' ')}
                </Link>
                <span className="text-xs rounded-full px-2 py-0.5 border capitalize">
                  {OBLIGATION_STATUSES.find((s) => s.value === o.status)?.label ?? o.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-sm text-foreground/70">{propertyMap[o.property_id]}</p>
              <p className="text-sm text-foreground/70">
                {formatCurrency(o.expected_amount - o.paid_amount)} remaining · due {o.due_date}
              </p>
              <div className="mt-2 flex gap-3 text-sm">
                <Link href={`/obligations/${o.id}/pay`} className="underline">
                  Pay
                </Link>
                <Link href={`/obligations/${o.id}/edit`} className="underline">
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
