import { notFound } from 'next/navigation'
import { RecurringForm } from '@/components/recurring/recurring-form'
import { getRecurringRule, updateRecurringRule } from '@/lib/actions/recurring'
import { getPropertyOptions } from '@/lib/actions/property'
import { getPartyOptions } from '@/lib/actions/party'
import { getAccountOptions } from '@/lib/actions/account'

export const dynamic = 'force-dynamic'

export default async function EditRecurringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [rule, properties, parties, accounts] = await Promise.all([
    getRecurringRule(id),
    getPropertyOptions(),
    getPartyOptions(),
    getAccountOptions(),
  ])

  if (!rule) notFound()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit recurring obligation</h1>
      <RecurringForm
        properties={properties}
        parties={parties}
        accounts={accounts}
        action={updateRecurringRule.bind(null, rule.id)}
        rule={rule}
      />
    </div>
  )
}
