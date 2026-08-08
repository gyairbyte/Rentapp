import { describe, it, expect, vi, beforeEach } from 'vitest'
import { confirmDocument, getDocumentWithDetails, saveCorrectedInstallmentSchedule } from './documents'
import { emptyExtraction } from '@/lib/document-intelligence/extraction-schema'

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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function makeTaxExtraction(): DocumentExtraction {
  return makeExtraction({
    likely_category: extracted('school_tax'),
    proposed_actions: [obligationAction(clone(taxPaymentOptions))],
  })
}

function makeLegacyExtractionRaw(): unknown {
  const extraction: Record<string, unknown> = { ...emptyExtraction() }
  extraction.document_type = 'school_tax'
  extraction.document_class = 'financial'
  extraction.requires = 'money'
  extraction.issuer = { value: 'Bethlehem Area School District', confidence: 'high', evidence: null }
  extraction.parcel_number = { value: '642702833391', confidence: 'high', evidence: null }
  extraction.service_address = { value: '610 S Bergen Street, Fountain Hill, PA 18015', confidence: 'high', evidence: null }
  extraction.amount_due = { value: 1756.51, confidence: 'high', evidence: null }
  extraction.due_date = { value: '2026-10-31', confidence: 'high', evidence: null }
  extraction.likely_category = { value: 'school_tax', confidence: 'high', evidence: null }
  extraction.direction = { value: 'payable', confidence: 'high', evidence: null }

  const installments = [
    { amount: 439.13, due_date: '2026-08-03', description: 'Installment 1 of 4' },
    { amount: 439.13, due_date: '2026-09-14', description: 'Installment 2 of 4' },
    { amount: 439.13, due_date: '2026-10-31', description: 'Installment 3 of 4' },
    { amount: 439.12, due_date: '2026-12-07', description: 'Installment 4 of 4' },
  ]

  const paymentOptions = [
    {
      option_type: 'installment_plan',
      amount: 1756.51,
      due_date: '2026-10-31',
      description: 'Four installments',
      discount_amount: null,
      penalty_amount: null,
      penalty_date: null,
      // intentionally omit late_payment_terms and installment-level late_payment_terms
      installments,
    },
  ]

  extraction.proposed_actions = [
    {
      type: 'obligation',
      direction: 'payable',
      category: 'school_tax',
      description: 'School tax bill',
      expected_amount: 1756.51,
      due_date: '2026-10-31',
      action_due_date: null,
      period_start: null,
      period_end: null,
      title: null,
      payment_options: paymentOptions,
    },
  ]

  return extraction
}

function makeUnbalancedTaxExtraction(): DocumentExtraction {
  const extraction = makeTaxExtraction()
  const obligationAction = extraction.proposed_actions.find((a) => a.type === 'obligation')
  const option = obligationAction?.payment_options.find((o) => o.option_type === 'installment_plan')
  if (option && option.installments) {
    option.installments[3].amount = 439.13
  }
  return extraction
}

function makeSupabaseClient({
  extraction,
  rpcReturn,
}: {
  extraction?: unknown
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

  const runRows = extraction ? [{ id: 'run-1', normalized_extraction: extraction }] : []

  type Builder = {
    table: string
    select: ReturnType<typeof vi.fn<() => Builder>>
    eq: ReturnType<typeof vi.fn<() => Builder>>
    neq: ReturnType<typeof vi.fn<() => Builder>>
    order: ReturnType<typeof vi.fn<() => Builder>>
    limit: ReturnType<typeof vi.fn<() => Builder>>
    single: ReturnType<typeof vi.fn<() => Builder>>
    insert: ReturnType<typeof vi.fn<(values: unknown) => Builder>>
    update: ReturnType<typeof vi.fn<() => Builder>>
    then: ReturnType<typeof vi.fn<(resolve: (value: unknown) => unknown) => unknown>>
    returns: ReturnType<typeof vi.fn<() => unknown>>
    insertedValues: unknown
  }

  const builders = new Map<string, Builder>()

  function mockFrom(table: string): Builder {
    if (builders.has(table)) return builders.get(table)!

    let single = false
    let neqCalled = false
    const builder: Builder = {
      table,
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => {
        neqCalled = true
        return builder
      }),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      single: vi.fn(() => {
        single = true
        return builder
      }),
      insert: vi.fn((values: unknown) => {
        builder.insertedValues = values
        return builder
      }),
      update: vi.fn(() => builder),
      then: vi.fn((resolve) => resolve({ data: [], error: null })),
      returns: vi.fn(() => {
        if (table === 'documents') {
          if (single) {
            return Promise.resolve({ data: documentRow, error: null })
          }
          return Promise.resolve({ data: neqCalled ? [] : [documentRow], error: null })
        }
        if (table === 'document_processing_runs') {
          return Promise.resolve({ data: runRows, error: null })
        }
        return Promise.resolve({ data: [], error: null })
      }),
      insertedValues: undefined,
    }
    builders.set(table, builder)
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

  it('rejects a non-integer payment option selection', async () => {
    const client = makeSupabaseClient({ extraction: makeTaxExtraction() })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const form = makeForm({ selected_payment_option_index: '1.5' })
    const result = await confirmDocument('d-1', form)

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Invalid payment option selection')
    expect(client.rpc).not.toHaveBeenCalled()

    const nanForm = makeForm({ selected_payment_option_index: 'NaN' })
    const nanResult = await confirmDocument('d-1', nanForm)
    expect('error' in nanResult).toBe(true)
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

describe('saveCorrectedInstallmentSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('saves the corrected schedule as a new authoritative version in a single run', async () => {
    const extraction = makeTaxExtraction()
    const client = makeSupabaseClient({ extraction })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await saveCorrectedInstallmentSchedule('d-1', 2, [
      { amount: '439.13', due_date: '2026-08-03' },
      { amount: '439.13', due_date: '2026-09-14' },
      { amount: '439.13', due_date: '2026-10-31' },
      { amount: '439.12', due_date: '2026-12-07' },
    ])

    expect(result).toEqual({ success: true })
    expect(client.from).toHaveBeenCalledWith('document_processing_runs')
    const documentsBuilder = client.from('documents')
    expect(documentsBuilder.update).not.toHaveBeenCalled()
    const runBuilder = client.from('document_processing_runs')
    expect(runBuilder.insert).toHaveBeenCalledTimes(1)
  })

  it('preserves a second proposed action while correcting only the targeted one', async () => {
    const extraction = makeExtraction({
      likely_category: extracted('school_tax'),
      proposed_actions: [
        obligationAction(clone(taxPaymentOptions)),
        {
          type: 'obligation',
          direction: 'payable',
          category: 'water',
          description: 'Water bill',
          expected_amount: 100,
          due_date: '2026-09-01',
          action_due_date: null,
          period_start: null,
          period_end: null,
          title: null,
          payment_options: [
            paymentOption({ option_type: 'full', amount: 100, due_date: '2026-09-01', description: 'Water' }),
          ],
        },
      ],
    })
    const client = makeSupabaseClient({ extraction })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await saveCorrectedInstallmentSchedule('d-1', 2, [
      { amount: '439.13', due_date: '2026-08-03' },
      { amount: '439.13', due_date: '2026-09-14' },
      { amount: '439.13', due_date: '2026-10-31' },
      { amount: '439.12', due_date: '2026-12-07' },
    ])

    expect(result).toEqual({ success: true })
    const runBuilder = client.from('document_processing_runs')
    const insertedRun = runBuilder.insert.mock.calls[0][0] as {
      normalized_extraction?: {
        proposed_actions?: {
          description?: string
          payment_options?: { amount?: number; installments?: { amount?: number }[] }[]
        }[]
      }
    }
    const proposedActions = insertedRun?.normalized_extraction?.proposed_actions ?? []
    expect(proposedActions).toHaveLength(2)
    expect(proposedActions[1]?.description).toBe('Water bill')
    expect(proposedActions[1]?.payment_options?.[0]?.amount).toBe(100)
    expect(proposedActions[0]?.payment_options?.[2]?.installments?.[3]?.amount).toBe(439.12)
  })

  it('rejects an unbalanced corrected schedule', async () => {
    const extraction = makeTaxExtraction()
    const client = makeSupabaseClient({ extraction })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await saveCorrectedInstallmentSchedule('d-1', 2, [
      { amount: '439.13', due_date: '2026-08-03' },
      { amount: '439.13', due_date: '2026-09-14' },
      { amount: '439.13', due_date: '2026-10-31' },
      { amount: '439.13', due_date: '2026-12-07' },
    ])

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('does not match')
  })

  it('rejects a corrected amount with more than two decimal places', async () => {
    const extraction = makeTaxExtraction()
    const client = makeSupabaseClient({ extraction })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await saveCorrectedInstallmentSchedule('d-1', 2, [
      { amount: '439.125', due_date: '2026-08-03' },
      { amount: '439.13', due_date: '2026-09-14' },
      { amount: '439.13', due_date: '2026-10-31' },
      { amount: '439.12', due_date: '2026-12-07' },
    ])

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('valid to cents')
  })

  it('rejects an invalid installment due date', async () => {
    const extraction = makeTaxExtraction()
    const client = makeSupabaseClient({ extraction })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await saveCorrectedInstallmentSchedule('d-1', 2, [
      { amount: '439.13', due_date: '2026-13-01' },
      { amount: '439.13', due_date: '2026-09-14' },
      { amount: '439.13', due_date: '2026-10-31' },
      { amount: '439.12', due_date: '2026-12-07' },
    ])

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('due date')
  })

  it('rejects a nonpositive installment amount', async () => {
    const extraction = makeTaxExtraction()
    const client = makeSupabaseClient({ extraction })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await saveCorrectedInstallmentSchedule('d-1', 2, [
      { amount: '439.13', due_date: '2026-08-03' },
      { amount: '439.13', due_date: '2026-09-14' },
      { amount: '439.13', due_date: '2026-10-31' },
      { amount: '0', due_date: '2026-12-07' },
    ])

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('positive')
  })

  it('rejects a changed installment count', async () => {
    const extraction = makeTaxExtraction()
    const client = makeSupabaseClient({ extraction })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await saveCorrectedInstallmentSchedule('d-1', 2, [
      { amount: '439.13', due_date: '2026-08-03' },
      { amount: '439.12', due_date: '2026-09-14' },
    ])

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('count')
  })

  it('rejects a non-integer or out-of-range selected option index', async () => {
    const extraction = makeTaxExtraction()
    const client = makeSupabaseClient({ extraction })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    await expect(saveCorrectedInstallmentSchedule('d-1', 1.5, [
      { amount: '439.12', due_date: '2026-12-07' },
    ])).resolves.toEqual({ error: 'Invalid payment option selection' })

    await expect(saveCorrectedInstallmentSchedule('d-1', NaN, [
      { amount: '439.12', due_date: '2026-12-07' },
    ])).resolves.toEqual({ error: 'Invalid payment option selection' })
  })
})

describe('confirmDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('rejects an unbalanced authoritative installment plan without calling the RPC', async () => {
    const extraction = makeUnbalancedTaxExtraction()
    const client = makeSupabaseClient({ extraction })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const form = makeForm({ selected_payment_option_index: '2' })
    const result = await confirmDocument('d-1', form)

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('does not match')
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('passes the corrected installment plan to the RPC after editing', async () => {
    const extraction = makeTaxExtraction()
    const client = makeSupabaseClient({ extraction })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const form = makeForm({ selected_payment_option_index: '2' })
    const result = await confirmDocument('d-1', form)

    expect(result).toEqual({ success: true })
    expect(client.rpc).toHaveBeenCalledTimes(1)
    const args = client.rpc.mock.calls[0][1]
    expect(args.p_selected_payment_option_index).toBe(2)
    expect(args.p_payment_options[2].installments[3].amount).toBe(439.12)
  })
})

describe('getDocumentWithDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('normalizes legacy processing-run extraction missing late_payment_terms arrays', async () => {
    const legacyRaw = makeLegacyExtractionRaw()
    const client = makeSupabaseClient({ extraction: legacyRaw })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await getDocumentWithDetails('d-1')

    expect(result).not.toBeNull()
    const extraction = result!.extraction
    expect(extraction.proposed_actions).toHaveLength(1)
    const option = extraction.proposed_actions[0].payment_options[0]
    expect(option.late_payment_terms).toEqual([])
    expect(option.installments).toHaveLength(4)
    expect(option.installments[0].late_payment_terms).toEqual([])
  })
})
