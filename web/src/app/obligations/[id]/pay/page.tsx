import { notFound } from 'next/navigation'
import { PaymentForm } from '@/components/payment/payment-form'
import { createPayment } from '@/lib/actions/payments'
import { getObligation } from '@/lib/actions/obligations'
import { getObligations } from '@/lib/actions/obligations'

export const dynamic = 'force-dynamic'

export default async function PayObligationPage({ params }: { params: { id: string } }) {
  const [obligation, obligations] = await Promise.all([
    getObligation(params.id),
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Record payment</h1>
      <PaymentForm
        action={createPayment}
        obligations={paymentObligations}
        defaultObligationId={obligation.id}
      />
    </div>
  )
}
