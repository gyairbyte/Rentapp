import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/actions/helpers', () => ({
  requireUser: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

import { getBills, getBill } from './bills'
import { requireUser } from './helpers'
import { createClient } from '@/lib/supabase/client'
import type { Obligation, Document, Property, Payment } from '@/lib/types'

function makeSupabaseClient({ obligations = [] as Obligation[], documents = [] as Document[], properties = [] as Property[], payments = [] as Payment[] } = {}) {
  const tableData: Record<string, unknown[]> = {
    obligations,
    documents,
    properties,
    accounts: [],
    parties: [],
    payments,
  }

  function builder(table: string) {
    const b = {
      select: vi.fn(() => b),
      eq: vi.fn(() => b),
      neq: vi.fn(() => b),
      in: vi.fn(() => b),
      or: vi.fn(() => b),
      not: vi.fn(() => b),
      order: vi.fn(() => b),
      limit: vi.fn(() => b),
      returns: vi.fn(() => Promise.resolve({ data: tableData[table] ?? [], error: null })),
    }
    return b
  }

  return {
    from: vi.fn((table: string) => builder(table)),
    rpc: vi.fn(),
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(() => Promise.resolve({ data: { signedUrl: 'https://example.com/signed.pdf' }, error: null })),
      })),
    },
  }
}

const user = { id: 'u-1' }
const today = new Date('2026-08-07T00:00:00Z')

const property: Property = {
  id: 'p-1',
  user_id: 'u-1',
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
  id: 'd-1',
  user_id: 'u-1',
  property_id: 'p-1',
  account_id: null,
  party_id: null,
  storage_path: 'u-1/school-tax.pdf',
  original_filename: 'bethlehem-school-tax.pdf',
  file_hash: 'hash',
  file_size: 1000,
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

function makeObligation(overrides: Partial<Obligation> = {}): Obligation {
  return {
    id: 'o-1',
    user_id: 'u-1',
    property_id: 'p-1',
    account_id: null,
    party_id: null,
    recurring_rule_id: null,
    source_document_id: null,
    source_item_key: null,
    direction: 'payable',
    category: 'school_tax',
    description: 'School tax bill',
    expected_amount: 439.13,
    paid_amount: 0,
    due_date: '2026-08-03',
    status: 'upcoming',
    paid_date: null,
    ...overrides,
  } as Obligation
}

describe('getBills', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(user)
  })

  it('filters bills by overdue using the URL filter', async () => {
    const obligations = [
      makeObligation({ id: 'o1', source_document_id: 'd-1', source_item_key: 'option_2:installment_1', expected_amount: 439.13, due_date: '2026-08-03' }),
      makeObligation({ id: 'o2', source_document_id: 'd-1', source_item_key: 'option_2:installment_2', expected_amount: 439.13, due_date: '2026-09-14' }),
      makeObligation({ id: 'o3', source_document_id: 'd-1', source_item_key: 'option_2:installment_3', expected_amount: 439.13, due_date: '2026-10-31' }),
      makeObligation({ id: 'o4', source_document_id: 'd-1', source_item_key: 'option_2:installment_4', expected_amount: 439.12, due_date: '2026-12-07' }),
      makeObligation({ id: 'o5', source_document_id: null, expected_amount: 100, due_date: '2026-08-31', category: 'water' }),
    ]

    const client = makeSupabaseClient({ obligations, documents: [document], properties: [property] })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await getBills({ filter: 'overdue', today })

    expect(result.filter).toBe('overdue')
    expect(result.bills).toHaveLength(1)
    expect(result.bills[0].id).toBe('d-1')
    expect(result.bills[0].overdue_cents).toBe(43913)
  })

  it('passes through all bills for the all filter', async () => {
    const obligations = [
      makeObligation({ id: 'o1', source_document_id: 'd-1', source_item_key: 'option_2:installment_1', expected_amount: 439.13, due_date: '2026-08-03' }),
      makeObligation({ id: 'o2', source_document_id: 'd-1', source_item_key: 'option_2:installment_2', expected_amount: 439.13, due_date: '2026-09-14' }),
    ]
    const client = makeSupabaseClient({ obligations, documents: [document], properties: [property] })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await getBills({ filter: 'all', today })

    expect(result.bills).toHaveLength(1)
  })
})

describe('getBill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(user)
  })

  it('returns null when no obligations match the id', async () => {
    const client = makeSupabaseClient({ obligations: [], documents: [], properties: [] })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await getBill('nonexistent', { today })

    expect(result).toBeNull()
  })

  it('groups all document-backed installments on one detail page', async () => {
    const obligations = [
      makeObligation({ id: 'o1', source_document_id: 'd-1', source_item_key: 'option_2:installment_1', expected_amount: 439.13, due_date: '2026-08-03' }),
      makeObligation({ id: 'o2', source_document_id: 'd-1', source_item_key: 'option_2:installment_2', expected_amount: 439.13, due_date: '2026-09-14' }),
      makeObligation({ id: 'o3', source_document_id: 'd-1', source_item_key: 'option_2:installment_3', expected_amount: 439.13, due_date: '2026-10-31' }),
      makeObligation({ id: 'o4', source_document_id: 'd-1', source_item_key: 'option_2:installment_4', expected_amount: 439.12, due_date: '2026-12-07' }),
    ]
    const client = makeSupabaseClient({ obligations, documents: [document], properties: [property] })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await getBill('d-1', { today })

    expect(result).not.toBeNull()
    expect(result!.bill.id).toBe('d-1')
    expect(result!.bill.obligations).toHaveLength(4)
    expect(result!.signedUrl).toBe('https://example.com/signed.pdf')
    expect(result!.bill.total_cents).toBe(175651)
  })
})
