'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/client'
import { documentSchema } from '@/lib/validations/document'
import { requireUser } from './helpers'
import { formatZodErrors, recalcObligation } from '@/lib/utils'
import { getDocumentIntelligenceProvider, parseExtraction, hashFileBuffer } from '@/lib/document-intelligence'
import { detectSemanticDuplicates } from '@/lib/document-intelligence/duplicates'
import type { Document, DocumentProcessingRun, DocumentExtraction, ObligationInsert, TaskInsert, DocumentProcessingRunInsert } from '@/lib/types'

type ActionResult =
  | { success: true; id?: string; duplicateDocumentId?: string }
  | { error: string; errors?: Record<string, string[]>; duplicateDocumentId?: string }

const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

function generateStoragePath(userId: string, filename: string) {
  const safeName = `${randomUUID()}-${filename.replace(/[^a-zA-Z0-9_.-]/g, '_')}`
  return `${userId}/${safeName}`
}

export async function getDocuments(): Promise<Document[]> {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .returns<Document[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getDocumentsForProperty(propertyId: string): Promise<Document[]> {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', user.id)
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .returns<Document[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getDocument(id: string): Promise<Document | null> {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
    .returns<Document>()

  if (error) return null
  return data
}

export async function getDocumentWithDetails(id: string) {
  const user = await requireUser()
  const supabase = await createClient()

  const [documentResult, runResult, propertiesResult, accountsResult, partiesResult] = await Promise.all([
    supabase.from('documents').select('*').eq('id', id).eq('user_id', user.id).single().returns<Document>(),
    supabase
      .from('document_processing_runs')
      .select('*')
      .eq('document_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .returns<DocumentProcessingRun[]>(),
    supabase.from('properties').select('id, nickname, street_address, city, state, zip').eq('user_id', user.id).order('nickname', { ascending: true }),
    supabase.from('accounts').select('id, property_id, account_type, account_number').eq('user_id', user.id),
    supabase.from('parties').select('id, property_id, name, party_type').eq('user_id', user.id),
  ])

  if (documentResult.error || !documentResult.data) return null

  const run = runResult.data?.[0] ?? null
  const extraction: DocumentExtraction = run?.normalized_extraction ?? parseExtraction(null)

  const duplicateCandidates = await findDuplicateCandidates(supabase, user.id, id, extraction)

  return {
    document: documentResult.data,
    run,
    extraction,
    properties: propertiesResult.data ?? [],
    accounts: accountsResult.data ?? [],
    parties: partiesResult.data ?? [],
    duplicates: duplicateCandidates,
  }
}

async function findDuplicateCandidates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  documentId: string,
  extraction: DocumentExtraction
) {
  const { data, error } = await supabase
    .from('documents')
    .select('id, original_filename, user_id, property_id, account_id, issuer, document_date, account_number:raw_ai_extraction->account_number->>value, amount_due:raw_ai_extraction->amount_due->>value, due_date:raw_ai_extraction->due_date->>value, invoice_number:raw_ai_extraction->invoice_number->>value')
    .eq('user_id', userId)
    .neq('id', documentId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error || !data) return []

  const typed = data.map((d) => ({
    ...d,
    account_number: d.account_number ? String(d.account_number) : null,
    amount_due: d.amount_due ? Number(d.amount_due) : null,
    due_date: d.due_date ? String(d.due_date) : null,
    invoice_number: d.invoice_number ? String(d.invoice_number) : null,
  })) as Parameters<typeof detectSemanticDuplicates>[1]

  return detectSemanticDuplicates(extraction, typed)
}

export async function createDocument(formData: FormData): Promise<ActionResult> {
  const parsed = documentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const user = await requireUser()
  const supabase = await createClient()

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) {
    return { error: 'A file is required' }
  }

  const mimeType = file.type || 'application/octet-stream'
  if (!ACCEPTED_MIME_TYPES.includes(mimeType.toLowerCase())) {
    return { error: 'Unsupported file type. Use JPEG, PNG, WebP, or PDF.' }
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: 'File too large. Maximum size is 10 MB.' }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const fileHash = hashFileBuffer(buffer)

  // Exact duplicate detection
  const { data: existingByHash } = await supabase
    .from('documents')
    .select('id, original_filename')
    .eq('user_id', user.id)
    .eq('file_hash', fileHash)
    .limit(1)

  if (existingByHash && existingByHash.length > 0) {
    return { success: true, duplicateDocumentId: existingByHash[0].id }
  }

  const storagePath = generateStoragePath(user.id, file.name)

  const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, file, {
    contentType: mimeType,
    upsert: false,
  })

  if (uploadError) return { error: uploadError.message }

  const { data, error } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      property_id: parsed.data.property_id,
      storage_path: storagePath,
      original_filename: file.name,
      file_hash: fileHash,
      file_size: file.size,
      mime_type: mimeType,
      document_type: parsed.data.document_type,
      issuer: parsed.data.issuer,
      document_date: parsed.data.document_date,
      processing_status: 'uploaded',
      review_status: 'unreviewed',
    })
    .select()
    .single()
    .returns<Document>()

  if (error || !data) return { error: error?.message ?? 'Failed to create document' }

  revalidatePath('/documents')
  revalidatePath('/inbox')
  revalidatePath('/dashboard')
  if (parsed.data.property_id) revalidatePath(`/properties/${parsed.data.property_id}`)

  // Begin synchronous processing immediately after upload.
  await processDocument(data.id)

  return { success: true, id: data.id }
}

export async function processDocument(documentId: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: document } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single()
    .returns<Document>()

  if (!document) return { error: 'Document not found' }

  // Persist processing state before calling the provider so failures are recoverable.
  await supabase
    .from('documents')
    .update({ processing_status: 'processing', processing_error: null })
    .eq('id', documentId)
    .eq('user_id', user.id)

  const { data: fileData, error: downloadError } = await supabase.storage.from('documents').download(document.storage_path)
  if (downloadError) {
    await markFailed(documentId, supabase, user.id, `Could not retrieve file: ${downloadError.message}`)
    return { error: 'Could not retrieve uploaded file for processing' }
  }

  const buffer = Buffer.from(await fileData.arrayBuffer())

  const [properties, accounts, parties] = await Promise.all([
    supabase.from('properties').select('id, nickname, street_address, city, state, zip').eq('user_id', user.id),
    supabase.from('accounts').select('id, property_id, account_type, account_number').eq('user_id', user.id),
    supabase.from('parties').select('id, property_id, name, party_type').eq('user_id', user.id),
  ])

  const providerName = process.env.DOCUMENT_AI_PROVIDER ?? 'openai'
  const provider = getDocumentIntelligenceProvider(providerName)

  const runInsert: DocumentProcessingRunInsert = {
    user_id: user.id,
    document_id: documentId,
    provider: provider.name,
    model: process.env.DOCUMENT_AI_MODEL ?? 'unknown',
    status: 'running',
  }

  const { data: run } = await supabase.from('document_processing_runs').insert(runInsert).select('id').single()

  try {
    const result = await provider.analyzeDocument({
      fileBuffer: buffer,
      mimeType: document.mime_type || 'application/octet-stream',
      filename: document.original_filename,
      userProperties: properties.data ?? [],
      userAccounts: accounts.data ?? [],
      userParties: parties.data ?? [],
    })

    await supabase
      .from('document_processing_runs')
      .update({
        completed_at: new Date().toISOString(),
        status: 'completed',
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        duration_ms: result.durationMs,
        normalized_extraction: result.extraction,
        raw_output: result.rawOutput,
      })
      .eq('id', run?.id ?? '')
      .eq('user_id', user.id)

    await supabase
      .from('documents')
      .update({
        processing_status: 'processed',
        review_status: 'needs_review',
        document_type: result.extraction.document_type ?? document.document_type,
        issuer: result.extraction.issuer.value ?? document.issuer,
        document_date: result.extraction.document_date.value ?? document.document_date,
        property_id: result.match.property_id ?? document.property_id,
        account_id: result.match.account_id ?? document.account_id,
        party_id: result.match.party_id ?? document.party_id,
        raw_ai_extraction: JSON.stringify(result.extraction),
        processing_error: null,
      })
      .eq('id', documentId)
      .eq('user_id', user.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown processing error'
    await markFailed(documentId, supabase, user.id, message, run?.id)
    return { error: message }
  }

  revalidatePath('/documents')
  revalidatePath('/inbox')
  revalidatePath('/dashboard')
  revalidatePath(`/documents/${documentId}`)
  return { success: true }
}

async function markFailed(
  documentId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  message: string,
  runId?: string | null
) {
  await supabase
    .from('documents')
    .update({ processing_status: 'failed', processing_error: message })
    .eq('id', documentId)
    .eq('user_id', userId)

  if (runId) {
    await supabase
      .from('document_processing_runs')
      .update({ completed_at: new Date().toISOString(), status: 'failed', error_message: message })
      .eq('id', runId)
      .eq('user_id', userId)
  }
}

export async function retryProcessDocument(documentId: string): Promise<ActionResult> {
  return processDocument(documentId)
}

function fieldValue(formData: FormData, name: string): string | null {
  const value = formData.get(name)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export async function confirmDocument(documentId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: document } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single()
    .returns<Document>()

  if (!document) return { error: 'Document not found' }

  const propertyId = fieldValue(formData, 'property_id')
  if (!propertyId) return { error: 'A property is required to confirm' }

  const accountId = fieldValue(formData, 'account_id')
  const partyId = fieldValue(formData, 'party_id')
  const documentType = fieldValue(formData, 'document_type')
  const issuer = fieldValue(formData, 'issuer')
  const documentDate = fieldValue(formData, 'document_date')
  const dueDate = fieldValue(formData, 'due_date')
  const periodStart = fieldValue(formData, 'period_start')
  const periodEnd = fieldValue(formData, 'period_end')
  const amountRaw = fieldValue(formData, 'amount')
  const amount = amountRaw ? Number(amountRaw) : null
  const direction = (fieldValue(formData, 'direction') as 'payable' | 'receivable') ?? 'payable'
  const category = fieldValue(formData, 'category') ?? 'other'
  const description = fieldValue(formData, 'description')
  const requiredAction = fieldValue(formData, 'required_action')
  const actionDueDate = fieldValue(formData, 'action_due_date')
  const taskTitle = fieldValue(formData, 'task_title')

  // Save corrections to the document itself before creating downstream records.
  await supabase
    .from('documents')
    .update({
      property_id: propertyId,
      account_id: accountId,
      party_id: partyId,
      document_type: documentType,
      issuer,
      document_date: documentDate,
    })
    .eq('id', documentId)
    .eq('user_id', user.id)

  const shouldCreateObligation = amount !== null && amount > 0 && dueDate
  const shouldCreateTask = !!requiredAction || !!taskTitle

  let obligationId = document.confirmed_obligation_id
  let taskId = document.confirmed_task_id

  if (shouldCreateObligation) {
    const status = recalcObligation(0, amount, dueDate, 'upcoming')
    const obligationBase = {
      property_id: propertyId,
      account_id: accountId,
      party_id: partyId,
      source_document_id: documentId,
      direction,
      category,
      description: description ?? `${document.original_filename} — ${category}`,
      expected_amount: amount,
      paid_amount: 0,
      due_date: dueDate,
      status,
      paid_date: null as string | null,
      period_start: periodStart,
      period_end: periodEnd,
      notes: null as string | null,
    }

    if (obligationId) {
      await supabase.from('obligations').update(obligationBase).eq('id', obligationId).eq('user_id', user.id)
    } else {
      const obligationInsert = { ...obligationBase, user_id: user.id } as ObligationInsert
      const { data: created } = await supabase.from('obligations').insert(obligationInsert).select('id').single()
      if (created) obligationId = created.id
    }
  }

  if (shouldCreateTask) {
    const taskBase = {
      property_id: propertyId,
      party_id: partyId,
      source_document_id: documentId,
      title: taskTitle ?? requiredAction ?? 'Task',
      description: requiredAction ?? null,
      due_date: actionDueDate,
      status: 'open',
      priority: 'normal',
    }

    if (taskId) {
      await supabase.from('tasks').update(taskBase).eq('id', taskId).eq('user_id', user.id)
    } else {
      const taskInsert = { ...taskBase, user_id: user.id } as TaskInsert
      const { data: created } = await supabase.from('tasks').insert(taskInsert).select('id').single()
      if (created) taskId = created.id
    }
  }

  await supabase
    .from('documents')
    .update({
      review_status: 'confirmed',
      confirmed_obligation_id: obligationId,
      confirmed_task_id: taskId,
    })
    .eq('id', documentId)
    .eq('user_id', user.id)

  revalidatePath('/documents')
  revalidatePath('/inbox')
  revalidatePath('/dashboard')
  revalidatePath(`/documents/${documentId}`)
  revalidatePath(`/properties/${propertyId}`)
  revalidatePath('/obligations')

  return { success: true }
}

export async function archiveDocument(id: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('documents')
    .select('property_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase
    .from('documents')
    .update({ review_status: 'archived' })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/documents')
  revalidatePath('/inbox')
  revalidatePath('/dashboard')
  if (existing?.property_id) revalidatePath(`/properties/${existing.property_id}`)
  return { success: true }
}

export async function updateDocumentReviewStatus(id: string, reviewStatus: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('documents')
    .update({ review_status: reviewStatus })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/documents')
  revalidatePath('/inbox')
  revalidatePath(`/documents/${id}`)
  return { success: true }
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('documents')
    .select('storage_path,property_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (existing?.storage_path) {
    await supabase.storage.from('documents').remove([existing.storage_path])
  }

  const { error } = await supabase.from('documents').delete().eq('id', id).eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/documents')
  revalidatePath('/inbox')
  revalidatePath('/dashboard')
  if (existing?.property_id) revalidatePath(`/properties/${existing.property_id}`)
  return { success: true }
}

export async function getSignedDocumentUrl(storagePath: string, expiresSeconds = 3600): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(storagePath, expiresSeconds)
  if (error) return null
  return data?.signedUrl ?? null
}
