import Link from 'next/link'
import { getRepairs } from '@/lib/actions/repairs'
import { getProperties } from '@/lib/actions/property'
import { getParties } from '@/lib/actions/party'
import { labelFor } from '@/lib/utils'
import { REPAIR_STATUSES, REPAIR_PRIORITIES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

const FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'closed', label: 'History' },
  { value: 'all', label: 'All' },
]

export default async function RepairsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter } = await searchParams
  const activeFilter = ['active', 'urgent', 'closed', 'all'].includes(filter ?? '') ? (filter as string) : 'active'

  const [repairs, properties, parties] = await Promise.all([
    getRepairs({ includeResolved: activeFilter === 'all' || activeFilter === 'closed' }),
    getProperties(),
    getParties(),
  ])

  const filtered = repairs.filter((r) => {
    if (activeFilter === 'active') return r.status !== 'closed'
    if (activeFilter === 'urgent') return r.status !== 'closed' && r.priority === 'urgent'
    if (activeFilter === 'closed') return r.status === 'closed'
    return true
  })

  const propertyMap = new Map(properties.map((p) => [p.id, p]))
  const partyMap = new Map(parties.map((p) => [p.id, p]))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">Repairs</h1>
        <Link href="/repairs/new" className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90">
          Add repair
        </Link>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Repair filters">
        {FILTERS.map((f) => {
          const active = activeFilter === f.value
          return (
            <Link
              key={f.value}
              href={`/repairs?filter=${f.value}`}
              role="tab"
              aria-selected={active}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? 'bg-foreground text-background' : 'border hover:bg-foreground/10'
              }`}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border p-6 text-center">
          <p className="text-foreground/70">
            {activeFilter === 'active'
              ? 'No active repairs.'
              : activeFilter === 'urgent'
              ? 'No urgent repairs.'
              : activeFilter === 'closed'
              ? 'No closed repairs.'
              : 'No repairs yet.'}
          </p>
          <Link href="/repairs/new" className="text-sm underline inline-block mt-2">
            Add a repair
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((repair) => {
            const property = propertyMap.get(repair.property_id)
            const party = repair.party_id ? partyMap.get(repair.party_id) : null
            return (
              <li key={repair.id}>
                <Link
                  href={`/repairs/${repair.id}`}
                  className="block rounded-lg border p-4 hover:border-foreground/50 transition-colors focus:outline-none focus:ring-2 focus:ring-foreground/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium">{repair.title}</div>
                    <RepairStatusBadge status={repair.status} />
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-foreground/70">
                    {property && <p>{property.nickname}</p>}
                    {party && <p>{party.name}</p>}
                    <p className="capitalize">
                      Priority: <span className={priorityClass(repair.priority)}>{labelFor(repair.priority, REPAIR_PRIORITIES)}</span>
                    </p>
                    <p>Reported: {repair.reported_date}</p>
                    {repair.scheduled_date && <p>Scheduled: {repair.scheduled_date}</p>}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function RepairStatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-block rounded-full px-2 py-0.5 text-xs border capitalize">
      {labelFor(status, REPAIR_STATUSES)}
    </span>
  )
}

function priorityClass(priority: string): string {
  if (priority === 'urgent') return 'font-semibold text-red-600'
  if (priority === 'normal') return 'text-foreground'
  return 'text-foreground/70'
}
