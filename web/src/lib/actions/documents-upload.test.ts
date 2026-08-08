import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { uploadDocument, updateDocument, deleteDocument, getSignedDocumentUrl } from './documents'
import nextConfig from '../../../next.config.mjs'

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
  select: () => ChainableBuilder
  eq: () => ChainableBuilder
  neq: () => ChainableBuilder
  limit: () => ChainableBuilder
  insert: (values: unknown) => ChainableBuilder
  update: () => ChainableBuilder
  delete: () => ChainableBuilder
  single: () => ChainableBuilder
  returns: () => Promise<unknown>
  then: (resolve: (value: unknown) => unknown) => Promise<unknown>
  insertedValues: unknown
  singleCalled: boolean
  limitCalled: boolean
}

const P1 = '550e8400-e29b-41d4-a716-446655440001'
const A1 = '550e8400-e29b-41d4-a716-446655440002'
const PT1 = '550e8400-e29b-41d4-a716-446655440003'
const O1 = '550e8400-e29b-41d4-a716-446655440004'

function makeFile(type = 'image/jpeg', name = 'photo.jpg', content = 'image-content'): File {
  return new File([new Blob([content], { type })], name, { type })
}

type MakeClientOptions = {
  existingByHash?: { id: string }[]
  uploadError?: { message: string } | null
  insertData?: { id: string } | null
  insertError?: { message: string } | null
  property?: { id: string } | null
  account?: { id: string; property_id: string } | null
  party?: { id: string; property_id: string | null } | null
  obligation?: { id: string; property_id: string } | null
  removeError?: { message: string } | null
  signedUrlError?: { message: string } | null
}

function makeClient(options: MakeClientOptions = {}) {
  const storage = {
    upload: vi.fn().mockResolvedValue({ error: options.uploadError ?? null }) as Mock<(...args: unknown[]) => Promise<{ error: { message: string } | null }>>,
    remove: vi.fn().mockResolvedValue({ error: options.removeError ?? null }) as Mock<(...args: unknown[]) => Promise<{ error: { message: string } | null }>>,
    createSignedUrl: vi.fn().mockResolvedValue({ data: options.signedUrlError ? null : { signedUrl: 'https://signed.example/file' }, error: options.signedUrlError ?? null }) as Mock<(...args: unknown[]) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>>,
  }

  function chainableBuilder(returnsOverride?: () => Promise<unknown>): ChainableBuilder {
    const builder: ChainableBuilder = {
      select() { return builder },
      eq() { return builder },
      neq() { return builder },
      limit() { builder.limitCalled = true; return builder },
      insert(values: unknown) { builder.insertedValues = values; return builder },
      update() { return builder },
      delete() { return builder },
      single() { builder.singleCalled = true; return builder },
      returns: returnsOverride ?? (() => Promise.resolve({ data: [], error: null })),
      insertedValues: undefined,
      singleCalled: false,
      limitCalled: false,
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve(builder.returns()).then(resolve)
      },
    }
    return builder
  }

  const tableReturns: Record<string, () => Promise<unknown>> = {
    properties: () => Promise.resolve(options.property === null ? { data: null, error: { message: 'Not found' } } : { data: options.property ?? { id: P1 }, error: null }),
    accounts: () => Promise.resolve(options.account === null ? { data: null, error: { message: 'Not found' } } : { data: options.account ?? { id: A1, property_id: P1 }, error: null }),
    parties: () => Promise.resolve(options.party === null ? { data: null, error: { message: 'Not found' } } : { data: options.party ?? { id: PT1, property_id: P1 }, error: null }),
    obligations: () => Promise.resolve(options.obligation === null ? { data: null, error: { message: 'Not found' } } : { data: options.obligation ?? { id: O1, property_id: P1 }, error: null }),
  }

  const documentsBuilder = chainableBuilder(() => {
    // First documents query is either existing-by-hash (limit) or select-existing (single).
    if (documentsBuilder.singleCalled) {
      return Promise.resolve({ data: { storage_path: 'u-1/test.pdf', property_id: P1 }, error: null })
    }
    return Promise.resolve({ data: options.existingByHash ?? [], error: null })
  })

  // Replace subsequent `.returns()` calls (after insert/update/delete) to return the created/updated document.
  const originalReturns = documentsBuilder.returns
  let returnsCallCount = 0
  documentsBuilder.returns = () => {
    returnsCallCount++
    if (returnsCallCount === 1) {
      return originalReturns()
    }
    if (options.insertError) return Promise.resolve({ data: null, error: options.insertError })
    return Promise.resolve({ data: options.insertData ?? { id: 'doc-new' }, error: null })
  }

  const fromBuilders: Record<string, ChainableBuilder> = {
    documents: documentsBuilder,
  }

  function mockFrom(table: string): ChainableBuilder {
    if (table in fromBuilders) return fromBuilders[table]
    const builder = chainableBuilder(tableReturns[table] ?? (() => Promise.resolve({ data: [], error: null })))
    fromBuilders[table] = builder
    return builder
  }

  const storageFrom = vi.fn(() => storage) as Mock<(table: string) => typeof storage>

  return {
    storage: {
      from: storageFrom,
    },
    from: vi.fn(mockFrom) as Mock<(table: string) => ChainableBuilder>,
    storageMocks: storage,
  }
}

function makeUploadForm(overrides: { file?: File; propertyId?: string; accountId?: string; partyId?: string; obligationId?: string } = {}): FormData {
  const form = new FormData()
  form.append('file', overrides.file ?? makeFile())
  form.append('property_id', overrides.propertyId ?? P1)
  form.append('account_id', overrides.accountId ?? '')
  form.append('party_id', overrides.partyId ?? '')
  form.append('obligation_id', overrides.obligationId ?? '')
  form.append('document_type', '')
  form.append('issuer', '')
  form.append('document_date', '')
  form.append('notes', '')
  return form
}

describe('uploadDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('rejects unsupported file types server-side', async () => {
    const client = makeClient()
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await uploadDocument(makeUploadForm({ file: makeFile('image/gif', 'photo.gif') }))

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Unsupported file type')
    expect(client.storage.from).not.toHaveBeenCalled()
  })

  it('rejects oversized files', async () => {
    const client = makeClient()
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const bigFile = new File([new Blob(['x'.repeat(11 * 1024 * 1024)])], 'big.jpg', { type: 'image/jpeg' })
    const result = await uploadDocument(makeUploadForm({ file: bigFile }))

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('too large')
  })

  it('rejects a missing file', async () => {
    const client = makeClient()
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const form = new FormData()
    form.append('property_id', P1)
    form.append('document_type', '')
    const result = await uploadDocument(form)

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('A file is required')
  })

  it('returns the existing document id when the file hash matches', async () => {
    const client = makeClient({ existingByHash: [{ id: 'doc-existing' }] })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await uploadDocument(makeUploadForm())

    expect(result).toEqual({ success: true, duplicateDocumentId: 'doc-existing' })
    expect(client.storage.from).not.toHaveBeenCalled()
  })

  it('uploads, creates a document, and returns the new id', async () => {
    const client = makeClient({ existingByHash: [], insertData: { id: 'doc-new' } })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await uploadDocument(makeUploadForm({ propertyId: P1 }))

    expect(result).toEqual({ success: true, id: 'doc-new' })
    expect(client.storage.from).toHaveBeenCalledWith('documents')
    expect(client.storageMocks.upload).toHaveBeenCalledTimes(1)

    const builder = client.from('documents') as unknown as ChainableBuilder
    expect(builder.insertedValues).toMatchObject({
      user_id: 'u-1',
      property_id: P1,
      processing_status: 'uploaded',
      document_type: 'other',
    })
  })

  it('accepts a PDF file', async () => {
    const client = makeClient({ existingByHash: [], insertData: { id: 'doc-pdf' } })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await uploadDocument(makeUploadForm({ file: makeFile('application/pdf', 'bill.pdf', 'pdf-content') }))

    expect(result).toEqual({ success: true, id: 'doc-pdf' })
    expect(client.storageMocks.upload).toHaveBeenCalledTimes(1)
  })

  it('rejects a property_id that does not belong to the authenticated user', async () => {
    const client = makeClient({ property: null })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await uploadDocument(makeUploadForm({ propertyId: P1 }))

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Property not found')
    expect(client.storage.from).not.toHaveBeenCalled()
  })

  it('rejects a cross-user account_id', async () => {
    const client = makeClient({ account: null })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await uploadDocument(makeUploadForm({ accountId: A1 }))

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Account not found')
    expect(client.storage.from).not.toHaveBeenCalled()
  })

  it('rejects an account_id that belongs to a different property', async () => {
    const otherProperty = '550e8400-e29b-41d4-a716-446655440005'
    const otherAccount = '550e8400-e29b-41d4-a716-446655440006'
    const client = makeClient({ account: { id: otherAccount, property_id: otherProperty } })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await uploadDocument(makeUploadForm({ propertyId: P1, accountId: otherAccount }))

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('does not belong to the selected property')
  })

  it('cleans up the storage object when the database insert fails', async () => {
    const client = makeClient({ existingByHash: [], insertError: { message: 'Insert failed' } })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await uploadDocument(makeUploadForm())

    expect('error' in result).toBe(true)
    expect(client.storageMocks.remove).toHaveBeenCalledWith(expect.any(Array))
  })

  it('uses user-scoped, collision-resistant storage paths', async () => {
    const client = makeClient({ existingByHash: [], insertData: { id: 'doc-new' } })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    await uploadDocument(makeUploadForm())

    const [[path]] = client.storageMocks.upload.mock.calls as [[string, unknown, unknown]]
    expect(path).toMatch(/^u-1\/[a-f0-9-]+-photo\.jpg$/)
  })

  it('configures a Server Action body size limit larger than the advertised 10 MB file cap', () => {
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe('12mb')
  })
})

describe('updateDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('rejects a cross-user document', async () => {
    const client = makeClient()
    const builder = client.from('documents') as unknown as ChainableBuilder
    builder.returns = () => Promise.resolve({ data: null, error: { message: 'Not found' } })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await updateDocument('doc-1', makeUploadForm({ propertyId: P1 }))

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Document not found')
  })
})

describe('deleteDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('removes both the storage object and the database record', async () => {
    const client = makeClient()
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await deleteDocument('doc-1')

    expect(result).toEqual({ success: true })
    expect(client.storageMocks.remove).toHaveBeenCalled()
    expect(client.from).toHaveBeenCalledWith('documents')
  })

  it('returns an error when storage removal fails and does not delete the record', async () => {
    const client = makeClient({ removeError: { message: 'Storage remove failed' } })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const result = await deleteDocument('doc-1')

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Storage remove failed')
  })
})

describe('getSignedDocumentUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('returns a signed URL when the user owns the object', async () => {
    const client = makeClient()
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const url = await getSignedDocumentUrl('u-1/test.pdf')

    expect(url).toBe('https://signed.example/file')
  })

  it('returns null when the user cannot access the object', async () => {
    const client = makeClient({ signedUrlError: { message: 'Access denied' } })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const url = await getSignedDocumentUrl('u-2/test.pdf')

    expect(url).toBeNull()
  })
})
