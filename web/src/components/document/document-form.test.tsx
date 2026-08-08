// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { DocumentForm } from './document-form'

const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

function createFile(type = 'application/pdf', name = 'test.pdf'): File {
  return new File([new Blob(['pdf-content'], { type })], name, { type })
}

describe('DocumentForm', () => {
  const action = vi.fn()

  const baseProps = {
    properties: [{ id: 'p-1', nickname: 'Rental' }],
    accounts: [],
    parties: [],
    obligations: [],
    action,
  }

  beforeEach(() => {
    action.mockReset()
    mockPush.mockReset()
    mockRefresh.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  function setFile(name = 'test.pdf') {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = createFile('application/pdf', name)
    fireEvent.change(fileInput, { target: { files: [file] } })
  }

  it('uploads a valid file and redirects to the new document detail', async () => {
    action.mockResolvedValue({ success: true, id: 'doc-new' })
    render(<DocumentForm {...baseProps} />)

    setFile()
    fireEvent.submit(document.querySelector('form') as HTMLFormElement)

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(mockPush).toHaveBeenCalledWith('/documents/doc-new')
  })

  it('shows a duplicate message and lets the user open the existing document', async () => {
    action.mockResolvedValue({ success: true, duplicateDocumentId: 'doc-existing' })
    render(<DocumentForm {...baseProps} />)

    setFile('duplicate.pdf')
    fireEvent.submit(document.querySelector('form') as HTMLFormElement)

    await waitFor(() => screen.getByText('This file has already been uploaded.'))
    expect(screen.getByText('No new document was created.')).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('View existing document'))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/documents/doc-existing'))
  })

  it('lists global parties when a property is selected', () => {
    const props = {
      ...baseProps,
      parties: [
        { id: 'pt-1', name: 'Global Tenant', party_type: 'tenant', property_id: null as string | null },
        { id: 'pt-2', name: 'Property Tenant', party_type: 'tenant', property_id: 'p-1' },
      ],
      defaultPropertyId: 'p-1',
    }
    render(<DocumentForm {...props} />)

    const select = document.querySelector('select[name="party_id"]') as HTMLSelectElement
    const options = Array.from(select.options).map((o) => o.text)
    expect(options).toContain('Global Tenant · tenant')
    expect(options).toContain('Property Tenant · tenant')
  })
})
