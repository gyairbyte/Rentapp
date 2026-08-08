import { notFound } from 'next/navigation'
import { PaymentForm } from '@/components/payment/payment-form'
import { createPayment } from '@/lib/actions/payments'
import { getObligation, getObligations } from '@/lib/actions/obligations'

export const dynamic = 'force-dynamic'

function isSafeReturnPath(returnTo: unknown): returnTo is string {
  return typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//')
}

export default async function PayObligationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { id } = await params
  const { returnTo } = await searchParams

  const [obligation, obligations] = await Promise.all([
    getObligation(id),
    getObligations({ includeResolved: false }),
  ])

  if (!obligation) notFound()

  const paymentObligations = obligations.map((o) => ({
    id: o.id,
    description: o.description,
    expected_amount: o.expected_amount,
    paid_amount: o.paid_amount,
    due_date: o.due_date,
  }))

  const returnUrl = isSafeReturnPath(returnTo) ? returnTo : undefined

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Record payment</h1>
      <PaymentForm
        action={createPayment}
        obligations={paymentObligations}
        defaultObligationId={obligation.id}
        returnUrl={returnUrl}
      />
    </div>
  )
}
