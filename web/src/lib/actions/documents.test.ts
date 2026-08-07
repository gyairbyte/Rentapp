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
})
