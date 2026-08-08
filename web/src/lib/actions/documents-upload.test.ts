import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { uploadDocument } from './documents'

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

function makeFile(type = 'image/jpeg', name = 'photo.jpg', content = 'image-content'): File {
  return new File([new Blob([content], { type })], name, { type })
}

type ChainableBuilder = {
  select: () => ChainableBuilder
  eq: () => ChainableBuilder
  limit: () => ChainableBuilder
  insert: (values: unknown) => ChainableBuilder
  single: () => ChainableBuilder
  returns: () => Promise<unknown>
  then: (resolve: (value: unknown) => unknown) => Promise<unknown>
  insertedValues: unknown
}

function makeClient(options: {
  existingByHash?: { id: string }[]
  uploadError?: { message: string } | null
  insertData?: { id: string } | null
  insertError?: { message: string } | null
} = {}) {
  const storageUpload = vi.fn().mockResolvedValue({ error: options.uploadError ?? null }) as Mock<(...args: unknown[]) => Promise<{ error: { message: string } | null }>>

  function chainableBuilder(returnsOverride?: () => Promise<unknown>): ChainableBuilder {
    const builder: ChainableBuilder = {
      select() { return builder },
      eq() { return builder },
      limit() { return builder },
      insert(values: unknown) { builder.insertedValues = values; return builder },
      single() { return builder },
      returns: returnsOverride ?? (() => Promise.resolve({ data: [], error: null })),
      insertedValues: undefined,
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve(builder.returns()).then(resolve)
      },
    }
    return builder
  }

  const documentsBuilder = chainableBuilder(() => Promise.resolve({ data: options.existingByHash ?? [], error: null }))

  // Replace the second `.returns()` call (after insert) to return the created document.
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

  const storageFrom = vi.fn(() => ({ upload: storageUpload })) as Mock<(table: string) => { upload: typeof storageUpload }>

  return {
    storage: {
      from: storageFrom,
    },
    from: vi.fn((table: string) => fromBuilders[table] ?? chainableBuilder()) as Mock<(table: string) => ChainableBuilder>,
  }
}

describe('uploadDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-1' })
  })

  it('rejects unsupported file types server-side', async () => {
    const client = makeClient()
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const form = new FormData()
    form.append('file', makeFile('image/gif', 'photo.gif'))
    form.append('property_id', '')
    form.append('document_type', '')
    form.append('issuer', '')
    form.append('document_date', '')

    const result = await uploadDocument(form)

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('Unsupported file type')
    expect(client.storage.from).not.toHaveBeenCalled()
  })

  it('rejects oversized files', async () => {
    const client = makeClient()
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const form = new FormData()
    const bigFile = new File([new Blob(['x'.repeat(11 * 1024 * 1024)])], 'big.jpg', { type: 'image/jpeg' })
    form.append('file', bigFile)
    form.append('property_id', '')
    form.append('document_type', '')
    form.append('issuer', '')
    form.append('document_date', '')

    const result = await uploadDocument(form)

    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toContain('too large')
  })

  it('returns the existing document id when the file hash matches', async () => {
    const client = makeClient({ existingByHash: [{ id: 'doc-existing' }] })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const form = new FormData()
    form.append('file', makeFile('image/jpeg', 'photo.jpg', 'same-content'))
    form.append('property_id', '')
    form.append('document_type', '')
    form.append('issuer', '')
    form.append('document_date', '')

    const result = await uploadDocument(form)

    expect(result).toEqual({ success: true, duplicateDocumentId: 'doc-existing' })
    expect(client.storage.from).not.toHaveBeenCalled()
  })

  it('uploads, creates a document, and returns the new id', async () => {
    const client = makeClient({ existingByHash: [], insertData: { id: 'doc-new' } })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const form = new FormData()
    form.append('file', makeFile('image/jpeg', 'photo.jpg', 'new-content'))
    form.append('property_id', '123e4567-e89b-12d3-a456-426614174000')
    form.append('document_type', '')
    form.append('issuer', '')
    form.append('document_date', '')

    const result = await uploadDocument(form)

    expect(result).toEqual({ success: true, id: 'doc-new' })
    expect(client.storage.from).toHaveBeenCalledWith('documents')
    expect(client.storage.from('documents').upload).toHaveBeenCalledTimes(1)

    const builder = client.from('documents') as unknown as ChainableBuilder
    expect(builder.insertedValues).toMatchObject({
      user_id: 'u-1',
      property_id: '123e4567-e89b-12d3-a456-426614174000',
      processing_status: 'uploaded',
    })
  })

  it('accepts a PDF file', async () => {
    const client = makeClient({ existingByHash: [], insertData: { id: 'doc-pdf' } })
    ;(createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(client)

    const form = new FormData()
    form.append('file', makeFile('application/pdf', 'bill.pdf', 'pdf-content'))
    form.append('property_id', '')
    form.append('document_type', '')
    form.append('issuer', '')
    form.append('document_date', '')

    const result = await uploadDocument(form)

    expect(result).toEqual({ success: true, id: 'doc-pdf' })
    expect(client.storage.from('documents').upload).toHaveBeenCalledTimes(1)
  })
})
