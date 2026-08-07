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

const taxPaymentOptions = [
  {
    option_type: 'discounted',
    amount: 1703.81,
    due_date: '2026-08-31',
    description: 'Full payment with discount by 8/31/2026',
    discount_amount: 52.7,
    penalty_amount: null,
    penalty_date: null,
    installments: [],
  },
  {
    option_type: 'full',
    amount: 1756.51,
    due_date: '2026-10-31',
    description: 'Full base payment by 10/31/2026',
    discount_amount: null,
    penalty_amount: 175.65,
    penalty_date: '2026-11-01',
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
    installments: [
      { amount: 439.13, due_date: '2026-08-03', description: 'Installment 1 of 4' },
      { amount: 439.13, due_date: '2026-09-14', description: 'Installment 2 of 4' },
      { amount: 439.13, due_date: '2026-10-31', description: 'Installment 3 of 4' },
      { amount: 439.12, due_date: '2026-12-07', description: 'Installment 4 of 4' },
    ],
  },
]

function makeForm(overrides: Record<string, string> = {}): FormData {
  const form = new FormData()
  const entries: Record<string, string> = {
    property_id: 'p-1',
    account_id: 'a-1',
    party_id: 'pt-1',
    document_type: 'water',
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
    const result = await confirmDocument('d-1', form)
    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('property is required')
  })

  it('returns an error when the RPC fails', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'Obligation insert failed' } })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ rpc })

    const result = await confirmDocument('d-1', makeForm())

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toBe('Obligation insert failed')
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('returns success when the RPC confirms the document', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { obligation_id: 'o-1', task_id: 't-1' },
      error: null,
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ rpc })

    const result = await confirmDocument('d-1', makeForm())

    expect(result).toEqual({ success: true })
    expect(rpc).toHaveBeenCalledTimes(1)
    const call = rpc.mock.calls[0]
    expect(call[0]).toBe('confirm_document')
    expect(call[1].p_user_id).toBe('u-1')
    expect(call[1].p_document_id).toBe('d-1')
    expect(call[1].p_property_id).toBe('p-1')
    expect(call[1].p_amount).toBe(134.6)
  })

  it('is idempotent from the client perspective on a repeated RPC call', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { obligation_id: 'o-1', task_id: 't-1' },
      error: null,
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ rpc })

    const form = makeForm()
    const first = await confirmDocument('d-1', form)
    const second = await confirmDocument('d-1', form)

    expect(first).toEqual({ success: true })
    expect(second).toEqual({ success: true })
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  it('passes the installment payment option to the confirmation RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { obligation_id: 'o-1', obligation_ids: ['o-1', 'o-2', 'o-3', 'o-4'], task_id: null },
      error: null,
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ rpc })

    const form = makeForm({
      document_type: 'school_tax',
      category: 'school_tax',
      description: 'School tax',
      payment_options: JSON.stringify(taxPaymentOptions),
      selected_payment_option_index: '2',
    })
    const result = await confirmDocument('d-1', form)

    expect(result).toEqual({ success: true })
    expect(rpc).toHaveBeenCalledTimes(1)
    const args = rpc.mock.calls[0][1]
    expect(args.p_selected_payment_option_index).toBe(2)
    expect(args.p_payment_options).toEqual(taxPaymentOptions)
    expect(args.p_amount).toBe(1756.51)
  })

  it('passes the full-payment option to the confirmation RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { obligation_id: 'o-1', obligation_ids: ['o-1'], task_id: null },
      error: null,
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ rpc })

    const form = makeForm({
      document_type: 'school_tax',
      category: 'school_tax',
      description: 'School tax',
      payment_options: JSON.stringify(taxPaymentOptions),
      selected_payment_option_index: '1',
    })
    const result = await confirmDocument('d-1', form)

    expect(result).toEqual({ success: true })
    const args = rpc.mock.calls[0][1]
    expect(args.p_selected_payment_option_index).toBe(1)
    expect(args.p_payment_options[1].option_type).toBe('full')
    expect(args.p_payment_options[1].amount).toBe(1756.51)
    expect(args.p_payment_options[1].due_date).toBe('2026-10-31')
  })
})
