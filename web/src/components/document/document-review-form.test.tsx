// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { DocumentReviewForm } from './document-review-form'
import { emptyExtraction, parseExtractionOrEmpty } from '@/lib/document-intelligence/extraction-schema'
import { saveCorrectedInstallmentSchedule } from '@/lib/actions/documents'
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
  saveCorrectedInstallmentSchedule: vi.fn(),
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

function makeMissingPlanExtraction(): DocumentExtraction {
  const extraction = makeExtraction([
    paymentOption({
      option_type: 'installment_plan',
      amount: null,
      due_date: '2026-10-31',
      description: 'Four installments',
      installments: [
        { amount: 439.13, due_date: '2026-08-03', description: 'Installment 1 of 4', late_payment_terms: [] },
        { amount: 439.13, due_date: '2026-09-14', description: 'Installment 2 of 4', late_payment_terms: [] },
        { amount: 439.13, due_date: '2026-10-31', description: 'Installment 3 of 4', late_payment_terms: [] },
        { amount: 439.13, due_date: '2026-12-07', description: 'Installment 4 of 4', late_payment_terms: [] },
      ],
    }),
  ])
  // makeExtraction already sets amount_due and expected_amount to 1756.51
  return extraction
}

function makeLegacyExtractionRaw(): unknown {
  const extraction: Record<string, unknown> = { ...emptyExtraction() }
  extraction.document_type = 'school_tax'
  extraction.document_class = 'financial'
  extraction.requires = 'money'
  extraction.issuer = { value: 'Bethlehem Area School District', confidence: 'high', evidence: null }
  extraction.parcel_number = { value: '642702833391', confidence: 'high', evidence: null }
  extraction.service_address = { value: '610 S Bergen Street, Fountain Hill, PA 18015', confidence: 'high', evidence: null }
  extraction.amount_due = { value: 1756.51, confidence: 'high', evidence: null }
  extraction.due_date = { value: '2026-10-31', confidence: 'high', evidence: null }
  extraction.likely_category = { value: 'school_tax', confidence: 'high', evidence: null }
  extraction.direction = { value: 'payable', confidence: 'high', evidence: null }

  const installments = [
    { amount: 439.13, due_date: '2026-08-03', description: 'Installment 1 of 4' },
    { amount: 439.13, due_date: '2026-09-14', description: 'Installment 2 of 4' },
    { amount: 439.13, due_date: '2026-10-31', description: 'Installment 3 of 4' },
    { amount: 439.12, due_date: '2026-12-07', description: 'Installment 4 of 4' },
  ]

  extraction.proposed_actions = [
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
      payment_options: [
        {
          option_type: 'installment_plan',
          amount: 1756.51,
          due_date: '2026-10-31',
          description: 'Four installments',
          discount_amount: null,
          penalty_amount: null,
          penalty_date: null,
          installments,
          // intentionally omit option-level late_payment_terms and installment-level late_payment_terms
        },
      ],
    },
  ]

  return extraction
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
    vi.mocked(saveCorrectedInstallmentSchedule).mockResolvedValue({ success: true })
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

  it('renders with a legacy extraction missing late_payment_terms and keeps payment choices usable', () => {
    const legacyRaw = makeLegacyExtractionRaw()
    const extraction = parseExtractionOrEmpty(legacyRaw)

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

    expect(container.textContent).toContain('Pay in 4 installments')
    const option = extraction.proposed_actions[0].payment_options[0]
    expect(option.late_payment_terms).toEqual([])
    expect(option.installments[0].late_payment_terms).toEqual([])

    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios).toHaveLength(1)
    fireEvent.click(radios[0])

    const hiddenInput = container.querySelector('input[name="selected_payment_option_index"]') as HTMLInputElement
    expect(hiddenInput.value).toBe('0')
  })

  it('disables confirm and shows totals/difference for an invalid installment schedule', async () => {
    const unbalancedInstallments = [
      { amount: 439.13, due_date: '2026-08-03', description: 'Installment 1 of 4', late_payment_terms: [] },
      { amount: 439.13, due_date: '2026-09-14', description: 'Installment 2 of 4', late_payment_terms: [] },
      { amount: 439.13, due_date: '2026-10-31', description: 'Installment 3 of 4', late_payment_terms: [] },
      { amount: 439.13, due_date: '2026-12-07', description: 'Installment 4 of 4', late_payment_terms: [] },
    ]
    const extraction = makeExtraction([
      paymentOption({ option_type: 'installment_plan', amount: 1756.51, due_date: '2026-10-31', description: 'Four installments', installments: unbalancedInstallments }),
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
    fireEvent.click(radios[0])

    await waitFor(() => expect(container.textContent).toContain('Schedule cannot be confirmed'))
    expect(container.textContent).toContain('Plan total $1,756.51')
    expect(container.textContent).toContain('Installment total $1,756.52')
    expect(container.textContent).toContain('+$0.01')

    const confirmButton = screen.getByRole('button', { name: /Confirm/i }) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(true)
  })

  it('suggests the bill total and enables saving a missing plan amount', async () => {
    const extraction = makeMissingPlanExtraction()

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
    fireEvent.click(radios[0])

    await waitFor(() => expect(container.textContent).toContain('Schedule cannot be confirmed'))
    expect(container.textContent).toContain('Installment total: $1,756.52')
    expect(container.textContent).toContain('Enter the plan total from the document')
    expect(container.textContent).not.toContain('Plan total $0.00')

    const editButton = await waitFor(() => screen.getByRole('button', { name: /Edit schedule/i }))
    fireEvent.click(editButton)

    const planTotalInput = screen.getByLabelText('Plan total') as HTMLInputElement
    expect(planTotalInput.value).toBe('1756.51')
    expect(screen.getByText(/Suggested from the bill/i)).toBeDefined()

    const amountInputs = screen.getAllByLabelText(/amount/i) as HTMLInputElement[]
    fireEvent.change(amountInputs[3], { target: { value: '439.12' } })

    await waitFor(() => expect(container.textContent).toContain('Difference: $0.00'))
    const saveButton = screen.getByRole('button', { name: /Save corrections/i }) as HTMLButtonElement
    await waitFor(() => expect(saveButton.disabled).toBe(false))

    fireEvent.click(screen.getByRole('button', { name: /Save corrections/i }))

    await waitFor(() => {
      expect(saveCorrectedInstallmentSchedule).toHaveBeenCalledWith(
        'd-1',
        0,
        '1756.51',
        expect.arrayContaining([
          expect.objectContaining({ amount: '439.12', due_date: '2026-12-07' }),
        ]),
      )
    })
  })

  it('recalculates totals while editing and saves a corrected schedule', async () => {
    const extraction = makeExtraction([
      paymentOption({
        option_type: 'installment_plan',
        amount: 1756.51,
        due_date: '2026-10-31',
        description: 'Four installments',
        installments: [
          { amount: 439.13, due_date: '2026-08-03', description: 'Installment 1 of 4', late_payment_terms: [] },
          { amount: 439.13, due_date: '2026-09-14', description: 'Installment 2 of 4', late_payment_terms: [] },
          { amount: 439.13, due_date: '2026-10-31', description: 'Installment 3 of 4', late_payment_terms: [] },
          { amount: 439.13, due_date: '2026-12-07', description: 'Installment 4 of 4', late_payment_terms: [] },
        ],
      }),
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
    fireEvent.click(radios[0])

    const editButton = await waitFor(() => screen.getByRole('button', { name: /Edit schedule/i }))
    fireEvent.click(editButton)

    const amountInputs = screen.getAllByLabelText(/amount/i) as HTMLInputElement[]
    fireEvent.change(amountInputs[3], { target: { value: '439.12' } })

    await waitFor(() => expect(container.textContent).toContain('Difference: $0.00'))

    fireEvent.click(screen.getByRole('button', { name: /Save corrections/i }))

    await waitFor(() => {
      expect(saveCorrectedInstallmentSchedule).toHaveBeenCalledWith(
        'd-1',
        0,
        '1756.51',
        expect.arrayContaining([
          expect.objectContaining({ amount: '439.12', due_date: '2026-12-07' }),
        ]),
      )
    })
  })

  it('cancelling an edit does not persist changes', async () => {
    const extraction = makeExtraction([
      paymentOption({
        option_type: 'installment_plan',
        amount: 1756.51,
        due_date: '2026-10-31',
        description: 'Four installments',
        installments: [
          { amount: 439.13, due_date: '2026-08-03', description: 'Installment 1 of 4', late_payment_terms: [] },
          { amount: 439.13, due_date: '2026-09-14', description: 'Installment 2 of 4', late_payment_terms: [] },
          { amount: 439.13, due_date: '2026-10-31', description: 'Installment 3 of 4', late_payment_terms: [] },
          { amount: 439.13, due_date: '2026-12-07', description: 'Installment 4 of 4', late_payment_terms: [] },
        ],
      }),
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
    fireEvent.click(radios[0])

    const editButton = await waitFor(() => screen.getByRole('button', { name: /Edit schedule/i }))
    fireEvent.click(editButton)

    const amountInputs = screen.getAllByLabelText(/amount/i) as HTMLInputElement[]
    fireEvent.change(amountInputs[3], { target: { value: '439.12' } })

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))

    await waitFor(() => expect(container.textContent).not.toContain('Save corrections'))
    expect(saveCorrectedInstallmentSchedule).not.toHaveBeenCalled()
    expect(container.textContent).toMatch(/4\$439\.1312\/7\/2026/)
  })

  it('displays a 10% late amount for each installment', async () => {
    const extraction = makeExtraction([
      paymentOption({
        option_type: 'installment_plan',
        amount: 1756.51,
        due_date: '2026-10-31',
        description: 'Four installments',
        installments: [
          { amount: 439.13, due_date: '2026-08-03', description: 'Installment 1 of 4', late_payment_terms: [{ term_type: 'penalty' as const, amount: null, rate: 0.1, effective_date: '2026-08-03', due_date: '2026-08-03', description: '10% penalty after due' }] },
          { amount: 439.13, due_date: '2026-09-14', description: 'Installment 2 of 4', late_payment_terms: [{ term_type: 'penalty' as const, amount: null, rate: 0.1, effective_date: '2026-09-14', due_date: '2026-09-14', description: '10% penalty after due' }] },
          { amount: 439.13, due_date: '2026-10-31', description: 'Installment 3 of 4', late_payment_terms: [{ term_type: 'penalty' as const, amount: null, rate: 0.1, effective_date: '2026-10-31', due_date: '2026-10-31', description: '10% penalty after due' }] },
          { amount: 439.12, due_date: '2026-12-07', description: 'Installment 4 of 4', late_payment_terms: [{ term_type: 'penalty' as const, amount: null, rate: 0.1, effective_date: '2026-12-07', due_date: '2026-12-07', description: '10% penalty after due' }] },
        ],
      }),
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
    fireEvent.click(radios[0])

    await waitFor(() => {
      expect(container.textContent).toMatch(/10% late[^]*\$483\.03/)
      expect(container.textContent).toMatch(/10% late[^]*\$483\.04/)
    })
  })
})
