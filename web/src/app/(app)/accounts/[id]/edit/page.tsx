import { notFound } from 'next/navigation'
import { AccountForm } from '@/components/account/account-form'
import { getAccount, updateAccount } from '@/lib/actions/account'
import { getPropertyOptions } from '@/lib/actions/property'
import { getPartyOptions } from '@/lib/actions/party'

export const dynamic = 'force-dynamic'

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [account, properties, parties] = await Promise.all([
    getAccount(id),
    getPropertyOptions(),
    getPartyOptions(),
  ])

  if (!account) notFound()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit account</h1>
      <AccountForm account={account} properties={properties} parties={parties} action={updateAccount.bind(null, account.id)} />
    </div>
  )
}
