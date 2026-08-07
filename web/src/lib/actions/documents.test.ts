import { describe, it, expect, vi, beforeEach } from 'vitest'
import { confirmDocument } from './documents'

vi.mock('@/lib/actions/helpers', () => ({
  requireUser: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { requireUser } from '@/lib/actions/helpers'
import { createClient } from '@/lib/supabase/client'
import type { DocumentExtraction, PaymentOption } from '@/lib/types'

const taxPaymentOptions: PaymentOption[] = [
  {
    option_type: 'discounted',
    amount: 1703.81,
    due_date: '2026-08-31',
    description: 'Full payment with discount by 8/31/2026',
    discount_amount: 52.7,
    penalty_amount: null,
    penalty_date: null,
    late_payment_terms: [],
    installments: [],
  },
  {
    option_type: 'full',
    amount: 1756.51,
    due_date: '2026-10-31',
    description: 'Full base payment by 10/31/2026',
    discount_amount: null,
    penalty_amount: null,
    penalty_date: null,
    late_payment_terms: [],
    installments: [],
  },
  {
    option_type: 'installment_plan',
    amount: 1756.51,
    due_date: '2026-10-31',
    description: 'Four installment plan',
    discount_amount: null,
    penalty_amount: null,
    penalty_date: null,
    late_payment_terms: [],
    installments: [
      { amount: 439.13, due_date: '2026-08-03', description: 'Installment 1 of 4', late_payment_terms: [] },
      { amount: 439.13, due_date: '2026-09-14', description: 'Installment 2 of 4', late_payment_terms: [] },
      { amount: 439.13, due_date: '2026-10-31', description: 'Installment 3 of 4', late_payment_terms: [] },
      { amount: 439.12, due_date: '2026-12-07', description: 'Installment 4 of 4', late_payment_terms: [] },
    ],
  },
]

function paymentOption(overrides: Partial<PaymentOption> & { option_type: PaymentOption['option_type'] }): PaymentOption {
  return {
    option_type: overrides.option_type,
    amount: overrides.amount ?? null,
    due_date: overrides.due_date ?? null,
    description: overrides.description ?? null,
    discount_amount: overrides.discount_amount ?? null,
    penalty_amount: overrides.penalty_amount ?? null,
    penalty_date: overrides.penalty_date ?? null,
    late_payment_terms: overrides.late_payment_terms ?? [],
    installments: overrides.installments ?? [],
  }
}

function extracted<T>(value: T) {
  return { value, confidence: 'high' as const, evidence: null }
}

function obligationAction(paymentOptions: typeof taxPaymentOptions): DocumentExtraction['proposed_actions'][number] {
  return {
    type: 'obligation' as const,
    direction: 'payable' as const,
    category: 'school_tax',
    description: 'School tax bill',
    expected_amount: 1756.51,
    due_date: '2026-10-31',
    action_due_date: null,
    period_start: null,
    period_end: null,
    title: null,
    payment_options: paymentOptions,
  }
}

function makeExtraction(overrides: Partial<DocumentExtraction> = {}): DocumentExtraction {
  return {
    document_type: null,
    document_class: 'financial',
    requires: 'money',
    issuer: extracted(null),
    account_number: extracted(null),
    account_number_suffix: extracted(null),
    invoice_number: extracted(null),
    parcel_number: extracted(null),
    policy_number: extracted(null),
    service_address: extracted(null),
    mailing_address: extracted(null),
    tenant_name: extracted(null),
    property_identifiers: extracted(null),
    document_date: extracted(null),
    due_date: extracted('2026-08-31'),
    service_period_start: extracted(null),
    service_period_end: extracted(null),
    amount_due: extracted(1756.51),
    total_amount: extracted(null),
    previous_balance: extracted(null),
    payment_received: extracted(null),
    direction: extracted('payable'),
    likely_category: extracted('water'),
    required_action: extracted(null),
    action_due_date: extracted(null),
    notes: extracted(null),
    proposed_actions: [obligationAction([])],
    ...overrides,
  }
}

function makeTaxExtraction(): DocumentExtraction {
  return makeExtraction({
    likely_category: extracted('school_tax'),
    proposed_actions: [obligationAction(taxPaymentOptions)],
  })
}

function makeSupabaseClient({
  extraction,
  rpcReturn,
}: {
  extraction?: DocumentExtraction
  rpcReturn?: { data?: unknown; error?: { message: string } | null }
}) {
  const documentRow = {
    id: 'd-1',
    user_id: 'u-1',
    raw_ai_extraction: null,
    storage_path: 'u-1/test.pdf',
    original_filename: 'test.pdf',
    file_hash: 'hash',
    file_size: 1000,
    mime_type: 'application/pdf',
    processing_status: 'processed',
    review_status: 'unreviewed',
  }

  const runRows = extraction ? [{ normalized_extraction: extraction }] : []

  function mockFrom(table: string) {
    let single = false
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      single: vi.fn(() => {
        single = true
        return builder
      }),
      returns: vi.fn(() => {
        if (table === 'documents') {
          return Promise.resolve(single ? { data: documentRow, error: null } : { data: [documentRow], error: null })
        }
        if (table === 'document_processing_runs') {
          return Promise.resolve({ data: runRows, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      }),
    }
    return builder
  }

  return {
    rpc: vi.fn().mockResolvedValue(
      rpcReturn ?? {
        data: { obligation_ids: ['o-1'], task_id: null },
        error: null,
      },
    ),
    from: vi.fn(mockFrom),
  }
}

function makeForm(overrides: Record<string, string> = {}): FormData {
  const form = new FormData()
  const entries: Record<string, string> = {
    property_id: 'p-1',
    account_id: 'a-1',
    party_id: 'pt-1',
    document_type: 'school_tax',
    issuer: 'City Water',
    document_date: '2026-08-01',
    due_date: '2026-08-25',
    amount: '134.60',
    direction: 'payable',
    category: 'water',
    description: 'Water bill',
    ...overrides,
  }
  for (const [key, value] of Object.entries(entries)) {
    form.append(key, value)
  }
  return form
}

describe('confirmDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('returns an error if property_id is missing', async () => {
    const form = makeForm({ property_id: '' })
    const client = makeSupabaseClient({ extraction: makeTaxExtraction() })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await confirmDocument('d-1', form)

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('property is required')
  })

  it('returns an error when the RPC fails', async () => {
    const client = makeSupabaseClient({
      extraction: makeExtraction(),
      rpcReturn: { data: null, error: { message: 'Obligation insert failed' } },
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await confirmDocument('d-1', makeForm())

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toBe('Obligation insert failed')
    expect(client.rpc).toHaveBeenCalledTimes(1)
  })

  it('returns success when the RPC confirms the document', async () => {
    const client = makeSupabaseClient({ extraction: makeExtraction() })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await confirmDocument('d-1', makeForm())

    expect(result).toEqual({ success: true })
    expect(client.rpc).toHaveBeenCalledTimes(1)
    const call = client.rpc.mock.calls[0]
    expect(call[0]).toBe('confirm_document')
    expect(call[1].p_user_id).toBe('u-1')
    expect(call[1].p_document_id).toBe('d-1')
    expect(call[1].p_property_id).toBe('p-1')
    expect(call[1].p_amount).toBe(134.6)
  })

  it('rejects an out-of-range payment option selection', async () => {
    const client = makeSupabaseClient({ extraction: makeTaxExtraction() })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const form = makeForm({ selected_payment_option_index: '99' })
    const result = await confirmDocument('d-1', form)

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Invalid payment option selection')
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('passes the installment payment option to the confirmation RPC from server-side extraction', async () => {
    const extraction = makeTaxExtraction()
    const client = makeSupabaseClient({ extraction })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const form = makeForm({ selected_payment_option_index: '2' })
    const result = await confirmDocument('d-1', form)

    expect(result).toEqual({ success: true })
    expect(client.rpc).toHaveBeenCalledTimes(1)
    const args = client.rpc.mock.calls[0][1]
    expect(args.p_selected_payment_option_index).toBe(2)
    expect(args.p_payment_options).toEqual(taxPaymentOptions)
    expect(args.p_amount).toBe(1756.51)
    expect(args.p_due_date).toBe('2026-10-31')
  })

  it('passes the full-payment option to the confirmation RPC from server-side extraction', async () => {
    const extraction = makeTaxExtraction()
    const client = makeSupabaseClient({ extraction })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const form = makeForm({ selected_payment_option_index: '1' })
    const result = await confirmDocument('d-1', form)

    expect(result).toEqual({ success: true })
    const args = client.rpc.mock.calls[0][1]
    expect(args.p_selected_payment_option_index).toBe(1)
    expect(args.p_payment_options[1].option_type).toBe('full')
    expect(args.p_payment_options[1].amount).toBe(1756.51)
    expect(args.p_payment_options[1].due_date).toBe('2026-10-31')
  })

  it('ignores tampered browser payment-options JSON and uses server-side extraction', async () => {
    const extraction = makeTaxExtraction()
    const client = makeSupabaseClient({ extraction })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const tampered = JSON.stringify([
      { option_type: 'full', amount: 1, due_date: '2026-01-01', description: 'Hacked', installments: [] },
    ])
    const form = makeForm({
      selected_payment_option_index: '0',
      payment_options: tampered,
      amount: '1',
      due_date: '2026-01-01',
    })
    const result = await confirmDocument('d-1', form)

    expect(result).toEqual({ success: true })
    const args = client.rpc.mock.calls[0][1]
    expect(args.p_payment_options).toEqual(taxPaymentOptions)
    expect(args.p_amount).toBe(taxPaymentOptions[0].amount)
  })

  it('uses the manual/top-level path when only nonselectable payment options exist', async () => {
    const extraction = makeExtraction({
      likely_category: extracted('school_tax'),
      proposed_actions: [
        obligationAction([
          paymentOption({ option_type: 'penalty', amount: 1932.16, due_date: '2026-10-31', description: 'Penalty after 10/31' }),
        ]),
      ],
    })
    const client = makeSupabaseClient({ extraction })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await confirmDocument('d-1', makeForm())

    expect(result).toEqual({ success: true })
    const args = client.rpc.mock.calls[0][1]
    expect(args.p_selected_payment_option_index).toBeNull()
    expect(args.p_amount).toBe(134.6)
    expect(args.p_due_date).toBe('2026-08-25')
  })

  it('requires a payment option selection when multiple selectable plans exist', async () => {
    const client = makeSupabaseClient({ extraction: makeTaxExtraction() })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const form = makeForm()
    const result = await confirmDocument('d-1', form)

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('A payment option must be selected')
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('rejects a submitted nonselectable payment option index', async () => {
    const extraction = makeExtraction({
      likely_category: extracted('school_tax'),
      proposed_actions: [
        obligationAction([
          paymentOption({ option_type: 'penalty', amount: 1932.16, due_date: '2026-10-31', description: 'Penalty' }),
          ...taxPaymentOptions,
        ]),
      ],
    })
    const client = makeSupabaseClient({ extraction })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const form = makeForm({ selected_payment_option_index: '0' })
    const result = await confirmDocument('d-1', form)

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('not a valid selectable plan')
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('preserves the original index when an earlier option is filtered out as nonselectable', async () => {
    const extraction = makeExtraction({
      likely_category: extracted('school_tax'),
      proposed_actions: [
        obligationAction([
          paymentOption({ option_type: 'penalty', amount: 1932.16, due_date: '2026-10-31', description: 'Penalty' }),
          ...taxPaymentOptions,
        ]),
      ],
    })
    const client = makeSupabaseClient({ extraction })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const form = makeForm({ selected_payment_option_index: '2' })
    const result = await confirmDocument('d-1', form)

    expect(result).toEqual({ success: true })
    const args = client.rpc.mock.calls[0][1]
    expect(args.p_selected_payment_option_index).toBe(2)
    expect(args.p_payment_options[2].option_type).toBe('full')
    expect(args.p_amount).toBe(1756.51)
    expect(args.p_due_date).toBe('2026-10-31')
  })
})
