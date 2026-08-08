import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { createPayment, updatePayment, deletePayment } from './payments'

vi.mock('@/lib/actions/helpers', () => ({
  requireUser: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('./obligations', () => ({
  syncObligationPayments: vi.fn(),
}))

import { requireUser } from '@/lib/actions/helpers'
import { createClient } from '@/lib/supabase/client'

type ChainableBuilder = {
  select: () => ChainableBuilder
  eq: () => ChainableBuilder
  limit: () => ChainableBuilder
  insert: (values: unknown) => ChainableBuilder
  update: (values: unknown) => ChainableBuilder
  delete: () => ChainableBuilder
  single: () => ChainableBuilder
  order: () => ChainableBuilder
  returns: () => Promise<unknown>
  then: (resolve: (value: unknown) => unknown) => Promise<unknown>
  insertedValues: unknown
  updatedValues: unknown
}

function chainableBuilder(returnsOverride: () => Promise<unknown>): ChainableBuilder {
  const builder: ChainableBuilder = {
    select() { return builder },
    eq() { return builder },
    limit() { return builder },
    insert(values: unknown) { builder.insertedValues = values; return builder },
    update(values: unknown) { builder.updatedValues = values; return builder },
    delete() { return builder },
    single() { return builder },
    order() { return builder },
    returns: returnsOverride,
    insertedValues: undefined,
    updatedValues: undefined,
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve(builder.returns()).then(resolve)
    },
  }
  return builder
}

function makeClient(options: {
  obligation?: Record<string, unknown> | null
  existingPayment?: Record<string, unknown> | null
  secondPaymentsError?: { message: string } | null
} = {}) {
  const obligationsBuilder = chainableBuilder(() =>
    Promise.resolve({ data: options.obligation, error: null })
  )

  let paymentsCallCount = 0
  const paymentsBuilder = chainableBuilder(() => {
    paymentsCallCount++
    if (paymentsCallCount === 1) {
      return Promise.resolve({ data: options.existingPayment, error: null })
    }
    return Promise.resolve({ data: null, error: options.secondPaymentsError ?? null })
  })

  const fromBuilders: Record<string, ChainableBuilder> = {
    obligations: obligationsBuilder,
    payments: paymentsBuilder,
  }

  return {
    from: vi.fn((table: string) => fromBuilders[table] ?? chainableBuilder(() => Promise.resolve({ data: [], error: null }))) as Mock<(table: string) => ChainableBuilder>,
  }
}

function makePaymentForm(overrides: { amount?: string; obligationId?: string; paymentDate?: string } = {}): FormData {
  const form = new FormData()
  form.append('obligation_id', overrides.obligationId ?? '550e8400-e29b-41d4-a716-446655440001')
  form.append('amount', overrides.amount ?? '439.13')
  form.append('payment_date', overrides.paymentDate ?? '2026-08-07')
  form.append('method', 'check')
  form.append('confirmation_reference', '')
  form.append('notes', '')
  return form
}

describe('createPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('creates a payment when the amount is within the remaining balance', async () => {
    const client = makeClient({
      obligation: {
        expected_amount: 439.13,
        paid_amount: 0,
        status: 'overdue',
        property_id: 'p-1',
        source_document_id: 'd-1',
      },
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await createPayment(makePaymentForm())

    expect(result).toEqual({ success: true })
    const inserted = (client.from('payments') as unknown as ChainableBuilder).insertedValues as Record<string, unknown> | undefined
    expect(inserted?.amount).toBe(439.13)
    expect(inserted?.obligation_id).toBe('550e8400-e29b-41d4-a716-446655440001')
    expect(inserted?.user_id).toBe('u-1')
    expect(inserted?.property_id).toBe('p-1')
  })

  it('rejects an overpayment', async () => {
    const client = makeClient({
      obligation: {
        expected_amount: 439.13,
        paid_amount: 0,
        status: 'overdue',
        property_id: 'p-1',
        source_document_id: null,
      },
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await createPayment(makePaymentForm({ amount: '500' }))

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('exceeds the remaining balance')
  })

  it('rejects a payment on a canceled or waived obligation', async () => {
    const client = makeClient({
      obligation: {
        expected_amount: 439.13,
        paid_amount: 0,
        status: 'canceled',
        property_id: 'p-1',
        source_document_id: null,
      },
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await createPayment(makePaymentForm())

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('canceled or waived')
  })

  it('rejects a cross-user obligation', async () => {
    const client = makeClient({ obligation: null })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await createPayment(makePaymentForm())

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Obligation not found')
  })

  it('rejects amounts with more than two decimal places', async () => {
    const client = makeClient({
      obligation: {
        expected_amount: 439.13,
        paid_amount: 0,
        status: 'overdue',
        property_id: 'p-1',
        source_document_id: null,
      },
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await createPayment(makePaymentForm({ amount: '439.133' }))

    expect('error' in result).toBe(true)
  })
})

describe('updatePayment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('rejects an update that would overpay the obligation', async () => {
    const client = makeClient({
      existingPayment: { obligation_id: '550e8400-e29b-41d4-a716-446655440001', amount: 0 },
      obligation: {
        expected_amount: 439.13,
        paid_amount: 0,
        status: 'overdue',
        property_id: 'p-1',
        source_document_id: null,
      },
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await updatePayment('pay-1', makePaymentForm({ amount: '500' }))

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('exceeds the remaining balance')
  })

  it('rejects changing the obligation_id when editing a payment', async () => {
    const client = makeClient({
      existingPayment: { obligation_id: 'o-other', amount: 100 },
      obligation: {
        expected_amount: 439.13,
        paid_amount: 0,
        status: 'overdue',
        property_id: 'p-1',
        source_document_id: null,
      },
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await updatePayment('pay-1', makePaymentForm())

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Payment obligation cannot be changed')
  })

  it('rejects updating a cross-user payment', async () => {
    const client = makeClient({ existingPayment: null })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await updatePayment('pay-1', makePaymentForm())

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Payment not found')
  })
})

describe('deletePayment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('rejects deleting a cross-user payment', async () => {
    const client = makeClient({ existingPayment: null })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await deletePayment('pay-1')

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Payment not found')
  })
})
