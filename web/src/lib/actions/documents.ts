'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/client'
import { documentSchema } from '@/lib/validations/document'
import { requireUser } from './helpers'
import { formatZodErrors } from '@/lib/utils'
import { randomUUID } from 'crypto'
import type { Document } from '@/lib/types'

type ActionResult =
  | { success: true }
  | { error: string; errors?: Record<string, string[]> }

export async function getDocuments(): Promise<Document[]> {
  const user = await requireUser()
  const supabase = createClient()
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
  const supabase = createClient()
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
  const supabase = createClient()
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

export async function createDocument(formData: FormData): Promise<ActionResult & { path?: string }> {
  const parsed = documentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Validation failed', errors: formatZodErrors(parsed.error) }
  }

  const user = await requireUser()
  const supabase = createClient()

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) {
    return { error: 'A file is required' }
  }

  const safeName = `${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`
  const storagePath = `${user.id}/${safeName}`

  const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, file, {
    contentType: file.type || 'application/octet-stream',
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
      mime_type: file.type || 'application/octet-stream',
      document_type: parsed.data.document_type,
      issuer: parsed.data.issuer,
      document_date: parsed.data.document_date,
      processing_status: 'pending',
      review_status: 'pending',
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/documents')
  revalidatePath('/inbox')
  revalidatePath('/dashboard')
  if (parsed.data.property_id) revalidatePath(`/properties/${parsed.data.property_id}`)

  return { success: true, path: data?.storage_path }
}

export async function updateDocumentReviewStatus(id: string, reviewStatus: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = createClient()

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
  const supabase = createClient()

  const { data: existing } = await supabase
    .from('documents')
    .select('storage_path,property_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (existing?.storage_path) {
    await supabase.storage.from('documents').remove([existing.storage_path])
  }

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/documents')
  revalidatePath('/inbox')
  revalidatePath('/dashboard')
  if (existing?.property_id) revalidatePath(`/properties/${existing.property_id}`)
  return { success: true }
}
