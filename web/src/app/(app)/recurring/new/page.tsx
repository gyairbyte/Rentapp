import { RecurringForm } from '@/components/recurring/recurring-form'
import { createRecurringRule } from '@/lib/actions/recurring'
import { getPropertyOptions } from '@/lib/actions/property'
import { getPartyOptions } from '@/lib/actions/party'
import { getAccountOptions } from '@/lib/actions/account'

export const dynamic = 'force-dynamic'

export default async function NewRecurringPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
  const { propertyId } = await searchParams
  const [properties, parties, accounts] = await Promise.all([
    getPropertyOptions(),
    getPartyOptions(),
    getAccountOptions(),
  ])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Add recurring obligation</h1>
      <RecurringForm
        properties={properties}
        parties={parties}
        accounts={accounts}
        action={createRecurringRule}
        defaultPropertyId={propertyId}
      />
    </div>
  )
}
