// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { DocumentReviewForm } from './document-review-form'
import { emptyExtraction } from '@/lib/document-intelligence/extraction-schema'
import type { Document, DocumentExtraction, DocumentMatch, PaymentOption } from '@/lib/types'

const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

vi.mock('@/lib/actions/documents', () => ({
  confirmDocument: vi.fn(),
  retryProcessDocument: vi.fn(),
  archiveDocument: vi.fn(),
}))

function makeDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: 'd-1',
    user_id: 'u-1',
    property_id: null,
    account_id: null,
    party_id: null,
    storage_path: 'u-1/test.pdf',
    original_filename: 'test.pdf',
    file_hash: 'hash',
    file_size: 1000,
    mime_type: 'application/pdf',
    document_type: null,
    issuer: null,
    document_date: null,
    processing_status: 'processed',
    review_status: 'unreviewed',
    processing_error: null,
    confirmed_obligation_id: null,
    confirmed_task_id: null,
    duplicate_of_document_id: null,
    raw_extracted_text: null,
    raw_ai_extraction: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

function paymentOption(overrides: Partial<PaymentOption> & { option_type: PaymentOption['option_type'] }): PaymentOption {
  return {
    option_type: overrides.option_type,
    amount: overrides.amount ?? null,
    due_date: overrides.due_date ?? null,
    description: overrides.description ?? null,
    discount_amount: overrides.discount_amount ?? null,
    penalty_amount: overrides.penalty_amount ?? null,
    penalty_date: overrides.penalty_date ?? null,
    late_payment_terms: overrides.late_payment_terms ?? [],
    installments: overrides.installments ?? [],
  }
}

function makeExtraction(paymentOptions: PaymentOption[] = []): DocumentExtraction {
  return {
    ...emptyExtraction(),
    document_class: 'financial',
    requires: 'money',
    issuer: { value: 'Bethlehem Area School District', confidence: 'high', evidence: null },
    parcel_number: { value: '642702833391', confidence: 'high', evidence: null },
    amount_due: { value: 1756.51, confidence: 'high', evidence: null },
    due_date: { value: '2026-10-31', confidence: 'high', evidence: null },
    likely_category: { value: 'school_tax', confidence: 'high', evidence: null },
    direction: { value: 'payable', confidence: 'high', evidence: null },
    service_address: { value: '610 S Bergen Street, Fountain Hill, PA 18015', confidence: 'high', evidence: null },
    proposed_actions: [
      {
        type: 'obligation',
        direction: 'payable',
        category: 'school_tax',
        description: 'School tax bill',
        expected_amount: 1756.51,
        due_date: '2026-10-31',
        action_due_date: null,
        period_start: null,
        period_end: null,
        title: null,
        payment_options: paymentOptions,
      },
    ],
  }
}

const proposedMatch: DocumentMatch = {
  property_id: 'p-1',
  account_id: null,
  party_id: null,
  confidence: 'high',
  reason: 'Matched by property address',
}

const properties = [
  { id: 'p-1', nickname: 'Fountain Hill', street_address: '610 S Bergen Street', city: 'Fountain Hill', state: 'PA', zip: '18015' },
]

const accounts: { id: string; property_id: string; account_type: string; account_number: string | null; party_id?: string | null }[] = []
const parties: { id: string; property_id: string | null; name: string; party_type: string }[] = []

describe('DocumentReviewForm payment selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders without a re-render loop and starts with no selection when multiple plans exist', () => {
    const extraction = makeExtraction([
      paymentOption({ option_type: 'discounted', amount: 1703.81, due_date: '2026-08-31', description: 'Discounted full' }),
      paymentOption({ option_type: 'full', amount: 1756.51, due_date: '2026-10-31', description: 'Full base' }),
      paymentOption({ option_type: 'installment_plan', amount: 1756.51, due_date: '2026-10-31', description: 'Installments' }),
    ])

    const { container } = render(
      <DocumentReviewForm
        document={makeDocument()}
        extraction={extraction}
        proposedMatch={proposedMatch}
        properties={properties}
        accounts={accounts}
        parties={parties}
        duplicates={[]}
      />
    )

    const hiddenInput = container.querySelector('input[name="selected_payment_option_index"]') as HTMLInputElement
    expect(hiddenInput).not.toBeNull()
    expect(hiddenInput.value).toBe('')

    const confirmButton = screen.getByRole('button', { name: /Confirm/i }) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(true)
  })

  it('selects a plan, updates the hidden index, and enables Confirm', async () => {
    const extraction = makeExtraction([
      paymentOption({ option_type: 'discounted', amount: 1703.81, due_date: '2026-08-31', description: 'Discounted full' }),
      paymentOption({ option_type: 'full', amount: 1756.51, due_date: '2026-10-31', description: 'Full base' }),
    ])

    const { container } = render(
      <DocumentReviewForm
        document={makeDocument()}
        extraction={extraction}
        proposedMatch={proposedMatch}
        properties={properties}
        accounts={accounts}
        parties={parties}
        duplicates={[]}
      />
    )

    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios).toHaveLength(2)

    fireEvent.click(radios[0])

    const hiddenInput = container.querySelector('input[name="selected_payment_option_index"]') as HTMLInputElement
    await waitFor(() => expect(hiddenInput.value).toBe('0'))

    const confirmButton = screen.getByRole('button', { name: /Confirm/i }) as HTMLButtonElement
    await waitFor(() => expect(confirmButton.disabled).toBe(false))
  })

  it('preselects the first option when only one selectable plan exists', () => {
    const extraction = makeExtraction([
      paymentOption({ option_type: 'full', amount: 1756.51, due_date: '2026-10-31', description: 'Full base' }),
    ])

    const { container } = render(
      <DocumentReviewForm
        document={makeDocument()}
        extraction={extraction}
        proposedMatch={proposedMatch}
        properties={properties}
        accounts={accounts}
        parties={parties}
        duplicates={[]}
      />
    )

    const hiddenInput = container.querySelector('input[name="selected_payment_option_index"]') as HTMLInputElement
    expect(hiddenInput.value).toBe('0')

    const confirmButton = screen.getByRole('button', { name: /Confirm/i }) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(false)
  })

  it('lists nonselectable options in Other terms and does not make them selectable', () => {
    const extraction = makeExtraction([
      paymentOption({ option_type: 'full', amount: 1756.51, due_date: '2026-10-31', description: 'Full base' }),
      paymentOption({ option_type: 'penalty', amount: 1932.16, due_date: '2026-10-31', description: 'Penalty after 10/31' }),
    ])

    const { container } = render(
      <DocumentReviewForm
        document={makeDocument()}
        extraction={extraction}
        proposedMatch={proposedMatch}
        properties={properties}
        accounts={accounts}
        parties={parties}
        duplicates={[]}
      />
    )

    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios).toHaveLength(1)
    expect(radios[0].getAttribute('value')).toBe('0')

    expect(container.textContent).toContain('Other terms')
    expect(container.textContent).toContain('Penalty after 10/31')
  })

  it('keeps the original index when an earlier option is filtered out as nonselectable', async () => {
    const extraction = makeExtraction([
      paymentOption({ option_type: 'penalty', amount: 1932.16, due_date: '2026-10-31', description: 'Penalty' }),
      paymentOption({ option_type: 'discounted', amount: 1703.81, due_date: '2026-08-31', description: 'Discounted full' }),
      paymentOption({ option_type: 'full', amount: 1756.51, due_date: '2026-10-31', description: 'Full base' }),
    ])

    const { container } = render(
      <DocumentReviewForm
        document={makeDocument()}
        extraction={extraction}
        proposedMatch={proposedMatch}
        properties={properties}
        accounts={accounts}
        parties={parties}
        duplicates={[]}
      />
    )

    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    // Select the third overall option (index 2) which is the second selectable option.
    fireEvent.click(radios[1])

    const hiddenInput = container.querySelector('input[name="selected_payment_option_index"]') as HTMLInputElement
    await waitFor(() => expect(hiddenInput.value).toBe('2'))
  })

  it('preserves selection across equivalent rerenders and clears it when payment options materially change', async () => {
    const baseOptions: PaymentOption[] = [
      paymentOption({ option_type: 'discounted', amount: 1703.81, due_date: '2026-08-31', description: 'Discounted full' }),
      paymentOption({ option_type: 'full', amount: 1756.51, due_date: '2026-10-31', description: 'Full base' }),
    ]

    const { container, rerender } = render(
      <DocumentReviewForm
        document={makeDocument()}
        extraction={makeExtraction(baseOptions)}
        proposedMatch={proposedMatch}
        properties={properties}
        accounts={accounts}
        parties={parties}
        duplicates={[]}
      />
    )

    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    fireEvent.click(radios[1])

    const hiddenInput = () => container.querySelector('input[name="selected_payment_option_index"]') as HTMLInputElement
    await waitFor(() => expect(hiddenInput().value).toBe('1'))

    // Equivalent rerender with a new extraction object: the same options should keep the selection.
    rerender(
      <DocumentReviewForm
        document={makeDocument()}
        extraction={makeExtraction(baseOptions)}
        proposedMatch={proposedMatch}
        properties={properties}
        accounts={accounts}
        parties={parties}
        duplicates={[]}
      />
    )
    expect(hiddenInput().value).toBe('1')

    // Materially changed options: order reversed and amount changed. The stale selection must clear.
    const changedOptions: PaymentOption[] = [
      paymentOption({ option_type: 'full', amount: 1800, due_date: '2026-10-31', description: 'Full base' }),
      paymentOption({ option_type: 'discounted', amount: 1703.81, due_date: '2026-08-31', description: 'Discounted full' }),
    ]
    rerender(
      <DocumentReviewForm
        document={makeDocument()}
        extraction={makeExtraction(changedOptions)}
        proposedMatch={proposedMatch}
        properties={properties}
        accounts={accounts}
        parties={parties}
        duplicates={[]}
      />
    )
    await waitFor(() => expect(hiddenInput().value).toBe(''))

    const confirmButton = screen.getByRole('button', { name: /Confirm/i }) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(true)
  })
})
