'use server'

import { createClient } from '@/lib/supabase/client'
import { requireUser } from './helpers'
import { getSignedDocumentUrl } from './documents'
import {
  buildBillsFromObligations,
  filterBills,
  type Bill,
  type BillSummary,
} from '@/lib/bills'
import { toISODate } from './dates'
import type { Document, Obligation, Payment, Property, Account, Party } from '@/lib/types'

export type BillFilter = 'all' | 'overdue' | 'due-this-month' | 'outstanding'

const VALID_FILTERS: BillFilter[] = ['all', 'overdue', 'due-this-month', 'outstanding']

function normalizeFilter(filter: string | undefined | null): BillFilter {
  if (!filter) return 'all'
  return VALID_FILTERS.includes(filter as BillFilter) ? (filter as BillFilter) : 'all'
}

export type BillsResult = {
  bills: BillSummary[]
  filter: BillFilter
  allBills: BillSummary[]
}

export async function getBills(
  options: { filter?: string; today?: Date } = {},
): Promise<BillsResult> {
  const user = await requireUser()
  const supabase = await createClient()
  const today = toISODate(options.today ?? new Date())
  const filter = normalizeFilter(options.filter)

  const data = await fetchBillsData(supabase, user.id)
  const bills = buildBillsFromObligations(
    data.obligations,
    {
      documents: data.documents,
      properties: data.properties,
      accounts: data.accounts,
      parties: data.parties,
      payments: data.payments,
    },
    today,
  )

  const filtered = filterBills(bills, filter)

  return {
    bills: filtered.map(toBillSummary),
    filter,
    allBills: bills.map(toBillSummary),
  }
}

export type BillDetailResult = { bill: Bill; signedUrl: string | null }

export async function getBill(id: string, options: { today?: Date } = {}): Promise<BillDetailResult | null> {
  const user = await requireUser()
  const supabase = await createClient()
  const today = toISODate(options.today ?? new Date())

  const { data: obligations, error } = await supabase
    .from('obligations')
    .select('*')
    .eq('user_id', user.id)
    .or(`id.eq.${id},source_document_id.eq.${id}`)
    .order('due_date', { ascending: true })
    .returns<Obligation[]>()

  if (error || !obligations || obligations.length === 0) return null

  const sourceDocumentIds = obligations
    .map((o) => o.source_document_id)
    .filter((sid): sid is string => sid !== null)

  const [documentsResult, propertiesResult, accountsResult, partiesResult, paymentsResult] = await Promise.all([
    supabase.from('documents').select('*').eq('user_id', user.id).in('id', [id, ...sourceDocumentIds]).returns<Document[]>(),
    supabase.from('properties').select('*').eq('user_id', user.id).returns<Property[]>(),
    supabase.from('accounts').select('*').eq('user_id', user.id).returns<Account[]>(),
    supabase.from('parties').select('*').eq('user_id', user.id).returns<Party[]>(),
    supabase.from('payments').select('*').eq('user_id', user.id).in(
      'obligation_id',
      obligations.map((o) => o.id),
    ).returns<Payment[]>(),
  ])

  if (documentsResult.error) throw new Error(documentsResult.error.message)
  if (propertiesResult.error) throw new Error(propertiesResult.error.message)
  if (accountsResult.error) throw new Error(accountsResult.error.message)
  if (partiesResult.error) throw new Error(partiesResult.error.message)
  if (paymentsResult.error) throw new Error(paymentsResult.error.message)

  const documents = documentsResult.data ?? []
  const document = documents.find((d) => d.id === id) ?? (sourceDocumentIds.length > 0 ? documents.find((d) => d.id === sourceDocumentIds[0]) : null)

  const bills = buildBillsFromObligations(
    obligations,
    {
      documents,
      properties: propertiesResult.data ?? [],
      accounts: accountsResult.data ?? [],
      parties: partiesResult.data ?? [],
      payments: paymentsResult.data ?? [],
    },
    today,
  )

  const bill = bills.find((b) => b.id === id || b.source_document_id === id)
  if (!bill) return null

  const signedUrl = document?.storage_path ? await getSignedDocumentUrl(document.storage_path) : null

  return { bill: { ...bill, document: document ?? bill.document }, signedUrl }
}

type BillsData = {
  obligations: Obligation[]
  documents: Document[]
  properties: Property[]
  accounts: Account[]
  parties: Party[]
  payments: Payment[]
}

async function fetchBillsData(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<BillsData> {
  const [obligationsResult, propertiesResult, accountsResult, partiesResult] = await Promise.all([
    supabase.from('obligations').select('*').eq('user_id', userId).order('due_date', { ascending: true }).returns<Obligation[]>(),
    supabase.from('properties').select('*').eq('user_id', userId).order('nickname', { ascending: true }).returns<Property[]>(),
    supabase.from('accounts').select('*').eq('user_id', userId).returns<Account[]>(),
    supabase.from('parties').select('*').eq('user_id', userId).returns<Party[]>(),
  ])

  if (obligationsResult.error) throw new Error(obligationsResult.error.message)
  if (propertiesResult.error) throw new Error(propertiesResult.error.message)
  if (accountsResult.error) throw new Error(accountsResult.error.message)
  if (partiesResult.error) throw new Error(partiesResult.error.message)

  const obligations = obligationsResult.data ?? []
  const sourceDocumentIds = obligations.map((o) => o.source_document_id).filter((sid): sid is string => sid !== null)
  const obligationIds = obligations.map((o) => o.id)

  const [documentsResult, paymentsResult] = await Promise.all([
    sourceDocumentIds.length > 0
      ? supabase.from('documents').select('*').eq('user_id', userId).in('id', sourceDocumentIds).returns<Document[]>()
      : Promise.resolve({ data: [] as Document[], error: null } as { data: Document[]; error: null }),
    obligationIds.length > 0
      ? supabase.from('payments').select('*').eq('user_id', userId).in('obligation_id', obligationIds).returns<Payment[]>()
      : Promise.resolve({ data: [] as Payment[], error: null } as { data: Payment[]; error: null }),
  ])

  if (documentsResult.error) throw new Error(documentsResult.error.message)
  if (paymentsResult.error) throw new Error(paymentsResult.error.message)

  return {
    obligations,
    documents: documentsResult.data ?? [],
    properties: propertiesResult.data ?? [],
    accounts: accountsResult.data ?? [],
    parties: partiesResult.data ?? [],
    payments: paymentsResult.data ?? [],
  }
}

function toBillSummary(bill: Bill): BillSummary {
  const {
    id,
    source_document_id,
    title,
    provider,
    property,
    account,
    party,
    category,
    total_cents,
    remaining_cents,
    paid_cents,
    overdue_cents,
    due_this_month_cents,
    earliest_due_date,
    status,
    paid_count,
    total_count,
    attention_summary,
    is_document_backed,
    account_label,
  } = bill

  return {
    id,
    source_document_id,
    title,
    provider,
    property,
    account,
    party,
    category,
    total_cents,
    remaining_cents,
    paid_cents,
    overdue_cents,
    due_this_month_cents,
    earliest_due_date,
    status,
    paid_count,
    total_count,
    attention_summary,
    is_document_backed,
    account_label,
  }
}

export type { Bill, BillSummary }
