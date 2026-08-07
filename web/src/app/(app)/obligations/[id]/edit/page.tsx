import { notFound } from 'next/navigation'
import { ObligationForm } from '@/components/obligation/obligation-form'
import { getObligation, updateObligation } from '@/lib/actions/obligations'
import { getPropertyOptions } from '@/lib/actions/property'
import { getAccountOptions } from '@/lib/actions/account'
import { getPartyOptions } from '@/lib/actions/party'

export const dynamic = 'force-dynamic'

export default async function EditObligationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [obligation, properties, accounts, parties] = await Promise.all([
    getObligation(id),
    getPropertyOptions(),
    getAccountOptions(),
    getPartyOptions(),
  ])

  if (!obligation) notFound()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit obligation</h1>
      <ObligationForm
        obligation={obligation}
        properties={properties}
        accounts={accounts}
        parties={parties}
        action={updateObligation.bind(null, obligation.id)}
      />
    </div>
  )
}
