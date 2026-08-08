import { describe, it, expect } from 'vitest'
import { buildBillsFromObligations, buildPropertySummary, filterBills, getBillHref, toMoneyCents, deriveObligationStatus } from './bills'
import type { Obligation, Document, Property, Account, Party, Payment } from './types'

const today = '2026-08-07'

const property: Property = {
  id: 'property-1',
  user_id: 'user-1',
  nickname: 'Fountain Hill',
  street_address: '610 S Bergen St',
  city: 'Bethlehem',
  state: 'PA',
  zip: '18015',
  property_type: 'single_family',
  active: true,
  archived: false,
  created_at: '',
  updated_at: '',
}

const document: Document = {
  id: 'doc-1',
  user_id: 'user-1',
  property_id: property.id,
  account_id: null,
  party_id: null,
  storage_path: 'user-1/school-tax.pdf',
  original_filename: 'bethlehem-school-tax-2026.pdf',
  file_hash: null,
  file_size: null,
  mime_type: 'application/pdf',
  document_type: 'school_tax',
  issuer: 'Bethlehem Area School District',
  document_date: '2026-06-15',
  processing_status: 'processed',
  review_status: 'confirmed',
  processing_error: null,
  confirmed_obligation_id: null,
  confirmed_task_id: null,
  duplicate_of_document_id: null,
  raw_extracted_text: null,
  raw_ai_extraction: null,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
}

function makeObligation(overrides: Partial<Obligation>): Obligation {
  return {
    id: `obligation-${Math.random().toString(36).slice(2)}`,
    user_id: 'user-1',
    property_id: property.id,
    account_id: null,
    party_id: null,
    recurring_rule_id: null,
    source_document_id: null,
    source_item_key: null,
    direction: 'payable',
    category: 'school_tax',
    description: null,
    expected_amount: 100,
    paid_amount: 0,
    due_date: '2026-08-31',
    status: 'upcoming',
    paid_date: null,
    ...overrides,
  } as Obligation
}

const baseDeps = {
  documents: [document],
  properties: [property],
  accounts: [] as Account[],
  parties: [] as Party[],
  payments: [] as Payment[],
}

describe('toMoneyCents', () => {
  it('converts dollar amounts to integer cents exactly', () => {
    expect(toMoneyCents(439.13)).toBe(43913)
    expect(toMoneyCents(1756.51)).toBe(175651)
    expect(toMoneyCents('1756.51')).toBe(175651)
  })
})

describe('deriveObligationStatus', () => {
  it('marks paid when paid amount equals expected amount', () => {
    const obligation = makeObligation({ expected_amount: 439.13, paid_amount: 439.13, due_date: '2026-08-03' })
    expect(deriveObligationStatus(obligation, today)).toBe('paid')
  })

  it('marks overdue before today', () => {
    const obligation = makeObligation({ expected_amount: 439.13, paid_amount: 0, due_date: '2026-08-03' })
    expect(deriveObligationStatus(obligation, today)).toBe('overdue')
  })

  it('marks upcoming for future due dates', () => {
    const obligation = makeObligation({ expected_amount: 439.13, paid_amount: 0, due_date: '2026-09-14' })
    expect(deriveObligationStatus(obligation, today)).toBe('upcoming')
  })
})

describe('buildBillsFromObligations', () => {
  it('groups four obligations with the same source document into one bill', () => {
    const obligations = [
      makeObligation({ id: 'o1', source_document_id: 'doc-1', source_item_key: 'option_2:installment_1', expected_amount: 439.13, due_date: '2026-08-03' }),
      makeObligation({ id: 'o2', source_document_id: 'doc-1', source_item_key: 'option_2:installment_2', expected_amount: 439.13, due_date: '2026-09-14' }),
      makeObligation({ id: 'o3', source_document_id: 'doc-1', source_item_key: 'option_2:installment_3', expected_amount: 439.13, due_date: '2026-10-31' }),
      makeObligation({ id: 'o4', source_document_id: 'doc-1', source_item_key: 'option_2:installment_4', expected_amount: 439.12, due_date: '2026-12-07' }),
    ]

    const bills = buildBillsFromObligations(obligations, baseDeps, today)

    expect(bills).toHaveLength(1)
    const bill = bills[0]
    expect(bill.id).toBe('doc-1')
    expect(bill.source_document_id).toBe('doc-1')
    expect(bill.is_document_backed).toBe(true)
    expect(bill.total_cents).toBe(175651)
    expect(bill.remaining_cents).toBe(175651)
    expect(bill.paid_cents).toBe(0)
    expect(bill.overdue_cents).toBe(43913)
    expect(bill.due_this_month_cents).toBe(43913)
    expect(bill.total_count).toBe(4)
    expect(bill.paid_count).toBe(0)
    expect(bill.obligations).toHaveLength(4)
    expect(bill.obligations[0].derived_status).toBe('overdue')
    expect(bill.obligations[1].derived_status).toBe('upcoming')
    expect(bill.obligations[2].derived_status).toBe('upcoming')
    expect(bill.obligations[3].derived_status).toBe('upcoming')
    expect(bill.earliest_due_date).toBe('2026-08-03')
    expect(bill.status).toBe('overdue')
  })

  it('sums remaining balance correctly when the first installment is partially paid', () => {
    const obligations = [
      makeObligation({ id: 'o1', source_document_id: 'doc-1', source_item_key: 'option_2:installment_1', expected_amount: 439.13, paid_amount: 200, due_date: '2026-08-03' }),
      makeObligation({ id: 'o2', source_document_id: 'doc-1', source_item_key: 'option_2:installment_2', expected_amount: 439.13, due_date: '2026-09-14' }),
      makeObligation({ id: 'o3', source_document_id: 'doc-1', source_item_key: 'option_2:installment_3', expected_amount: 439.13, due_date: '2026-10-31' }),
      makeObligation({ id: 'o4', source_document_id: 'doc-1', source_item_key: 'option_2:installment_4', expected_amount: 439.12, due_date: '2026-12-07' }),
    ]

    const bills = buildBillsFromObligations(obligations, baseDeps, today)
    expect(bills[0].total_cents).toBe(175651)
    expect(bills[0].remaining_cents).toBe(155651) // 175651 - 20000
    expect(bills[0].obligations[0].remaining_cents).toBe(23913)
    expect(bills[0].obligations[0].derived_status).toBe('partially_paid')
  })

  it('marks the bill as paid when all installments are paid in full', () => {
    const obligations = [
      makeObligation({ id: 'o1', source_document_id: 'doc-1', expected_amount: 439.13, paid_amount: 439.13, due_date: '2026-08-03', status: 'paid' }),
      makeObligation({ id: 'o2', source_document_id: 'doc-1', expected_amount: 439.13, paid_amount: 439.13, due_date: '2026-09-14', status: 'paid' }),
      makeObligation({ id: 'o3', source_document_id: 'doc-1', expected_amount: 439.13, paid_amount: 439.13, due_date: '2026-10-31', status: 'paid' }),
      makeObligation({ id: 'o4', source_document_id: 'doc-1', expected_amount: 439.12, paid_amount: 439.12, due_date: '2026-12-07', status: 'paid' }),
    ]

    const bills = buildBillsFromObligations(obligations, baseDeps, today)
    expect(bills[0].remaining_cents).toBe(0)
    expect(bills[0].status).toBe('paid')
  })

  it('does not merge obligations from different source documents', () => {
    const obligations = [
      makeObligation({ id: 'o1', source_document_id: 'doc-1', expected_amount: 100, due_date: '2026-08-31' }),
      makeObligation({ id: 'o2', source_document_id: 'doc-2', expected_amount: 200, due_date: '2026-09-30' }),
    ]
    const docs = [
      document,
      { ...document, id: 'doc-2', original_filename: 'utility.pdf', issuer: 'Utility Co' },
    ]

    const bills = buildBillsFromObligations(obligations, { ...baseDeps, documents: docs }, today)

    expect(bills).toHaveLength(2)
    expect(bills[0].id).not.toBe(bills[1].id)
    expect(bills[0].total_cents).toBe(10000)
    expect(bills[1].total_cents).toBe(20000)
  })

  it('keeps standalone obligations as separate bills', () => {
    const obligations = [
      makeObligation({ id: 'o1', source_document_id: null, expected_amount: 500, due_date: '2026-08-10', category: 'water' }),
      makeObligation({ id: 'o2', source_document_id: null, expected_amount: 300, due_date: '2026-08-15', category: 'trash' }),
    ]

    const bills = buildBillsFromObligations(obligations, baseDeps, today)

    expect(bills).toHaveLength(2)
    expect(bills[0].is_document_backed).toBe(false)
    expect(bills[1].is_document_backed).toBe(false)
  })

  it('does not treat obligations as rent unless category is rent', () => {
    const obligations = [
      makeObligation({ id: 'o1', source_document_id: 'doc-1', expected_amount: 439.13, due_date: '2026-08-03', category: 'school_tax' }),
    ]

    const bills = buildBillsFromObligations(obligations, baseDeps, today)
    expect(bills[0].category).toBe('school_tax')
    expect(bills[0].title).toContain('School tax')
    expect(bills[0].title).not.toContain('rent')
  })
})

describe('filterBills', () => {
  const bills = buildBillsFromObligations(
    [
      makeObligation({ id: 'o1', source_document_id: 'doc-1', expected_amount: 439.13, due_date: '2026-08-03' }),
      makeObligation({ id: 'o2', source_document_id: 'doc-1', expected_amount: 439.13, due_date: '2026-09-14' }),
      makeObligation({ id: 'o3', source_document_id: 'doc-1', expected_amount: 439.13, due_date: '2026-10-31' }),
      makeObligation({ id: 'o4', source_document_id: 'doc-1', expected_amount: 439.12, due_date: '2026-12-07' }),
      makeObligation({ id: 'o5', source_document_id: null, expected_amount: 100, due_date: '2026-08-31' }),
    ],
    baseDeps,
    today,
  )

  it('returns all bills for undefined filter', () => {
    expect(filterBills(bills, undefined)).toHaveLength(2)
  })

  it('filters overdue bills', () => {
    const filtered = filterBills(bills, 'overdue')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('doc-1')
    expect(filtered[0].overdue_cents).toBeGreaterThan(0)
  })

  it('filters due this month bills', () => {
    const filtered = filterBills(bills, 'due-this-month')
    expect(filtered).toHaveLength(2)
    expect(filtered[0].due_this_month_cents).toBe(43913)
  })

  it('filters outstanding bills', () => {
    const filtered = filterBills(bills, 'outstanding')
    expect(filtered).toHaveLength(2)
  })
})

describe('getBillHref', () => {
  it('uses source document id when present', () => {
    expect(getBillHref({ source_document_id: 'doc-1', id: 'any' })).toBe('/bills/doc-1')
  })

  it('falls back to obligation id for standalone bills', () => {
    expect(getBillHref({ source_document_id: null, id: 'obligation-1' })).toBe('/bills/obligation-1')
  })
})

describe('deriveObligationStatus for disputed obligations', () => {
  it('preserves disputed state for a past-due obligation and includes it in remaining balance', () => {
    const obligation = makeObligation({ id: 'o1', status: 'disputed', expected_amount: 100, paid_amount: 0, due_date: '2026-08-01' })

    expect(deriveObligationStatus(obligation, today)).toBe('disputed')

    const bills = buildBillsFromObligations([obligation], baseDeps, today)

    expect(bills[0].status).toBe('disputed')
    expect(bills[0].remaining_cents).toBe(10000)
    expect(bills[0].overdue_cents).toBe(10000)
  })

  it('preserves disputed state for a partially paid obligation', () => {
    const obligation = makeObligation({ id: 'o1', status: 'disputed', expected_amount: 100, paid_amount: 50, due_date: '2026-09-01' })

    expect(deriveObligationStatus(obligation, today)).toBe('disputed')

    const bills = buildBillsFromObligations([obligation], baseDeps, today)

    expect(bills[0].status).toBe('disputed')
    expect(bills[0].remaining_cents).toBe(5000)
  })

  it('marks a disputed group as disputed when at least one installment is disputed', () => {
    const obligations = [
      makeObligation({ id: 'o1', source_document_id: 'doc-1', source_item_key: 'i1', expected_amount: 100, paid_amount: 0, due_date: '2026-09-01', status: 'upcoming' }),
      makeObligation({ id: 'o2', source_document_id: 'doc-1', source_item_key: 'i2', expected_amount: 100, paid_amount: 0, due_date: '2026-10-01', status: 'disputed' }),
    ]

    const bills = buildBillsFromObligations(obligations, baseDeps, today)

    expect(bills[0].status).toBe('disputed')
    expect(bills[0].remaining_cents).toBe(20000)
  })
})

describe('buildPropertySummary', () => {
  it('excludes canceled and waived obligations from rent expected, bills due, and outstanding totals', () => {
    const obligations = [
      makeObligation({ id: 'o1', expected_amount: 1000, paid_amount: 0, due_date: '2026-08-15', category: 'rent', status: 'upcoming' }),
      makeObligation({ id: 'o2', expected_amount: 500, paid_amount: 0, due_date: '2026-08-20', category: 'rent', status: 'canceled' }),
      makeObligation({ id: 'o3', expected_amount: 300, paid_amount: 0, due_date: '2026-08-25', category: 'water', status: 'waived' }),
      makeObligation({ id: 'o4', expected_amount: 200, paid_amount: 0, due_date: '2026-08-28', category: 'trash', status: 'upcoming' }),
    ]

    const summary = buildPropertySummary(property, obligations, baseDeps, today)

    expect(summary.rentExpectedCents).toBe(100000)
    expect(summary.billsDueCents).toBe(120000) // rent 1000 + trash 200
    expect(summary.totalOutstandingCents).toBe(120000)
    expect(summary.openObligations).toBe(2)
  })

  it('matches Dashboard/Bills outstanding totals for a property with mixed statuses', () => {
    const obligations = [
      makeObligation({ id: 'o1', expected_amount: 439.13, paid_amount: 0, due_date: '2026-08-03', status: 'upcoming' }),
      makeObligation({ id: 'o2', expected_amount: 439.13, paid_amount: 439.13, due_date: '2026-09-14', status: 'paid' }),
      makeObligation({ id: 'o3', expected_amount: 439.13, paid_amount: 0, due_date: '2026-10-31', status: 'disputed' }),
      makeObligation({ id: 'o4', expected_amount: 439.12, paid_amount: 0, due_date: '2026-12-07', status: 'waived' }),
    ]

    const summary = buildPropertySummary(property, obligations, baseDeps, today)

    expect(summary.totalOutstandingCents).toBe(87826) // 43913 + 43913
    expect(summary.openObligations).toBe(2)
    expect(summary.billsDueCents).toBe(43913) // overdue August installment counts as due this month
  })

  it('lists only unresolved future obligations as upcoming', () => {
    const obligations = [
      makeObligation({ id: 'o1', expected_amount: 100, paid_amount: 0, due_date: '2026-08-01', status: 'upcoming' }),
      makeObligation({ id: 'o2', expected_amount: 200, paid_amount: 0, due_date: '2026-08-31', status: 'upcoming' }),
      makeObligation({ id: 'o3', expected_amount: 300, paid_amount: 300, due_date: '2026-08-31', status: 'paid' }),
      makeObligation({ id: 'o4', expected_amount: 400, paid_amount: 0, due_date: '2026-09-15', status: 'upcoming' }),
    ]

    const summary = buildPropertySummary(property, obligations, baseDeps, today)

    expect(summary.upcoming).toHaveLength(2)
    expect(summary.upcoming[0].obligation.id).toBe('o2')
    expect(summary.upcoming[1].obligation.id).toBe('o4')
  })
})
