'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/client'
import { documentSchema } from '@/lib/validations/document'
import { requireUser } from './helpers'
import { formatZodErrors } from '@/lib/utils'
import { getDocumentIntelligenceProvider, parseExtractionOrEmpty, parseExtraction, hashFileBuffer } from '@/lib/document-intelligence'
import { findDocumentMatch } from '@/lib/document-intelligence/matching'
import { detectSemanticDuplicates } from '@/lib/document-intelligence/duplicates'
import type { Document, DocumentUpdate, DocumentProcessingRun, DocumentExtraction, DocumentProcessingRunInsert } from '@/lib/types'

type ActionResult =
  | { success: true; id?: string; duplicateDocumentId?: string }
  | { error: string; errors?: Record<string, string[]>; duplicateDocumentId?: string }

const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

function generateStoragePath(userId: string, filename: string) {
  const safeName = `${randomUUID()}-${filename.replace(/[^a-zA-Z0-9_.-]/g, '_')}`
  return `${userId}/${safeName}`
}

function tryParseRaw(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
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
    supabase.from('accounts').select('id, property_id, account_type, account_number, party_id').eq('user_id', user.id),
    supabase.from('parties').select('id, property_id, name, party_type').eq('user_id', user.id),
  ])

  if (documentResult.error || !documentResult.data) return null

  const run = runResult.data?.[0] ?? null
  const extraction: DocumentExtraction =
    run?.normalized_extraction ??
    parseExtractionOrEmpty(tryParseRaw(documentResult.data.raw_ai_extraction))

  const proposedMatch = findDocumentMatch(extraction, {
    fileBuffer: Buffer.from(''),
    mimeType: documentResult.data.mime_type || 'application/octet-stream',
    filename: documentResult.data.original_filename,
    userProperties: propertiesResult.data ?? [],
    userAccounts: accountsResult.data ?? [],
    userParties: partiesResult.data ?? [],
  })

  const duplicateCandidates = await findDuplicateCandidates(supabase, user.id, id, extraction, proposedMatch.property_id)

  return {
    document: documentResult.data,
    run,
    extraction,
    proposedMatch,
    properties: propertiesResult.data ?? [],
    accounts: accountsResult.data ?? [],
    parties: partiesResult.data ?? [],
    duplicates: duplicateCandidates,
  }
}

async function getDocumentExtraction(documentId: string): Promise<{ document: Document; extraction: DocumentExtraction } | null> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: document, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single()
    .returns<Document>()

  if (docError || !document) return null

  const { data: runs } = await supabase
    .from('document_processing_runs')
    .select('normalized_extraction')
    .eq('document_id', documentId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<Array<Pick<DocumentProcessingRun, 'normalized_extraction'>>>()

  const rawExtraction = runs?.[0]?.normalized_extraction ?? tryParseRaw(document.raw_ai_extraction)
  const extraction = parseExtraction(rawExtraction)
  if (!extraction) return null

  return { document, extraction }
}

async function findDuplicateCandidates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  documentId: string,
  extraction: DocumentExtraction,
  documentPropertyId: string | null
) {
  const { data, error } = await supabase
    .from('documents')
    .select('id, original_filename, user_id, property_id, account_id, issuer, document_date, raw_ai_extraction')
    .eq('user_id', userId)
    .neq('id', documentId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error || !data) return []

  const typed = data.map((d) => {
    const candidateExtraction = parseExtractionOrEmpty(tryParseRaw(d.raw_ai_extraction))
    return {
      id: d.id,
      original_filename: d.original_filename,
      user_id: d.user_id,
      property_id: d.property_id,
      account_id: d.account_id,
      issuer: d.issuer ?? candidateExtraction.issuer.value,
      document_date: d.document_date ?? candidateExtraction.document_date.value,
      account_number: candidateExtraction.account_number.value,
      amount_due: candidateExtraction.amount_due.value,
      due_date: candidateExtraction.due_date.value,
      invoice_number: candidateExtraction.invoice_number.value,
    }
  }) as Parameters<typeof detectSemanticDuplicates>[1]

  return detectSemanticDuplicates(extraction, typed, documentPropertyId)
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
  // Processing failures do not roll back the persisted document; the user can retry from the review screen.
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
  const { error: processingUpdateError } = await supabase
    .from('documents')
    .update({ processing_status: 'processing', processing_error: null })
    .eq('id', documentId)
    .eq('user_id', user.id)

  if (processingUpdateError) {
    return { error: 'Document processing could not be completed. Please retry later.' }
  }

  const { data: fileData, error: downloadError } = await supabase.storage.from('documents').download(document.storage_path)
  if (downloadError) {
    await markFailed(documentId, supabase, user.id, `Could not retrieve file: ${downloadError.message}`)
    return { error: 'Document processing could not be completed. Please retry later.' }
  }

  const buffer = Buffer.from(await fileData.arrayBuffer())

  const [properties, accounts, parties] = await Promise.all([
    supabase.from('properties').select('id, nickname, street_address, city, state, zip').eq('user_id', user.id),
    supabase.from('accounts').select('id, property_id, account_type, account_number, party_id').eq('user_id', user.id),
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

  const { data: run, error: runError } = await supabase
    .from('document_processing_runs')
    .insert(runInsert)
    .select('id')
    .single()

  if (runError) {
    await markFailed(documentId, supabase, user.id, `Could not record processing run: ${runError.message}`)
    return { error: 'Document processing could not be completed. Please retry later.' }
  }

  try {
    const result = await provider.analyzeDocument({
      fileBuffer: buffer,
      mimeType: document.mime_type || 'application/octet-stream',
      filename: document.original_filename,
      userProperties: properties.data ?? [],
      userAccounts: accounts.data ?? [],
      userParties: parties.data ?? [],
    })

    const { error: runUpdateError } = await supabase
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
      .eq('id', run.id)
      .eq('user_id', user.id)

    if (runUpdateError) {
      await markFailed(documentId, supabase, user.id, `Could not update processing run: ${runUpdateError.message}`, run.id)
      return { error: 'Document processing could not be completed. Please retry later.' }
    }

    // Proposed matches are not persisted as confirmed relationships before review.
    // Only a high-confidence deterministic match is promoted to a prefilled document value.
    const documentUpdate: DocumentUpdate = {
      processing_status: 'processed',
      processing_error: null,
      document_type: result.extraction.document_type ?? document.document_type,
      issuer: result.extraction.issuer.value ?? document.issuer,
      document_date: result.extraction.document_date.value ?? document.document_date,
      raw_ai_extraction: JSON.stringify(result.extraction),
      review_status: document.review_status === 'confirmed' ? document.review_status : 'needs_review',
    }

    if (result.match.confidence === 'high' && result.match.property_id) {
      documentUpdate.property_id = result.match.property_id
      documentUpdate.account_id = result.match.account_id
      documentUpdate.party_id = result.match.party_id
    }

    const { error: documentUpdateError } = await supabase
      .from('documents')
      .update(documentUpdate)
      .eq('id', documentId)
      .eq('user_id', user.id)

    if (documentUpdateError) {
      await markFailed(documentId, supabase, user.id, `Could not save extraction: ${documentUpdateError.message}`, run.id)
      return { error: 'Document processing could not be completed. Please retry later.' }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown processing error'
    await markFailed(documentId, supabase, user.id, message, run?.id)
    // Keep the technical OpenAI/config error server-side; expose a user-facing retry message.
    return { error: 'Document processing could not be completed. Please retry later.' }
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
  const updates = await Promise.all([
    supabase
      .from('documents')
      .update({ processing_status: 'failed', processing_error: message })
      .eq('id', documentId)
      .eq('user_id', userId),
    runId
      ? supabase
          .from('document_processing_runs')
          .update({ completed_at: new Date().toISOString(), status: 'failed', error_message: message })
          .eq('id', runId)
          .eq('user_id', userId)
      : Promise.resolve({ error: null } as const),
  ])

  if (updates[0].error) {
    throw new Error(`Failed to mark document failed: ${updates[0].error.message}`)
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

  const loaded = await getDocumentExtraction(documentId)
  if (!loaded) return { error: 'Document not found or extraction is invalid' }
  const { extraction } = loaded

  const propertyId = fieldValue(formData, 'property_id')
  if (!propertyId) return { error: 'A property is required to confirm' }

  // Payment plans come from the server-side extraction, not the browser. The client only
  // submits the selected option index, and we validate it against the canonical extraction.
  const obligationAction = extraction.proposed_actions.find((a) => a.type === 'obligation')
  const paymentOptions = obligationAction?.payment_options ?? []

  const selectedPaymentOptionIndexRaw = fieldValue(formData, 'selected_payment_option_index')
  let selectedAmount: number | null = null
  let selectedDueDate: string | null = null
  let selectedPaymentOptionIndex: number | null = null

  const SELECTABLE_OPTION_TYPES = ['full', 'discounted', 'installment_plan']

  if (paymentOptions.length > 0) {
    if (!selectedPaymentOptionIndexRaw) {
      return { error: 'A payment option must be selected' }
    }
    const index = Number(selectedPaymentOptionIndexRaw)
    if (Number.isNaN(index) || index < 0 || index >= paymentOptions.length) {
      return { error: 'Invalid payment option selection' }
    }
    const selected = paymentOptions[index]
    if (!selected || !SELECTABLE_OPTION_TYPES.includes(selected.option_type)) {
      return { error: 'Selected payment option is not a valid selectable plan' }
    }
    selectedPaymentOptionIndex = index
    selectedAmount = selected.amount ?? null
    selectedDueDate = selected.due_date ?? null
  } else {
    const amountRaw = fieldValue(formData, 'amount')
    selectedAmount = amountRaw ? Number(amountRaw) : null
    selectedDueDate = fieldValue(formData, 'due_date')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('confirm_document', {
    p_user_id: user.id,
    p_document_id: documentId,
    p_property_id: propertyId,
    p_account_id: fieldValue(formData, 'account_id'),
    p_party_id: fieldValue(formData, 'party_id'),
    p_document_type: fieldValue(formData, 'document_type'),
    p_issuer: fieldValue(formData, 'issuer'),
    p_document_date: fieldValue(formData, 'document_date'),
    p_due_date: selectedDueDate,
    p_period_start: fieldValue(formData, 'period_start'),
    p_period_end: fieldValue(formData, 'period_end'),
    p_amount: selectedAmount,
    p_direction: (fieldValue(formData, 'direction') as 'payable' | 'receivable') ?? 'payable',
    p_category: fieldValue(formData, 'category') ?? 'other',
    p_description: fieldValue(formData, 'description'),
    p_required_action: fieldValue(formData, 'required_action'),
    p_action_due_date: fieldValue(formData, 'action_due_date'),
    p_task_title: fieldValue(formData, 'task_title'),
    p_payment_options: paymentOptions,
    p_selected_payment_option_index: selectedPaymentOptionIndex,
  })

  if (error) {
    return { error: error.message }
  }

  const result = data as { obligation_ids?: string[] | null; task_id?: string | null } | null
  if (!result) {
    return { error: 'Confirmation did not return a result' }
  }

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
