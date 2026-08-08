import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createObligation, updateObligation } from './obligations'

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

type BuilderMode = 'list' | 'select' | 'insert' | 'update'

type TableBuilderOptions = {
  singleReturn?: unknown
  singleError?: unknown | null
  listReturn?: unknown
  insertReturn?: unknown
  insertError?: unknown | null
  updateError?: unknown | null
  onInsert?: (values: unknown) => void
  onUpdate?: (values: unknown) => void
}

function tableBuilder(options: TableBuilderOptions) {
  let mode: BuilderMode = 'list'
  let isSingle = false

  const builder = {
    select() {
      if (mode !== 'insert' && mode !== 'update') mode = 'select'
      isSingle = false
      return builder
    },
    eq() {
      return builder
    },
    insert(values: unknown) {
      mode = 'insert'
      isSingle = false
      options.onInsert?.(values)
      return builder
    },
    update(values: unknown) {
      mode = 'update'
      isSingle = false
      options.onUpdate?.(values)
      return builder
    },
    delete() {
      return builder
    },
    single() {
      isSingle = true
      return builder
    },
    order() {
      return builder
    },
    not() {
      return builder
    },
    in() {
      return builder
    },
    returns<T>() {
      if (mode === 'insert') {
        return Promise.resolve({ data: options.insertReturn, error: options.insertError }) as Promise<T>
      }
      if (mode === 'update') {
        return Promise.resolve({ data: null, error: options.updateError }) as Promise<T>
      }
      if (isSingle) {
        return Promise.resolve({ data: options.singleReturn, error: options.singleError }) as Promise<T>
      }
      return Promise.resolve({ data: options.listReturn, error: null }) as Promise<T>
    },
    then<T>(resolve: (value: unknown) => T) {
      return Promise.resolve(builder.returns()).then(resolve) as Promise<T>
    },
  }

  return builder
}

function makeClient(options: {
  property?: { id: string; user_id: string } | null
  account?: { id: string; user_id: string } | null
  party?: { id: string; user_id: string } | null
  recurringRule?: { id: string; user_id: string } | null
  existing?: { id: string; property_id: string; user_id: string; paid_amount: number; status: string } | null
  insertReturn?: { id: string }
  insertError?: { message: string } | null
  updateError?: { message: string } | null
} = {}) {
  let insertedValues: unknown = undefined
  let updatedValues: unknown = undefined

  const builders: Record<string, ReturnType<typeof tableBuilder>> = {
    properties: tableBuilder({
      singleReturn: options.property,
      singleError: options.property ? null : { message: 'not found' },
    }),
    accounts: tableBuilder({
      singleReturn: options.account,
      singleError: options.account ? null : { message: 'not found' },
    }),
    parties: tableBuilder({
      singleReturn: options.party,
      singleError: options.party ? null : { message: 'not found' },
    }),
    recurring_rules: tableBuilder({
      singleReturn: options.recurringRule,
      singleError: options.recurringRule ? null : { message: 'not found' },
    }),
    obligations: tableBuilder({
      singleReturn: options.existing,
      singleError: options.existing ? null : { message: 'not found' },
      insertReturn: options.insertReturn ?? { id: 'o-1' },
      insertError: options.insertError ?? null,
      updateError: options.updateError ?? null,
      onInsert: (values) => {
        insertedValues = values
      },
      onUpdate: (values) => {
        updatedValues = values
      },
    }),
  }

  const client = {
    from: vi.fn((table: string) => builders[table] ?? tableBuilder({})),
    get insertedValues() {
      return insertedValues
    },
    get updatedValues() {
      return updatedValues
    },
  }

  return client
}

function makeObligationForm(overrides: {
  propertyId?: string
  accountId?: string
  partyId?: string
  recurringRuleId?: string
  direction?: string
  category?: string
  description?: string
  expectedAmount?: string
  dueDate?: string
  notes?: string
  periodStart?: string
  periodEnd?: string
} = {}): FormData {
  const form = new FormData()
  form.append('property_id', overrides.propertyId ?? '550e8400-e29b-41d4-a716-446655440001')
  form.append('account_id', overrides.accountId ?? '')
  form.append('party_id', overrides.partyId ?? '')
  form.append('direction', overrides.direction ?? 'payable')
  form.append('category', overrides.category ?? 'water')
  form.append('description', overrides.description ?? 'Monthly water bill')
  form.append('expected_amount', overrides.expectedAmount ?? '45.67')
  form.append('due_date', overrides.dueDate ?? '2030-08-15')
  form.append('notes', overrides.notes ?? '')
  if (overrides.recurringRuleId) form.append('recurring_rule_id', overrides.recurringRuleId)
  if (overrides.periodStart) form.append('period_start', overrides.periodStart)
  if (overrides.periodEnd) form.append('period_end', overrides.periodEnd)
  return form
}

describe('createObligation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('creates a one-time obligation from the /obligations/new payload without optional recurrence keys', async () => {
    const client = makeClient({
      property: { id: 'p-1', user_id: 'u-1' },
      insertReturn: { id: 'o-1' },
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await createObligation(makeObligationForm())

    expect(result).toEqual({ success: true, id: 'o-1' })
    const inserted = (client.insertedValues ?? {}) as Record<string, unknown>
    expect(inserted.user_id).toBe('u-1')
    expect(inserted.property_id).toBe('550e8400-e29b-41d4-a716-446655440001')
    expect(inserted.recurring_rule_id).toBeNull()
    expect(inserted.period_start).toBeNull()
    expect(inserted.period_end).toBeNull()
    expect(inserted.account_id).toBeNull()
    expect(inserted.party_id).toBeNull()
    expect(inserted.paid_amount).toBe(0)
    expect(inserted.paid_date).toBeNull()
    expect(inserted.expected_amount).toBe(45.67)
    expect(inserted.due_date).toBe('2030-08-15')
    expect(inserted.status).toBe('upcoming')
  })

  it('preserves supplied optional recurrence and service-period values', async () => {
    const client = makeClient({
      property: { id: 'p-1', user_id: 'u-1' },
      account: { id: '550e8400-e29b-41d4-a716-446655440002', user_id: 'u-1' },
      party: { id: '550e8400-e29b-41d4-a716-446655440003', user_id: 'u-1' },
      recurringRule: { id: '550e8400-e29b-41d4-a716-446655440004', user_id: 'u-1' },
      insertReturn: { id: 'o-2' },
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await createObligation(
      makeObligationForm({
        accountId: '550e8400-e29b-41d4-a716-446655440002',
        partyId: '550e8400-e29b-41d4-a716-446655440003',
        recurringRuleId: '550e8400-e29b-41d4-a716-446655440004',
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
      }),
    )

    expect(result).toEqual({ success: true, id: 'o-2' })
    const inserted = (client.insertedValues ?? {}) as Record<string, unknown>
    expect(inserted.account_id).toBe('550e8400-e29b-41d4-a716-446655440002')
    expect(inserted.party_id).toBe('550e8400-e29b-41d4-a716-446655440003')
    expect(inserted.recurring_rule_id).toBe('550e8400-e29b-41d4-a716-446655440004')
    expect(inserted.period_start).toBe('2026-07-01')
    expect(inserted.period_end).toBe('2026-07-31')
  })

  it('rejects a cross-user property', async () => {
    const client = makeClient({ property: null })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await createObligation(makeObligationForm())

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Property not found')
    expect(client.insertedValues).toBeUndefined()
  })

  it('rejects a cross-user optional account', async () => {
    const client = makeClient({
      property: { id: 'p-1', user_id: 'u-1' },
      account: null,
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await createObligation(makeObligationForm({ accountId: '550e8400-e29b-41d4-a716-446655440002' }))

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Account not found')
    expect(client.insertedValues).toBeUndefined()
  })

  it('rejects a cross-user optional party', async () => {
    const client = makeClient({
      property: { id: 'p-1', user_id: 'u-1' },
      party: null,
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await createObligation(makeObligationForm({ partyId: '550e8400-e29b-41d4-a716-446655440003' }))

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Party not found')
    expect(client.insertedValues).toBeUndefined()
  })

  it('rejects a cross-user optional recurring rule', async () => {
    const client = makeClient({
      property: { id: 'p-1', user_id: 'u-1' },
      recurringRule: null,
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await createObligation(
      makeObligationForm({ recurringRuleId: '550e8400-e29b-41d4-a716-446655440004' }),
    )

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Recurring rule not found')
    expect(client.insertedValues).toBeUndefined()
  })

  it('rejects invalid values for required fields', async () => {
    const result = await createObligation(
      makeObligationForm({ expectedAmount: 'abc', dueDate: 'not-a-date', propertyId: 'bad' }),
    )

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toBe('Validation failed')
    expect('errors' in result && (result as { errors: Record<string, string[]> }).errors).toBeDefined()
  })
})

describe('updateObligation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('updates an obligation with missing optional recurrence keys', async () => {
    const client = makeClient({
      property: { id: 'p-1', user_id: 'u-1' },
      existing: { id: 'o-1', property_id: 'p-1', user_id: 'u-1', paid_amount: 0, status: 'upcoming' },
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await updateObligation('o-1', makeObligationForm({ expectedAmount: '99.99' }))

    expect(result).toEqual({ success: true })
    const updated = (client.updatedValues ?? {}) as Record<string, unknown>
    expect(updated.expected_amount).toBe(99.99)
    expect(updated.recurring_rule_id).toBeNull()
    expect(updated.period_start).toBeNull()
    expect(updated.period_end).toBeNull()
  })

  it('rejects updating a cross-user obligation', async () => {
    const client = makeClient({ existing: null })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await updateObligation('o-1', makeObligationForm())

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toBe('Obligation not found')
  })
})
