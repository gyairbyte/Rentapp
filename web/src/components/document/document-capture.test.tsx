// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { DocumentCapture } from './document-capture'
import { prepareImageFile, readFileAsDataUrl } from '@/lib/image-capture'

const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

vi.mock('@/lib/image-capture', () => ({
  prepareImageFile: vi.fn(),
  readFileAsDataUrl: vi.fn(),
}))

function createFile(type: string, name: string, size = 1000): File {
  const blob = new Blob(['x'.repeat(size)], { type })
  return new File([blob], name, { type })
}

function createImageFile(name = 'photo.jpg', size = 1000): File {
  return createFile('image/jpeg', name, size)
}

describe('DocumentCapture', () => {
  const uploadDocument = vi.fn()
  const processDocument = vi.fn()

  beforeEach(() => {
    vi.mocked(prepareImageFile).mockImplementation(async (file: File) => ({
      file,
      originalFile: file,
      resized: false,
      normalized: false,
    }))
    vi.mocked(readFileAsDataUrl).mockResolvedValue('data:image/jpeg;base64,abc')
    uploadDocument.mockReset()
    processDocument.mockReset()
    mockPush.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  function getFileInput(label: string) {
    return document.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement
  }

  it('shows distinct Take photo and Choose photo or file actions', () => {
    render(<DocumentCapture uploadDocument={uploadDocument} processDocument={processDocument} />)
    expect(screen.getByText('Take photo')).toBeTruthy()
    expect(screen.getByText('Choose photo or file')).toBeTruthy()
  })

  it('shows a preview after selecting a file', async () => {
    render(<DocumentCapture uploadDocument={uploadDocument} processDocument={processDocument} />)

    fireEvent.change(getFileInput('Choose photo or file'), { target: { files: [createImageFile()] } })

    await waitFor(() => screen.getByText('Use photo & analyze'))
    expect(screen.getByAltText('Selected bill')).toBeTruthy()
  })

  it('retake clears the selection and does not submit', async () => {
    render(<DocumentCapture uploadDocument={uploadDocument} processDocument={processDocument} />)

    fireEvent.change(getFileInput('Choose photo or file'), { target: { files: [createImageFile()] } })

    await waitFor(() => screen.getByText('Use photo & analyze'))
    fireEvent.click(screen.getByText('Retake'))

    await waitFor(() => {
      expect(screen.getByText('Take photo')).toBeTruthy()
    })
    expect(uploadDocument).not.toHaveBeenCalled()
  })

  it('uploads and processes a valid image, then routes to review', async () => {
    uploadDocument.mockResolvedValue({ success: true, id: 'doc-123' })
    processDocument.mockResolvedValue({ success: true })

    render(<DocumentCapture uploadDocument={uploadDocument} processDocument={processDocument} />)

    fireEvent.change(getFileInput('Choose photo or file'), { target: { files: [createImageFile()] } })

    await waitFor(() => screen.getByText('Use photo & analyze'))
    fireEvent.click(screen.getByText('Use photo & analyze'))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/documents/doc-123/review'))
    expect(uploadDocument).toHaveBeenCalledTimes(1)
    expect(processDocument).toHaveBeenCalledWith('doc-123')
  })

  it('shows a duplicate message and lets the user review the existing document', async () => {
    uploadDocument.mockResolvedValue({ success: true, duplicateDocumentId: 'doc-existing' })

    render(<DocumentCapture uploadDocument={uploadDocument} processDocument={processDocument} />)

    fireEvent.change(getFileInput('Choose photo or file'), { target: { files: [createImageFile()] } })

    await waitFor(() => screen.getByText('Use photo & analyze'))
    fireEvent.click(screen.getByText('Use photo & analyze'))

    await waitFor(() => screen.getByText('This document has already been uploaded'))
    expect(processDocument).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Review existing document'))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/documents/doc-existing/review'))
  })

  it('disables the submit flow while processing and does not double submit', async () => {
    uploadDocument.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, id: 'doc-123' }), 50))
    )
    processDocument.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 50)))

    render(<DocumentCapture uploadDocument={uploadDocument} processDocument={processDocument} />)

    fireEvent.change(getFileInput('Choose photo or file'), { target: { files: [createImageFile()] } })

    await waitFor(() => screen.getByText('Use photo & analyze'))
    const submitButton = screen.getByText('Use photo & analyze')
    fireEvent.click(submitButton)
    fireEvent.click(submitButton)

    await waitFor(() => expect(mockPush).toHaveBeenCalled())
    expect(uploadDocument).toHaveBeenCalledTimes(1)
  })

  it('passes the property id in the upload form data', async () => {
    uploadDocument.mockResolvedValue({ success: true, id: 'doc-123' })
    processDocument.mockResolvedValue({ success: true })

    const property = { id: '123e4567-e89b-12d3-a456-426614174000', nickname: 'Rental' }
    render(<DocumentCapture property={property} uploadDocument={uploadDocument} processDocument={processDocument} />)

    fireEvent.change(getFileInput('Choose photo or file'), { target: { files: [createImageFile()] } })

    await waitFor(() => screen.getByText('Use photo & analyze'))
    fireEvent.click(screen.getByText('Use photo & analyze'))

    await waitFor(() => expect(uploadDocument).toHaveBeenCalled())
    const formData = uploadDocument.mock.calls[0][0] as FormData
    const entries = Array.from(formData.entries()) as [string, FormDataEntryValue][]
    const propertyEntry = entries.find(([key]) => key === 'property_id')?.[1]
    expect(propertyEntry).toBe(property.id)
    const fileEntry = entries.find(([key]) => key === 'file')?.[1]
    expect(fileEntry).toBeTruthy()
  })

  it('displays an error and allows retry when upload fails', async () => {
    uploadDocument.mockResolvedValue({ error: 'Network error' })

    render(<DocumentCapture uploadDocument={uploadDocument} processDocument={processDocument} />)

    fireEvent.change(getFileInput('Choose photo or file'), { target: { files: [createImageFile()] } })

    await waitFor(() => screen.getByText('Use photo & analyze'))
    fireEvent.click(screen.getByText('Use photo & analyze'))

    await waitFor(() => screen.getByText('Network error'))
    expect(processDocument).not.toHaveBeenCalled()
  })
})
