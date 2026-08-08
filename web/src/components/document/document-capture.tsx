'use client'

import { useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { prepareImageFile, readFileAsDataUrl } from '@/lib/image-capture'
import type { ActionResult } from '@/lib/actions/documents'

type Step = 'select' | 'preview' | 'preparing' | 'uploading' | 'analyzing' | 'error'

type DocumentCaptureProps = {
  property?: { id: string; nickname: string } | null
  uploadDocument: (formData: FormData) => Promise<ActionResult>
  processDocument: (documentId: string) => Promise<ActionResult>
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function DocumentCapture({ property, uploadDocument, processDocument }: DocumentCaptureProps) {
  const router = useRouter()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('select')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [processingMessage, setProcessingMessage] = useState<string | null>(null)

  const reset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setSelectedFile(null)
    setError(null)
    setProcessingMessage(null)
    setStep('select')
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [previewUrl])

  const handleFileSelect = useCallback(
    async (file: File) => {
      setError(null)
      setStep('preparing')
      try {
        const prepared = await prepareImageFile(file)
        const preview = prepared.file.type.startsWith('image/') ? await readFileAsDataUrl(prepared.file) : ''
        setSelectedFile(prepared.file)
        setPreviewUrl(preview || null)
        setStep('preview')
      } catch (err) {
        setStep('error')
        setError(err instanceof Error ? err.message : 'Could not prepare file')
      }
    },
    []
  )

  const onCameraInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect]
  )

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect]
  )

  const handleSubmit = useCallback(async () => {
    if (!selectedFile) return
    setError(null)
    setStep('uploading')
    setProcessingMessage('Uploading…')

    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('property_id', property?.id ?? '')
    formData.append('document_type', '')
    formData.append('issuer', '')
    formData.append('document_date', '')

    const uploadResult = await uploadDocument(formData)

    if ('error' in uploadResult) {
      setStep('error')
      setError(uploadResult.error)
      return
    }

    if (uploadResult.duplicateDocumentId) {
      router.push(`/documents/${uploadResult.duplicateDocumentId}/review`)
      return
    }

    if (!uploadResult.id) {
      setStep('error')
      setError('Upload failed')
      return
    }

    setStep('analyzing')
    setProcessingMessage('Analyzing bill…')

    await processDocument(uploadResult.id)

    router.push(`/documents/${uploadResult.id}/review`)
    router.refresh()
  }, [selectedFile, property, uploadDocument, processDocument, router])

  return (
    <div className="space-y-6">
      {property && (
        <div className="text-sm text-foreground/70">
          Scanning for property: <span className="font-medium text-foreground">{property.nickname}</span>
        </div>
      )}

      {step === 'select' && (
        <div className="space-y-4">
          <p className="text-foreground/70">Take a photo of a paper bill or choose an existing photo/PDF.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center hover:bg-foreground/5 transition-colors"
            >
              <span aria-hidden="true" className="text-3xl">📷</span>
              <span className="font-medium">Take photo</span>
              <span className="text-xs text-foreground/60">Camera capture, images only</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center hover:bg-foreground/5 transition-colors"
            >
              <span aria-hidden="true" className="text-3xl">🖼️</span>
              <span className="font-medium">Choose photo or file</span>
              <span className="text-xs text-foreground/60">JPEG, PNG, WebP, or PDF</span>
            </button>
          </div>
        </div>
      )}

      {(step === 'preview' || step === 'preparing') && (
        <div className="space-y-4">
          <div className="rounded-lg border overflow-hidden bg-foreground/5">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Selected bill"
                className="max-h-[60vh] w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-foreground/60">
                <span className="text-3xl mb-2">📄</span>
                <p className="font-medium">{selectedFile?.name}</p>
                <p className="text-sm">{selectedFile ? formatFileSize(selectedFile.size) : ''}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 text-sm text-foreground/70">
            {selectedFile && <p>{selectedFile.name} · {formatFileSize(selectedFile.size)}</p>}
            {step === 'preparing' && <p>Preparing photo…</p>}
          </div>

          {step === 'preview' && (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!selectedFile}
                className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Use photo & analyze
              </button>
            </div>
          )}
        </div>
      )}

      {(step === 'uploading' || step === 'analyzing') && (
        <div className="space-y-4 rounded-lg border p-6 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground" />
          <p className="font-medium">{step === 'uploading' ? 'Uploading…' : 'Analyzing bill…'}</p>
          {processingMessage && <p className="text-sm text-foreground/70">{processingMessage}</p>}
          <p className="text-xs text-foreground/60">Do not close this page.</p>
        </div>
      )}

      {step === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">Something went wrong</p>
          <p>{error}</p>
          <div className="mt-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onCameraInputChange}
        className="sr-only"
        aria-label="Take photo"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={onFileInputChange}
        className="sr-only"
        aria-label="Choose photo or file"
      />
    </div>
  )
}
