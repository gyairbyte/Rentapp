import Link from 'next/link'
import { getAccounts } from '@/lib/actions/account'
import { getPropertyOptions } from '@/lib/actions/property'

export const dynamic = 'force-dynamic'

export default async function AccountsPage() {
  const [accounts, properties] = await Promise.all([getAccounts(), getPropertyOptions()])
  const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p.nickname]))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <Link href="/accounts/new" className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90">
          Add account
        </Link>
      </div>
      {accounts.length === 0 ? (
        <p className="text-foreground/70">No accounts yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <li key={account.id} className="rounded-lg border p-4">
              <Link href={`/accounts/${account.id}`} className="font-semibold hover:underline capitalize">
                {account.account_type.replace(/_/g, ' ')}
              </Link>
              {account.account_number && (
                <p className="text-sm text-foreground/70">{account.account_number}</p>
              )}
              <p className="text-sm text-foreground/70">{propertyMap[account.property_id]}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
