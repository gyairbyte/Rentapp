'use server'

import { createClient } from '@/lib/supabase/client'
import { requireUser } from './helpers'
import { toISODate, addDays, startOfMonth, endOfMonth } from './dates'
import { buildBillsFromObligations, getBillHref, toMoneyCents } from '@/lib/bills'
import { labelFor } from '@/lib/utils'
import { isRepairActive } from '@/lib/repairs'
import { OBLIGATION_CATEGORIES } from '@/lib/constants'
import type { Obligation, Property, Document, Task, Payment, Account, Party, Repair } from '@/lib/types'

function isInMonth(dueDate: string, monthStart: string, monthEnd: string) {
  return dueDate >= monthStart && dueDate <= monthEnd
}

function remainingCents(expected: number, paid: number, status: string): number {
  if (['canceled', 'waived'].includes(status)) return 0
  return Math.max(0, toMoneyCents(expected) - toMoneyCents(paid))
}

export type DashboardAttentionItem = {
  id: string
  description: string
  category: string
  due_date: string
  expected_amount: number
  paid_amount: number
  href: string
}

export async function getDashboardData() {
  const user = await requireUser()
  const supabase = await createClient()

  const now = new Date()
  const today = toISODate(now)
  const nextWeek = toISODate(addDays(now, 7))
  const nextMonth = toISODate(addDays(now, 30))
  const monthStart = toISODate(startOfMonth(now))
  const monthEnd = toISODate(endOfMonth(now))
  const inMonth = (dueDate: string) => isInMonth(dueDate, monthStart, monthEnd)

  const [obligationsResult, propertiesResult, accountsResult, partiesResult, documentsResult, tasksResult, repairsResult] = await Promise.all([
    supabase.from('obligations').select('*').eq('user_id', user.id).order('due_date', { ascending: true }).returns<Obligation[]>(),
    supabase.from('properties').select('*').eq('user_id', user.id).eq('archived', false).order('nickname', { ascending: true }).returns<Property[]>(),
    supabase.from('accounts').select('*').eq('user_id', user.id).returns<Account[]>(),
    supabase.from('parties').select('*').eq('user_id', user.id).returns<Party[]>(),
    supabase.from('documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).returns<Document[]>(),
    supabase.from('tasks').select('*').eq('user_id', user.id).order('due_date', { ascending: true, nullsFirst: false }).returns<Task[]>(),
    supabase.from('repairs').select('*').eq('user_id', user.id).order('priority', { ascending: false }).order('reported_date', { ascending: false }).returns<Repair[]>(),
  ])

  if (obligationsResult.error) throw new Error(obligationsResult.error.message)
  if (propertiesResult.error) throw new Error(propertiesResult.error.message)
  if (accountsResult.error) throw new Error(accountsResult.error.message)
  if (partiesResult.error) throw new Error(partiesResult.error.message)
  if (documentsResult.error) throw new Error(documentsResult.error.message)
  if (tasksResult.error) throw new Error(tasksResult.error.message)
  if (repairsResult.error) throw new Error(repairsResult.error.message)

  const obligations = (obligationsResult.data ?? []).filter((o) => !['canceled', 'waived'].includes(o.status))
  const propertiesRaw = propertiesResult.data ?? []
  const accounts = accountsResult.data ?? []
  const parties = partiesResult.data ?? []
  const documents = documentsResult.data ?? []
  const tasks = (tasksResult.data ?? [])
    .filter((t) => !['completed', 'canceled'].includes(t.status))
    .filter((t) => t.due_date === null || t.due_date <= nextWeek)
    .slice(0, 10)

  const obligationIds = obligations.map((o) => o.id)
  const sourceDocumentIds = obligations.map((o) => o.source_document_id).filter((sid): sid is string => sid !== null)

  const [paymentsResult, sourceDocumentsResult] = await Promise.all([
    obligationIds.length > 0
      ? supabase.from('payments').select('*').eq('user_id', user.id).in('obligation_id', obligationIds).returns<Payment[]>()
      : Promise.resolve({ data: [] as Payment[], error: null } as { data: Payment[]; error: null }),
    sourceDocumentIds.length > 0
      ? supabase.from('documents').select('*').eq('user_id', user.id).in('id', sourceDocumentIds).returns<Document[]>()
      : Promise.resolve({ data: [] as Document[], error: null } as { data: Document[]; error: null }),
  ])

  if (paymentsResult.error) throw new Error(paymentsResult.error.message)
  if (sourceDocumentsResult.error) throw new Error(sourceDocumentsResult.error.message)

  const bills = buildBillsFromObligations(
    obligations,
    {
      documents: sourceDocumentsResult.data ?? [],
      properties: propertiesRaw,
      accounts,
      parties,
      payments: paymentsResult.data ?? [],
    },
    today,
  )

  const isDueSoon = (bill: ReturnType<typeof buildBillsFromObligations>[number]) =>
    bill.remaining_cents > 0 &&
    bill.obligations.some((o) => o.due_date >= today && o.due_date <= nextWeek && o.remaining_cents > 0)

  const overdueBills = bills.filter((b) => b.overdue_cents > 0)
  const overdueRent = bills.filter((b) => b.category === 'rent' && b.overdue_cents > 0)
  const dueSoon = bills.filter(isDueSoon)

  const toAttentionItem = (bill: ReturnType<typeof buildBillsFromObligations>[number], amount: number): DashboardAttentionItem => {
    const earliest = bill.obligations.find((o) => o.remaining_cents > 0)?.due_date ?? bill.earliest_due_date ?? ''
    return {
      id: bill.id,
      description: bill.title,
      category: bill.category ? labelFor(bill.category, OBLIGATION_CATEGORIES) : 'Bill',
      due_date: earliest,
      expected_amount: amount / 100,
      paid_amount: 0,
      href: getBillHref(bill),
    }
  }

  const needsAttention = {
    overdueBills: overdueBills.map((b) => toAttentionItem(b, b.overdue_cents)),
    overdueRent: overdueRent.map((b) => toAttentionItem(b, b.overdue_cents)),
    dueSoon: dueSoon.map((b) => toAttentionItem(b, b.remaining_cents)),
  }

  const rentObligations = obligations.filter((o) => o.category === 'rent' && inMonth(o.due_date))
  const payableObligations = obligations.filter((o) => o.direction === 'payable')
  const payableInMonth = payableObligations.filter((o) => inMonth(o.due_date))

  const thisMonth = {
    rentExpectedCents: rentObligations.reduce((sum, o) => sum + toMoneyCents(o.expected_amount), 0),
    rentReceivedCents: rentObligations.reduce((sum, o) => sum + toMoneyCents(o.paid_amount), 0),
    billsDueCents: payableInMonth.reduce((sum, o) => sum + remainingCents(o.expected_amount, o.paid_amount, o.status), 0),
    billsPaidCents: payableInMonth.reduce((sum, o) => sum + toMoneyCents(o.paid_amount), 0),
  }

  const billsOutstandingCents = payableObligations.reduce(
    (sum, o) => sum + remainingCents(o.expected_amount, o.paid_amount, o.status),
    0,
  )

  const upcoming = bills
    .filter((b) => b.remaining_cents > 0 && b.earliest_due_date && b.earliest_due_date >= today && b.earliest_due_date <= nextMonth)
    .slice(0, 20)

  const repairs = repairsResult.data ?? []
  const activeRepairs = repairs.filter((r) => isRepairActive(r.status))
  const urgentRepairs = activeRepairs.filter((r) => r.priority === 'urgent')

  const properties = propertiesRaw.map((property) => {
    const propertyObligations = obligations.filter((o) => o.property_id === property.id)
    const rent = propertyObligations.filter((o) => o.category === 'rent' && inMonth(o.due_date))
    const rentExpectedCents = rent.reduce((sum, o) => sum + toMoneyCents(o.expected_amount), 0)
    const rentReceivedCents = rent.reduce((sum, o) => sum + toMoneyCents(o.paid_amount), 0)
    const totalOutstandingCents = propertyObligations.reduce(
      (sum, o) => sum + remainingCents(o.expected_amount, o.paid_amount, o.status),
      0,
    )
    const open = propertyObligations.filter((o) => remainingCents(o.expected_amount, o.paid_amount, o.status) > 0).length
    const propertyRepairs = activeRepairs.filter((r) => r.property_id === property.id)

    return {
      ...property,
      rentExpectedCents,
      rentReceivedCents,
      rentOutstandingCents: rentExpectedCents - rentReceivedCents,
      totalOutstandingCents,
      openObligations: open,
      activeRepairCount: propertyRepairs.length,
      urgentRepairCount: propertyRepairs.filter((r) => r.priority === 'urgent').length,
    }
  })

  return {
    needsAttention,
    thisMonth: {
      ...thisMonth,
      rentOutstandingCents: thisMonth.rentExpectedCents - thisMonth.rentReceivedCents,
      billsOutstandingCents,
    },
    upcoming,
    properties,
    documents,
    tasks,
    repairs,
    activeRepairs,
    urgentRepairs,
  }
}
