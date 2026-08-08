import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getRepair } from '@/lib/actions/repairs'
import { getProperties } from '@/lib/actions/property'
import { getParties } from '@/lib/actions/party'
import { RepairForm } from '@/components/repair/repair-form'
import { DeleteRepairButton } from '@/components/repair/delete-repair-button'
import { updateRepair } from '@/lib/actions/repairs'
import { labelFor } from '@/lib/utils'
import { REPAIR_STATUSES, REPAIR_PRIORITIES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export default async function RepairDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [repair, properties, parties] = await Promise.all([
    getRepair(id),
    getProperties(),
    getParties(),
  ])

  if (!repair) notFound()

  const property = properties.find((p) => p.id === repair.property_id)
  const party = repair.party_id ? parties.find((p) => p.id === repair.party_id) : null

  const nextAction = nextActionFor(repair)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{repair.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="inline-block rounded-full px-2 py-0.5 text-xs border capitalize">
              {labelFor(repair.status, REPAIR_STATUSES)}
            </span>
            <span className={`text-sm capitalize ${priorityClass(repair.priority)}`}>
              {labelFor(repair.priority, REPAIR_PRIORITIES)} priority
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/repairs"
            className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10"
          >
            Back
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold">What & where</h2>
          <p className="text-sm text-foreground/70">{property?.nickname ?? 'Unknown property'}</p>
          {property && (
            <p className="text-sm text-foreground/70">
              {property.street_address}, {property.city}, {property.state} {property.zip}
            </p>
          )}
          {party && (
            <p className="text-sm text-foreground/70">
              Vendor: {party.name} ({party.party_type.replace(/_/g, ' ')})
            </p>
          )}
          {repair.description && <p className="text-sm whitespace-pre-wrap">{repair.description}</p>}
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold">Important dates</h2>
          <div className="text-sm text-foreground/70 space-y-1">
            <p>Reported: {repair.reported_date}</p>
            {repair.scheduled_date && <p>Scheduled: {repair.scheduled_date}</p>}
            {repair.completed_date && <p>Completed: {repair.completed_date}</p>}
          </div>
          {nextAction && (
            <div className="rounded-md bg-foreground/5 p-3">
              <p className="text-sm font-medium">Next step</p>
              <p className="text-sm text-foreground/70">{nextAction}</p>
            </div>
          )}
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Update repair</h2>
        <RepairForm
          repair={repair}
          properties={properties}
          parties={parties}
          action={updateRepair.bind(null, id)}
          returnUrl={`/repairs/${id}`}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Danger zone</h2>
        <DeleteRepairButton id={id} />
      </section>
    </div>
  )
}

function nextActionFor(repair: { status: string; scheduled_date: string | null; party_id: string | null }): string | null {
  switch (repair.status) {
    case 'reported':
      return 'Evaluate the issue and decide whether to assign a vendor.'
    case 'evaluating':
      return repair.party_id ? 'Confirm the vendor and schedule the work.' : 'Assign a vendor or contractor.'
    case 'assigned':
      return 'Schedule a date for the repair.'
    case 'scheduled':
      return `Work is scheduled${repair.scheduled_date ? ` for ${repair.scheduled_date}` : ''}.`
    case 'completed':
      return 'Review the work and close the repair when satisfied.'
    case 'closed':
      return null
    default:
      return null
  }
}

function priorityClass(priority: string): string {
  if (priority === 'urgent') return 'font-semibold text-red-600'
  if (priority === 'normal') return 'text-foreground'
  return 'text-foreground/70'
}
