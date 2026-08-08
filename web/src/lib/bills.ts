import { labelFor } from './utils'
import { toISODate, startOfMonth, endOfMonth, addDays, formatDateOnly } from './actions/dates'
import { toCents, formatCents } from './payment-validation'
import { OBLIGATION_CATEGORIES, ACCOUNT_TYPES } from './constants'
import type { Obligation, Payment, Document, Property, Account, Party } from './types'

export type BillObligation = Obligation & {
  remaining_cents: number
  derived_status: string
  payments: Payment[]
}

export type Bill = {
  id: string
  source_document_id: string | null
  title: string
  provider: string | null
  property: Property | null
  account: Account | null
  party: Party | null
  category: string | null
  document: Document | null
  obligations: BillObligation[]
  total_cents: number
  remaining_cents: number
  paid_cents: number
  overdue_cents: number
  due_this_month_cents: number
  earliest_due_date: string | null
  status: string
  paid_count: number
  total_count: number
  attention_summary: string
  is_document_backed: boolean
  account_label: string | null
}

export type BillSummary = Pick<
  Bill,
  | 'id'
  | 'source_document_id'
  | 'title'
  | 'provider'
  | 'property'
  | 'account'
  | 'party'
  | 'category'
  | 'total_cents'
  | 'remaining_cents'
  | 'paid_cents'
  | 'overdue_cents'
  | 'due_this_month_cents'
  | 'earliest_due_date'
  | 'status'
  | 'paid_count'
  | 'total_count'
  | 'attention_summary'
  | 'is_document_backed'
  | 'account_label'
>

export function toMoneyCents(amount: number | string | null | undefined): number {
  return toCents(amount ?? 0) ?? 0
}

export function formatMoney(cents: number): string {
  return formatCents(cents) ?? '$0.00'
}

export function calculateRemainingCents(expected: number, paid: number): number {
  return Math.max(0, toMoneyCents(expected) - toMoneyCents(paid))
}

export function dueDateString(value: string | Date | null | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.toISOString().slice(0, 10)
}

export function deriveObligationStatus(
  obligation: Obligation,
  today: string,
): string {
  const expectedCents = toMoneyCents(obligation.expected_amount)
  const paidCents = toMoneyCents(obligation.paid_amount)

  if (['canceled', 'waived'].includes(obligation.status)) {
    return obligation.status
  }

  if (obligation.status === 'disputed') {
    return 'disputed'
  }

  if (paidCents >= expectedCents) return 'paid'
  if (paidCents > 0) return 'partially_paid'

  const dueDate = dueDateString(obligation.due_date)
  if (dueDate < today) return 'overdue'

  const todayDate = new Date(`${today}T00:00:00Z`)
  const dueWindow = toISODate(addDays(todayDate, 7))
  if (dueDate <= dueWindow) return 'due'

  return 'upcoming'
}

function isResolvedStatus(status: string): boolean {
  return ['paid', 'canceled', 'waived'].includes(status)
}

export function buildBillsFromObligations(
  obligations: Obligation[],
  deps: {
    documents: Document[]
    properties: Property[]
    accounts: Account[]
    parties: Party[]
    payments: Payment[]
  },
  today: string,
): Bill[] {
  const docMap = new Map(deps.documents.map((d) => [d.id, d]))
  const propMap = new Map(deps.properties.map((p) => [p.id, p]))
  const accountMap = new Map(deps.accounts.map((a) => [a.id, a]))
  const partyMap = new Map(deps.parties.map((p) => [p.id, p]))
  const paymentsByObligation = new Map<string, Payment[]>()
  for (const payment of deps.payments) {
    const arr = paymentsByObligation.get(payment.obligation_id) ?? []
    arr.push(payment)
    paymentsByObligation.set(payment.obligation_id, arr)
  }

  const groups = new Map<string, { obligations: Obligation[]; sourceDocumentId: string | null }>()

  for (const obligation of obligations) {
    const sourceId = obligation.source_document_id
    const key = sourceId ?? obligation.id
    const existing = groups.get(key)
    if (existing) {
      existing.obligations.push(obligation)
    } else {
      groups.set(key, { obligations: [obligation], sourceDocumentId: sourceId })
    }
  }

  const bills: Bill[] = []

  for (const [, group] of groups) {
    const sourceDocumentId = group.sourceDocumentId
    const document = sourceDocumentId ? docMap.get(sourceDocumentId) ?? null : null
    const sortedObligations = [...group.obligations].sort((a, b) => {
      const dateCompare = dueDateString(a.due_date).localeCompare(dueDateString(b.due_date))
      if (dateCompare !== 0) return dateCompare
      const aKey = a.source_item_key ?? ''
      const bKey = b.source_item_key ?? ''
      return aKey.localeCompare(bKey)
    })

    const firstObligation = sortedObligations[0]
    if (!firstObligation) continue

    const property = propMap.get(firstObligation.property_id) ?? null
    const account = firstObligation.account_id ? accountMap.get(firstObligation.account_id) ?? null : null
    const party = firstObligation.party_id ? partyMap.get(firstObligation.party_id) ?? null : null

    const billObligations: BillObligation[] = sortedObligations.map((obligation) => ({
      ...obligation,
      payments: paymentsByObligation.get(obligation.id) ?? [],
      remaining_cents: 0,
      derived_status: '',
    }))

    let totalCents = 0
    let paidCents = 0
    let remainingCents = 0
    let overdueCents = 0
    let dueThisMonthCents = 0
    let totalCount = 0
    let paidCount = 0
    const monthStart = toISODate(startOfMonth(new Date(`${today}T00:00:00Z`)))
    const monthEnd = toISODate(endOfMonth(new Date(`${today}T00:00:00Z`)))

    for (const billOb of billObligations) {
      const expectedCents = toMoneyCents(billOb.expected_amount)
      const paid = toMoneyCents(billOb.paid_amount)
      const remaining = ['canceled', 'waived'].includes(billOb.status)
        ? 0
        : Math.max(0, expectedCents - paid)
      const status = deriveObligationStatus(billOb, today)
      const obDueDate = dueDateString(billOb.due_date)

      billOb.remaining_cents = remaining
      billOb.derived_status = status

      totalCents += expectedCents
      paidCents += paid
      remainingCents += remaining
      totalCount += 1

      if (remaining > 0) {
        if (obDueDate < today) {
          overdueCents += remaining
        }
        if (obDueDate >= monthStart && obDueDate <= monthEnd) {
          dueThisMonthCents += remaining
        }
      }

      if (remaining === 0 && !['canceled', 'waived'].includes(status)) {
        paidCount += 1
      }
    }

    const unresolvedObligations = billObligations.filter((o) => !isResolvedStatus(o.derived_status) && o.remaining_cents > 0)
    const earliestDue = unresolvedObligations.length > 0
      ? dueDateString(unresolvedObligations[0].due_date)
      : dueDateString(billObligations[0]?.due_date)

    const status = deriveBillStatus(billObligations)
    const attentionSummary = buildAttentionSummary(billObligations)

    const title = buildBillTitle(document, firstObligation, account, party)
    const provider = document?.issuer ?? null
    const accountLabel = account?.account_number ?? null

    bills.push({
      id: sourceDocumentId ?? firstObligation.id,
      source_document_id: sourceDocumentId,
      title,
      provider,
      property,
      account,
      party,
      category: firstObligation.category,
      document,
      obligations: billObligations,
      total_cents: totalCents,
      remaining_cents: remainingCents,
      paid_cents: paidCents,
      overdue_cents: overdueCents,
      due_this_month_cents: dueThisMonthCents,
      earliest_due_date: earliestDue,
      status,
      paid_count: paidCount,
      total_count: totalCount,
      attention_summary: attentionSummary,
      is_document_backed: sourceDocumentId !== null,
      account_label: accountLabel,
    })
  }

  return bills.sort((a, b) => {
    const aDate = a.earliest_due_date || '9999-12-31'
    const bDate = b.earliest_due_date || '9999-12-31'
    return aDate.localeCompare(bDate)
  })
}

function deriveBillStatus(obligations: BillObligation[]): string {
  const allRemainingZero = obligations.every((o) => o.remaining_cents === 0)
  if (allRemainingZero) {
    const allPaid = obligations.every((o) => o.derived_status === 'paid')
    if (allPaid) return 'paid'
    const allCanceled = obligations.every((o) => o.derived_status === 'canceled')
    if (allCanceled) return 'canceled'
    const allWaived = obligations.every((o) => o.derived_status === 'waived')
    if (allWaived) return 'waived'
    return 'paid'
  }

  const unresolved = obligations.filter((o) => o.remaining_cents > 0)

  if (unresolved.some((o) => o.derived_status === 'overdue')) return 'overdue'
  if (unresolved.some((o) => o.derived_status === 'due')) return 'due'
  if (unresolved.some((o) => o.derived_status === 'disputed')) return 'disputed'
  return 'upcoming'
}

function buildAttentionSummary(obligations: BillObligation[]): string {
  const counts: Record<string, number> = {}
  for (const obligation of obligations) {
    if (obligation.remaining_cents === 0) continue
    const status = obligation.derived_status
    if (status === 'upcoming' || status === 'due' || status === 'overdue') {
      counts[status] = (counts[status] ?? 0) + 1
    }
  }

  const parts: string[] = []
  if (counts.overdue) parts.push(`${counts.overdue} overdue`)
  if (counts.due) parts.push(`${counts.due} due`)
  if (counts.upcoming) parts.push(`${counts.upcoming} upcoming`)

  return parts.join(' · ') || 'No upcoming obligations'
}

function buildBillTitle(
  document: Document | null,
  firstObligation: Obligation,
  account: Account | null,
  party: Party | null,
): string {
  if (document?.issuer) {
    const categoryLabel = firstObligation.category
      ? labelFor(firstObligation.category, OBLIGATION_CATEGORIES)
      : null
    return categoryLabel ? `${document.issuer} — ${categoryLabel}` : document.issuer
  }

  if (document?.original_filename) {
    return document.original_filename.replace(/\.[^/.]+$/, '')
  }

  if (account?.account_number && account.account_type) {
    return `${labelFor(account.account_type, ACCOUNT_TYPES)} ${account.account_number}`
  }

  if (party?.name) {
    return `${party.name} — ${labelFor(firstObligation.category, OBLIGATION_CATEGORIES)}`
  }

  return firstObligation.description || labelFor(firstObligation.category, OBLIGATION_CATEGORIES)
}

export function filterBills(bills: Bill[], filter: string | undefined | null): Bill[] {
  if (!filter || filter === 'all') return bills

  if (filter === 'overdue') {
    return bills.filter((b) => b.overdue_cents > 0)
  }

  if (filter === 'due-this-month') {
    return bills.filter((b) => b.due_this_month_cents > 0)
  }

  if (filter === 'outstanding') {
    return bills.filter((b) => b.remaining_cents > 0)
  }

  return bills
}

export function getBillHref(bill: { source_document_id: string | null; id: string }): string {
  return `/bills/${bill.source_document_id ?? bill.id}`
}

export type PropertySummary = {
  rentExpectedCents: number
  rentReceivedCents: number
  rentOutstandingCents: number
  billsDueCents: number
  billsPaidCents: number
  totalOutstandingCents: number
  openObligations: number
  upcoming: { obligation: BillObligation; href: string }[]
}

export function buildPropertySummary(
  property: Property,
  obligations: Obligation[],
  deps: {
    documents: Document[]
    accounts: Account[]
    parties: Party[]
    payments: Payment[]
  },
  today: string,
): PropertySummary {
  const bills = buildBillsFromObligations(
    obligations,
    {
      documents: deps.documents,
      properties: [property],
      accounts: deps.accounts,
      parties: deps.parties,
      payments: deps.payments,
    },
    today,
  )

  const monthStart = toISODate(startOfMonth(new Date(`${today}T00:00:00Z`)))
  const monthEnd = toISODate(endOfMonth(new Date(`${today}T00:00:00Z`)))
  const inMonth = (dueDate: string) => dueDate >= monthStart && dueDate <= monthEnd

  const isResolved = (o: BillObligation) => ['canceled', 'waived'].includes(o.status)

  const rentExpectedCents = bills.reduce(
    (sum, bill) =>
      sum +
      bill.obligations
        .filter((o) => o.category === 'rent' && !isResolved(o) && inMonth(dueDateString(o.due_date)))
        .reduce((s, o) => s + toMoneyCents(o.expected_amount), 0),
    0,
  )

  const rentReceivedCents = bills.reduce(
    (sum, bill) =>
      sum +
      bill.obligations
        .filter((o) => o.category === 'rent' && !isResolved(o) && inMonth(dueDateString(o.due_date)))
        .reduce((s, o) => s + toMoneyCents(o.paid_amount), 0),
    0,
  )

  const billsDueCents = bills.reduce(
    (sum, bill) =>
      sum +
      bill.obligations
        .filter((o) => o.direction === 'payable' && inMonth(dueDateString(o.due_date)))
        .reduce((s, o) => s + o.remaining_cents, 0),
    0,
  )

  const billsPaidCents = bills.reduce(
    (sum, bill) =>
      sum +
      bill.obligations
        .filter((o) => o.direction === 'payable' && !isResolved(o) && inMonth(dueDateString(o.due_date)))
        .reduce((s, o) => s + toMoneyCents(o.paid_amount), 0),
    0,
  )

  const totalOutstandingCents = bills.reduce((sum, bill) => sum + bill.remaining_cents, 0)

  const openObligations = bills.reduce(
    (sum, bill) => sum + bill.obligations.filter((o) => o.remaining_cents > 0).length,
    0,
  )

  const upcoming = bills
    .flatMap((bill) =>
      bill.obligations.map((o) => ({
        obligation: o,
        href: getBillHref(bill),
      })),
    )
    .filter((x) => x.obligation.remaining_cents > 0 && dueDateString(x.obligation.due_date) >= today)
    .sort((a, b) => dueDateString(a.obligation.due_date).localeCompare(dueDateString(b.obligation.due_date)))
    .slice(0, 10)

  return {
    rentExpectedCents,
    rentReceivedCents,
    rentOutstandingCents: rentExpectedCents - rentReceivedCents,
    billsDueCents,
    billsPaidCents,
    totalOutstandingCents,
    openObligations,
    upcoming,
  }
}

export function formatDueDate(date: string | null | undefined): string {
  if (!date) return ''
  return formatDateOnly(date)
}
