import { AccountForm } from '@/components/account/account-form'
import { createAccount } from '@/lib/actions/account'
import { getPropertyOptions } from '@/lib/actions/property'
import { getPartyOptions } from '@/lib/actions/party'

export const dynamic = 'force-dynamic'

export default async function NewAccountPage({ searchParams }: { searchParams: { propertyId?: string } }) {
  const [properties, parties] = await Promise.all([getPropertyOptions(), getPartyOptions()])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Add account</h1>
      <AccountForm
        properties={properties}
        parties={parties}
        action={createAccount}
        defaultPropertyId={searchParams.propertyId}
      />
    </div>
  )
}
