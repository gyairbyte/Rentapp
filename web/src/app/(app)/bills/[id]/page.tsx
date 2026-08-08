import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getBill } from '@/lib/actions/bills'
import { labelFor } from '@/lib/utils'
import { OBLIGATION_STATUSES, OBLIGATION_CATEGORIES, REVIEW_STATUSES, PROCESSING_STATUSES } from '@/lib/constants'
import { formatMoney, formatDueDate, toMoneyCents } from '@/lib/bills'
import { formatDateOnly } from '@/lib/actions/dates'

export const dynamic = 'force-dynamic'

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getBill(id)
  if (!result) notFound()

  const { bill, signedUrl } = result

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-foreground/70">
        <Link href="/bills" className="hover:underline">
          Bills
        </Link>
        <span>/</span>
        <span className="truncate">{bill.title}</span>
      </div>

      <section className="rounded-lg border p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{bill.title}</h1>
            {bill.provider && bill.provider !== bill.title && (
              <p className="text-foreground/70">{bill.provider}</p>
            )}
          </div>
          <StatusBadge status={bill.status} />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          {bill.property && (
            <div>
              <p className="text-foreground/70">Property</p>
              <Link href={`/properties/${bill.property.id}`} className="font-medium hover:underline">
                {bill.property.nickname}
              </Link>
            </div>
          )}
          {bill.category && (
            <div>
              <p className="text-foreground/70">Category</p>
              <p className="font-medium capitalize">{labelFor(bill.category, OBLIGATION_CATEGORIES)}</p>
            </div>
          )}
          <div>
            <p className="text-foreground/70">Total</p>
            <p className="font-medium">{formatMoney(bill.total_cents)}</p>
          </div>
          <div>
            <p className="text-foreground/70">Remaining</p>
            <p className="font-medium">{formatMoney(bill.remaining_cents)}</p>
          </div>
          {bill.earliest_due_date && (
            <div>
              <p className="text-foreground/70">Next due</p>
              <p className="font-medium">{formatDueDate(bill.earliest_due_date)}</p>
            </div>
          )}
          {bill.account_label && (
            <div>
              <p className="text-foreground/70">Account</p>
              <p className="font-medium">{bill.account_label}</p>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Installment schedule</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-foreground/5 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium">#</th>
                <th className="text-left px-4 py-2 font-medium">Description</th>
                <th className="text-right px-4 py-2 font-medium">Amount</th>
                <th className="text-right px-4 py-2 font-medium">Remaining</th>
                <th className="text-left px-4 py-2 font-medium">Due date</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Paid</th>
                <th className="text-left px-4 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {bill.obligations.map((obligation, index) => (
                <tr
                  key={obligation.id}
                  className={`border-b last:border-b-0 ${obligation.derived_status === 'overdue' ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}
                >
                  <td className="px-4 py-3">{index + 1}</td>
                  <td className="px-4 py-3">
                    {obligation.description || labelFor(obligation.category, OBLIGATION_CATEGORIES)}
                  </td>
                  <td className="px-4 py-3 text-right">{formatMoney(toMoneyCents(obligation.expected_amount))}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(obligation.remaining_cents)}</td>
                  <td className="px-4 py-3">{formatDueDate(obligation.due_date)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={obligation.derived_status} />
                  </td>
                  <td className="px-4 py-3">
                    {obligation.paid_amount > 0 && (
                      <span>
                        {formatMoney(toMoneyCents(obligation.paid_amount))}
                        {obligation.paid_date && ` on ${formatDateOnly(obligation.paid_date)}`}
                      </span>
                    )}
                    {!obligation.paid_amount && <span className="text-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {obligation.remaining_cents > 0 && !['canceled', 'waived'].includes(obligation.derived_status) && (
                      <Link
                        href={`/obligations/${obligation.id}/pay?returnTo=${encodeURIComponent(`/bills/${id}`)}`}
                        className="rounded-md bg-foreground text-background px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-90"
                      >
                        Record payment
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-foreground/5 border-t font-medium">
              <tr>
                <td className="px-4 py-3" colSpan={2}>Total</td>
                <td className="px-4 py-3 text-right">{formatMoney(bill.total_cents)}</td>
                <td className="px-4 py-3 text-right">{formatMoney(bill.remaining_cents)}</td>
                <td className="px-4 py-3" colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {bill.obligations.some((o) => o.payments.length > 0) && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Payment history</h2>
          <ul className="space-y-2">
            {bill.obligations.flatMap((o, index) =>
              o.payments.map((payment) => (
                <li key={payment.id} className="rounded-md border p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                  <div>
                    <span className="font-medium">Installment {index + 1}</span>
                    {o.description && <span className="text-foreground/70"> · {o.description}</span>}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-right">
                    <span className="font-medium">{formatMoney(toMoneyCents(payment.amount))}</span>
                    <span className="text-foreground/70">{formatDateOnly(payment.payment_date)}</span>
                    {payment.method && <span className="text-foreground/60 capitalize">{payment.method}</span>}
                  </div>
                </li>
              )),
            )}
          </ul>
        </section>
      )}

      {bill.is_document_backed ? (
        <section>
          <h2 className="text-lg font-semibold mb-3">Source document</h2>
          {bill.document ? (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium">{bill.document.original_filename}</p>
                  <p className="text-foreground/70">
                    Uploaded {formatDateOnly(bill.document.created_at.slice(0, 10))} ·{' '}
                    {labelFor(bill.document.review_status, REVIEW_STATUSES)} ·{' '}
                    {labelFor(bill.document.processing_status, PROCESSING_STATUSES)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {signedUrl && (
                    <a
                      href={signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
                    >
                      Open original
                    </a>
                  )}
                  <Link
                    href={`/documents/${bill.document.id}`}
                    className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10"
                  >
                    Document detail
                  </Link>
                </div>
              </div>

              {signedUrl ? (
                <div className="rounded-lg border overflow-hidden">
                  {bill.document.mime_type?.startsWith('image/') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={signedUrl} alt={bill.document.original_filename} className="max-w-full max-h-[60vh] object-contain mx-auto" />
                  ) : bill.document.mime_type === 'application/pdf' ? (
                    <object data={signedUrl} type="application/pdf" className="w-full h-96">
                      <div className="p-4 text-center">
                        <p className="text-foreground/70 mb-2">PDF preview is not available in this browser.</p>
                        <a
                          href={signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm underline"
                        >
                          Open PDF
                        </a>
                      </div>
                    </object>
                  ) : (
                    <div className="p-4 text-center text-foreground/70">
                      Preview not available for this file type.
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-foreground/70">Unable to generate a preview link. The file may be missing or storage is unavailable.</p>
              )}
            </div>
          ) : (
            <p className="text-foreground/70">Source document information is missing.</p>
          )}
        </section>
      ) : (
        <section>
          <h2 className="text-lg font-semibold mb-3">Source</h2>
          <p className="text-foreground/70">Manually entered obligation</p>
        </section>
      )}

      <div className="flex gap-3">
        <Link href="/bills" className="text-sm underline py-2">
          Back to bills
        </Link>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-block rounded-full px-2 py-0.5 text-xs border capitalize">
      {labelFor(status, OBLIGATION_STATUSES)}
    </span>
  )
}
