import { ObligationForm } from '@/components/obligation/obligation-form'
import { createObligation } from '@/lib/actions/obligations'
import { getPropertyOptions } from '@/lib/actions/property'
import { getAccountOptions } from '@/lib/actions/account'
import { getPartyOptions } from '@/lib/actions/party'

export const dynamic = 'force-dynamic'

export default async function NewObligationPage({ searchParams }: { searchParams: { propertyId?: string } }) {
  const [properties, accounts, parties] = await Promise.all([
    getPropertyOptions(),
    getAccountOptions(),
    getPartyOptions(),
  ])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Add obligation</h1>
      <ObligationForm
        properties={properties}
        accounts={accounts}
        parties={parties}
        action={createObligation}
        defaultPropertyId={searchParams.propertyId}
      />
    </div>
  )
}
