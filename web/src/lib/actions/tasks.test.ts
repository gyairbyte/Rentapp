import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { createTask, updateTask, deleteTask, getTasks, transitionTask } from './tasks'

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

const PROPERTY_ID = '550e8400-e29b-41d4-a716-446655440001'
const OTHER_PROPERTY_ID = '550e8400-e29b-41d4-a716-446655440002'
const PARTY_ID = '550e8400-e29b-41d4-a716-446655440003'

type BuilderOptions = {
  listReturn?: { data: unknown[]; error: null }
  singleReturn?: { data: unknown | null; error: { message: string } | null }
}

function makeSingleBuilder(singleReturn: BuilderOptions['singleReturn'], parent: ReturnType<typeof chainableBuilder>) {
  return {
    select() { return this as never },
    eq() { return this as never },
    order() { return this as never },
    insert() { return this as never },
    update() { return this as never },
    delete() { return this as never },
    single() { return this as never },
    returns<T>() {
      return Promise.resolve((singleReturn ?? { data: null, error: { message: 'not found' } }) as T)
    },
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve((this as never as { returns: () => Promise<unknown> }).returns()).then(resolve)
    },
    get insertedValues() { return parent.insertedValues },
    get updatedValues() { return parent.updatedValues },
  } as ReturnType<typeof chainableBuilder>
}

function chainableBuilder({ listReturn, singleReturn }: BuilderOptions) {
  let capturedInsert: unknown
  let capturedUpdate: unknown
  let isSingle = false

  const builder: {
    select: () => typeof builder
    eq: () => typeof builder
    order: () => typeof builder
    insert: (values: unknown) => typeof builder
    update: (values: unknown) => typeof builder
    delete: () => typeof builder
    single: () => typeof builder
    returns: <T>() => Promise<T>
    then: (resolve: (value: unknown) => unknown) => Promise<unknown>
    insertedValues: unknown
    updatedValues: unknown
  } = {
    select() { return builder },
    eq() { return builder },
    order() { return builder },
    insert(values: unknown) {
      capturedInsert = values
      return builder
    },
    update(values: unknown) {
      capturedUpdate = values
      return builder
    },
    delete() { return builder },
    single() {
      isSingle = true
      return makeSingleBuilder(singleReturn, builder)
    },
    returns() {
      if (isSingle) {
        const result = singleReturn ?? { data: null, error: { message: 'not found' } }
        return Promise.resolve(result as never)
      }
      const result = listReturn ?? { data: [], error: null }
      return Promise.resolve(result as never)
    },
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve(builder.returns()).then(resolve)
    },
    get insertedValues() {
      return capturedInsert
    },
    get updatedValues() {
      return capturedUpdate
    },
  }

  return builder
}

function makeClient(options: {
  tasks?: unknown[]
  task?: { id: string; property_id: string | null; user_id: string; source_document_id?: string | null; completed_at?: string | null } | null
  property?: { id: string; user_id: string } | null
  party?: { id: string; user_id: string; property_id: string | null } | null
} = {}) {
  const taskSingle = {
    data: options.task ?? null,
    error: options.task ? null : { message: 'not found' },
  }

  const tasksList = { data: options.tasks ?? [], error: null }

  const propertySingle = {
    data: options.property ?? null,
    error: options.property ? null : { message: 'not found' },
  }

  const partySingle = {
    data: options.party ?? null,
    error: options.party ? null : { message: 'not found' },
  }

  const builders: Record<string, ReturnType<typeof chainableBuilder>> = {
    tasks: chainableBuilder({ listReturn: tasksList, singleReturn: taskSingle }),
    properties: chainableBuilder({ singleReturn: propertySingle }),
    parties: chainableBuilder({ singleReturn: partySingle }),
  }

  return {
    from: vi.fn((table: string) => builders[table] ?? chainableBuilder({})) as Mock<(table: string) => unknown>,
  }
}

function makeTaskForm(overrides: {
  title?: string
  propertyId?: string
  partyId?: string
  description?: string
  dueDate?: string
  priority?: string
  status?: string
} = {}): FormData {
  const form = new FormData()
  form.append('title', overrides.title ?? 'Fix window')
  form.append('property_id', overrides.propertyId ?? '')
  form.append('party_id', overrides.partyId ?? '')
  form.append('description', overrides.description ?? '')
  form.append('due_date', overrides.dueDate ?? '')
  form.append('priority', overrides.priority ?? 'normal')
  form.append('status', overrides.status ?? 'open')
  return form
}

describe('createTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('creates a task when property and global party belong to the user', async () => {
    const client = makeClient({
      property: { id: PROPERTY_ID, user_id: 'u-1' },
      party: { id: PARTY_ID, user_id: 'u-1', property_id: null },
      task: { id: 't-1', property_id: PROPERTY_ID, user_id: 'u-1' },
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await createTask(makeTaskForm({ propertyId: PROPERTY_ID, partyId: PARTY_ID }))

    expect(result).toEqual({ success: true, id: 't-1' })
    const inserted = ((client.from('tasks') as ReturnType<typeof chainableBuilder>).insertedValues ?? {}) as Record<string, unknown>
    expect(inserted.title).toBe('Fix window')
    expect(inserted.property_id).toBe(PROPERTY_ID)
    expect(inserted.party_id).toBe(PARTY_ID)
    expect(inserted.status).toBe('open')
    expect(inserted.priority).toBe('normal')
    expect(inserted.source_document_id).toBeNull()
  })

  it('rejects a task for a property the user does not own', async () => {
    const client = makeClient({ property: null })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await createTask(makeTaskForm({ propertyId: PROPERTY_ID }))

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Property not found')
  })

  it('rejects a party assigned to a different property', async () => {
    const client = makeClient({
      property: { id: PROPERTY_ID, user_id: 'u-1' },
      party: { id: PARTY_ID, user_id: 'u-1', property_id: OTHER_PROPERTY_ID },
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await createTask(makeTaskForm({ propertyId: PROPERTY_ID, partyId: PARTY_ID }))

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Party does not belong')
  })

  it('sets completed_at when creating a completed task', async () => {
    const client = makeClient({
      property: { id: PROPERTY_ID, user_id: 'u-1' },
      task: { id: 't-1', property_id: PROPERTY_ID, user_id: 'u-1' },
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await createTask(makeTaskForm({ status: 'completed' }))

    expect('success' in result).toBe(true)
    const inserted = ((client.from('tasks') as ReturnType<typeof chainableBuilder>).insertedValues ?? {}) as Record<string, unknown>
    expect(inserted.status).toBe('completed')
    expect(inserted.completed_at).toBeTruthy()
  })
})

describe('updateTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('updates a task and preserves source_document_id', async () => {
    const client = makeClient({
      task: { id: 't-1', property_id: PROPERTY_ID, user_id: 'u-1', source_document_id: 'd-1' },
      property: { id: PROPERTY_ID, user_id: 'u-1' },
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await updateTask('t-1', makeTaskForm({ title: 'Updated', status: 'completed' }))

    expect(result).toEqual({ success: true, id: 't-1' })
    const updated = ((client.from('tasks') as ReturnType<typeof chainableBuilder>).updatedValues ?? {}) as Record<string, unknown>
    expect(updated.title).toBe('Updated')
    expect(updated.status).toBe('completed')
    expect(updated.completed_at).toBeTruthy()
  })

  it('rejects updating a cross-user task', async () => {
    const client = makeClient({ task: null })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await updateTask('t-1', makeTaskForm())

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Task not found')
  })

  it('clears completed_at when reopening a completed task', async () => {
    const client = makeClient({
      task: { id: 't-1', property_id: PROPERTY_ID, user_id: 'u-1', completed_at: '2026-08-01T00:00:00Z' },
      property: { id: PROPERTY_ID, user_id: 'u-1' },
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    await updateTask('t-1', makeTaskForm({ status: 'open' }))

    const updated = ((client.from('tasks') as ReturnType<typeof chainableBuilder>).updatedValues ?? {}) as Record<string, unknown>
    expect(updated.status).toBe('open')
    expect(updated.completed_at).toBeNull()
  })
})

describe('transitionTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('marks a task in_progress and then completed', async () => {
    const client = makeClient({
      task: { id: 't-1', property_id: PROPERTY_ID, user_id: 'u-1' },
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const start = await transitionTask('t-1', 'in_progress')
    expect(start).toEqual({ success: true })

    const completed = await transitionTask('t-1', 'completed')
    expect(completed).toEqual({ success: true })
  })

  it('rejects an invalid status transition', async () => {
    const result = await transitionTask('t-1', 'invalid')
    expect('error' in result).toBe(true)
  })
})

describe('getTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('excludes completed and canceled tasks by default active filter', async () => {
    const client = makeClient({
      tasks: [
        { id: 't-1', status: 'open', priority: 'normal', title: 'Active', due_date: null, created_at: '2026-08-01T00:00:00Z' },
        { id: 't-2', status: 'completed', priority: 'normal', title: 'Done', due_date: null, created_at: '2026-08-01T00:00:00Z' },
        { id: 't-3', status: 'canceled', priority: 'normal', title: 'Canceled', due_date: null, created_at: '2026-08-01T00:00:00Z' },
      ],
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await getTasks({ statusFilter: 'active', today: '2026-08-07' })

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('t-1')
  })

  it('orders overdue, urgent, and unscheduled tasks for the dashboard', async () => {
    const client = makeClient({
      tasks: [
        { id: 'later', status: 'open', priority: 'normal', title: 'Later', due_date: '2026-08-30', created_at: '2026-08-01T00:00:00Z' },
        { id: 'unscheduled', status: 'open', priority: 'normal', title: 'No date', due_date: null, created_at: '2026-08-01T00:00:00Z' },
        { id: 'overdue', status: 'open', priority: 'normal', title: 'Overdue', due_date: '2026-08-01', created_at: '2026-08-01T00:00:00Z' },
        { id: 'urgent', status: 'open', priority: 'urgent', title: 'Urgent later', due_date: '2026-08-30', created_at: '2026-08-01T00:00:00Z' },
      ],
    })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await getTasks({ statusFilter: 'active', today: '2026-08-07' })

    expect(result.map((t) => t.id)).toEqual(['overdue', 'urgent', 'later', 'unscheduled'])
  })
})

describe('deleteTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('deletes a task that belongs to the user', async () => {
    const client = makeClient({ task: { id: 't-1', property_id: PROPERTY_ID, user_id: 'u-1' } })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await deleteTask('t-1')

    expect(result).toEqual({ success: true })
  })

  it('rejects deleting a cross-user task', async () => {
    const client = makeClient({ task: null })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await deleteTask('t-1')

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Task not found')
  })
})
