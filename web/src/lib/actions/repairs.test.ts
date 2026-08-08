import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { createRepair, updateRepair, deleteRepair, getRepairs } from './repairs'

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

type ChainableBuilder = {
  select: (columns?: string) => ChainableBuilder
  eq: () => ChainableBuilder
  not: () => ChainableBuilder
  insert: (values: unknown) => ChainableBuilder
  update: (values: unknown) => ChainableBuilder
  delete: () => ChainableBuilder
  single: () => ChainableBuilder
  order: () => ChainableBuilder
  returns: <T>() => Promise<T>
  then: (resolve: (value: unknown) => unknown) => Promise<unknown>
  insertedValues: unknown
  updatedValues: unknown
}

function chainableBuilder(returnValue: unknown): ChainableBuilder {
  let isSingle = false
  const builder: ChainableBuilder = {
    select() { return builder },
    eq() { return builder },
    not() { return builder },
    insert(values: unknown) { builder.insertedValues = values; return builder },
    update(values: unknown) { builder.updatedValues = values; return builder },
    delete() { return builder },
    single() { isSingle = true; return builder },
    order() { return builder },
    returns() { return Promise.resolve(isSingle ? (typeof returnValue === 'function' ? (returnValue as () => unknown)() : returnValue) : returnValue) as Promise<never> },
    insertedValues: undefined,
    updatedValues: undefined,
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve(builder.returns()).then(resolve)
    },
  }
  return builder
}

function makeClient(options: {
  property?: { id: string; user_id: string } | null
  party?: { id: string; user_id: string } | null
  repair?: { id: string; property_id: string; user_id: string } | null
  repairs?: unknown[]
  insertError?: { message: string } | null
  updateError?: { message: string } | null
} = {}) {
  const repairsListReturn = { data: options.repairs ?? [], error: null }
  const repairsSingleReturn = { data: options.repair, error: options.repair ? null : { message: 'not found' } }

  const repairsBuilder = chainableBuilder(repairsListReturn)
  // Override single() to return the single-object result.
  const originalSingle = repairsBuilder.single.bind(repairsBuilder)
  repairsBuilder.single = () => {
    originalSingle()
    const singleBuilder = chainableBuilder(repairsSingleReturn)
    singleBuilder.insert = repairsBuilder.insert.bind(repairsBuilder)
    singleBuilder.update = repairsBuilder.update.bind(repairsBuilder)
    singleBuilder.delete = repairsBuilder.delete.bind(repairsBuilder)
    singleBuilder.insertedValues = repairsBuilder.insertedValues
    singleBuilder.updatedValues = repairsBuilder.updatedValues
    return singleBuilder
  }

  const propertiesBuilder = chainableBuilder({
    data: options.property,
    error: options.property ? null : { message: 'not found' },
  })

  const partiesBuilder = chainableBuilder({
    data: options.party,
    error: options.party ? null : { message: 'not found' },
  })

  const fromBuilders: Record<string, ChainableBuilder> = {
    repairs: repairsBuilder,
    properties: propertiesBuilder,
    parties: partiesBuilder,
  }

  const client = {
    from: vi.fn((table: string) => {
      const builder = fromBuilders[table] ?? chainableBuilder({ data: [], error: null })
      return builder
    }) as Mock<(table: string) => ChainableBuilder>,
  }

  return client
}

function makeRepairForm(overrides: {
  propertyId?: string
  partyId?: string
  title?: string
  status?: string
  priority?: string
  reportedDate?: string
  scheduledDate?: string
  completedDate?: string
} = {}): FormData {
  const form = new FormData()
  form.append('property_id', overrides.propertyId ?? '550e8400-e29b-41d4-a716-446655440001')
  form.append('party_id', overrides.partyId ?? '')
  form.append('title', overrides.title ?? 'Leaky faucet')
  form.append('description', 'Kitchen sink is dripping')
  form.append('priority', overrides.priority ?? 'normal')
  form.append('status', overrides.status ?? 'reported')
  form.append('reported_date', overrides.reportedDate ?? '2026-08-07')
  form.append('scheduled_date', overrides.scheduledDate ?? '')
  form.append('completed_date', overrides.completedDate ?? '')
  return form
}

describe('createRepair', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('creates a repair when property and party belong to the user', async () => {
    const client = makeClient({
      property: { id: 'p-1', user_id: 'u-1' },
      party: { id: 'party-1', user_id: 'u-1' },
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await createRepair(makeRepairForm({ partyId: '550e8400-e29b-41d4-a716-446655440003' }))

    expect(result).toEqual({ success: true })
    const inserted = (client.from('repairs').insertedValues ?? {}) as Record<string, unknown>
    expect(inserted.title).toBe('Leaky faucet')
    expect(inserted.property_id).toBe('550e8400-e29b-41d4-a716-446655440001')
    expect(inserted.party_id).toBe('550e8400-e29b-41d4-a716-446655440003')
    expect(inserted.status).toBe('reported')
    expect(inserted.user_id).toBe('u-1')
  })

  it('rejects a repair for a property that does not belong to the user', async () => {
    const client = makeClient({ property: null })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await createRepair(makeRepairForm())

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Property not found')
  })

  it('rejects a repair with a vendor that does not belong to the user', async () => {
    const client = makeClient({
      property: { id: 'p-1', user_id: 'u-1' },
      party: null,
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await createRepair(makeRepairForm({ partyId: '550e8400-e29b-41d4-a716-446655440003' }))

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Vendor / party not found')
  })

  it('rejects an invalid status value', async () => {
    const result = await createRepair(makeRepairForm({ status: 'invalid' }))

    expect('error' in result).toBe(true)
  })

  it('rejects an invalid priority value', async () => {
    const result = await createRepair(makeRepairForm({ priority: 'critical' }))

    expect('error' in result).toBe(true)
  })

  it('rejects a missing title', async () => {
    const result = await createRepair(makeRepairForm({ title: '' }))

    expect('error' in result).toBe(true)
  })
})

describe('updateRepair', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('updates status from reported to scheduled', async () => {
    const client = makeClient({
      property: { id: 'p-1', user_id: 'u-1' },
      repair: { id: 'r-1', property_id: 'p-1', user_id: 'u-1' },
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const form = makeRepairForm({ status: 'scheduled', reportedDate: '2026-08-01', scheduledDate: '2026-08-10' })
    const result = await updateRepair('r-1', form)

    expect(result).toEqual({ success: true })
    const updated = (client.from('repairs').updatedValues ?? {}) as Record<string, unknown>
    expect(updated.status).toBe('scheduled')
    expect(updated.scheduled_date).toBe('2026-08-10')
  })

  it('rejects updating a cross-user repair', async () => {
    const client = makeClient({
      property: { id: 'p-1', user_id: 'u-1' },
      repair: null,
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await updateRepair('r-1', makeRepairForm())

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Repair not found')
  })

  it('rejects an update to a property the user does not own', async () => {
    const client = makeClient({
      property: null,
      repair: { id: 'r-1', property_id: 'p-1', user_id: 'u-1' },
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await updateRepair('r-1', makeRepairForm({ propertyId: '550e8400-e29b-41d4-a716-446655440002' }))

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Property not found')
  })
})

describe('deleteRepair', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('deletes a repair that belongs to the user', async () => {
    const client = makeClient({
      repair: { id: 'r-1', property_id: 'p-1', user_id: 'u-1' },
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await deleteRepair('r-1')

    expect(result).toEqual({ success: true })
  })

  it('rejects deleting a cross-user repair', async () => {
    const client = makeClient({ repair: null })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await deleteRepair('r-1')

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Repair not found')
  })
})

describe('getRepairs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('returns repairs for the current user', async () => {
    const client = makeClient({
      repairs: [
        { id: 'r-1', status: 'reported', priority: 'urgent', title: 'Roof leak' },
        { id: 'r-2', status: 'closed', priority: 'low', title: 'Old issue' },
      ],
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await getRepairs()

    expect(result).toHaveLength(2)
  })
})
