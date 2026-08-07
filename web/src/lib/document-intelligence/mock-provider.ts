import type { DocumentIntelligenceProvider, DocumentAnalysisInput, AnalyzedDocument } from './types'
import { findDocumentMatch } from './matching'
import { emptyExtraction } from './extraction-schema'

function s(value: string | null, confidence: 'high' | 'medium' | 'low' = 'low', evidence: string | null = null) {
  return { value, confidence, evidence }
}

function n(value: number | null, confidence: 'high' | 'medium' | 'low' = 'low', evidence: string | null = null) {
  return { value, confidence, evidence }
}

function d(value: 'payable' | 'receivable' | null, confidence: 'high' | 'medium' | 'low' = 'low', evidence: string | null = null) {
  return { value, confidence, evidence }
}

type ActionOverrides = Partial<{
  direction: 'payable' | 'receivable' | null
  category: string | null
  description: string | null
  expected_amount: number | null
  due_date: string | null
  action_due_date: string | null
  period_start: string | null
  period_end: string | null
  title: string | null
  payment_options: import('@/lib/types').PaymentOption[]
}>

function action(type: 'obligation' | 'task' | 'none', overrides: ActionOverrides = {}) {
  return {
    type,
    direction: overrides.direction ?? null,
    category: overrides.category ?? null,
    description: overrides.description ?? null,
    expected_amount: overrides.expected_amount ?? null,
    due_date: overrides.due_date ?? null,
    action_due_date: overrides.action_due_date ?? null,
    period_start: overrides.period_start ?? null,
    period_end: overrides.period_end ?? null,
    title: overrides.title ?? null,
    payment_options: overrides.payment_options ?? [],
  }
}

function term(
  overrides: Partial<import('@/lib/types').PaymentTerm> = {},
): import('@/lib/types').PaymentTerm {
  return {
    term_type: 'penalty',
    amount: null,
    rate: null,
    effective_date: null,
    due_date: null,
    description: null,
    ...overrides,
  }
}

function extractionForFilename(filename: string, input: DocumentAnalysisInput) {
  const name = filename.toLowerCase()

  const property = input.userProperties[0]
  const account = input.userAccounts[0]
  const address = property ? `${property.street_address}, ${property.city}, ${property.state}` : null

  if (name.includes('water')) {
    return {
      document_type: 'water',
      document_class: 'financial' as const,
      requires: 'money' as const,
      issuer: s('City Water Department', 'high', 'letterhead'),
      account_number: s(account?.account_number ?? '3928292', 'high', 'account_number'),
      account_number_suffix: s(null, 'low'),
      invoice_number: s(null, 'low'),
      parcel_number: s(null, 'low'),
      policy_number: s(null, 'low'),
      service_address: s(address, 'high', 'service_address'),
      mailing_address: s(null, 'low'),
      tenant_name: s(null, 'low'),
      property_identifiers: s(property?.nickname ?? null, 'medium', 'property_nickname'),
      document_date: s('2026-08-01', 'high', 'document_date'),
      due_date: s('2026-08-25', 'high', 'due_date'),
      service_period_start: s('2026-07-01', 'medium', 'period_start'),
      service_period_end: s('2026-07-31', 'medium', 'period_end'),
      amount_due: n(134.6, 'high', 'amount_due'),
      total_amount: n(134.6, 'high', 'total_amount'),
      previous_balance: n(0, 'medium', 'previous_balance'),
      payment_received: n(0, 'low', 'payment_received'),
      direction: d('payable', 'high', 'direction'),
      likely_category: s('water', 'high', 'category'),
      required_action: s(null, 'low'),
      action_due_date: s(null, 'low'),
      notes: s(null, 'low'),
      proposed_actions: [
        action('obligation', {
          direction: 'payable',
          category: 'water',
          expected_amount: 134.6,
          due_date: '2026-08-25',
          period_start: '2026-07-01',
          period_end: '2026-07-31',
        }),
      ],
    }
  }

  if (name.includes('electric')) {
    return {
      document_type: 'electric',
      document_class: 'financial' as const,
      requires: 'money' as const,
      issuer: s('Power Electric Co', 'high', 'letterhead'),
      account_number: s(account?.account_number ?? 'E-8833', 'high', 'account_number'),
      account_number_suffix: s(null, 'low'),
      invoice_number: s(null, 'low'),
      parcel_number: s(null, 'low'),
      policy_number: s(null, 'low'),
      service_address: s(address, 'high', 'service_address'),
      mailing_address: s(null, 'low'),
      tenant_name: s(null, 'low'),
      property_identifiers: s(property?.nickname ?? null, 'medium', 'property_nickname'),
      document_date: s('2026-08-05', 'high', 'document_date'),
      due_date: s('2026-08-30', 'high', 'due_date'),
      service_period_start: s(null, 'low'),
      service_period_end: s(null, 'low'),
      amount_due: n(89.99, 'high', 'amount_due'),
      total_amount: n(89.99, 'high', 'total_amount'),
      previous_balance: n(0, 'low'),
      payment_received: n(0, 'low'),
      direction: d('payable', 'high', 'direction'),
      likely_category: s('electricity_gas', 'high', 'category'),
      required_action: s(null, 'low'),
      action_due_date: s(null, 'low'),
      notes: s(null, 'low'),
      proposed_actions: [
        action('obligation', {
          direction: 'payable',
          category: 'electricity_gas',
          expected_amount: 89.99,
          due_date: '2026-08-30',
        }),
      ],
    }
  }

  if (name.includes('tax') || name.includes('school') || name.includes('bethlehem')) {
    return {
      document_type: 'school_tax',
      document_class: 'financial' as const,
      requires: 'money' as const,
      issuer: s('Bethlehem Area School District', 'high', 'letterhead'),
      account_number: s(null, 'low'),
      account_number_suffix: s(null, 'low'),
      invoice_number: s(null, 'low'),
      parcel_number: s('642702833391', 'high', 'parcel_number'),
      policy_number: s(null, 'low'),
      service_address: s(address, 'medium', 'service_address'),
      mailing_address: s(null, 'low'),
      tenant_name: s(null, 'low'),
      property_identifiers: s(property?.nickname ?? null, 'medium', 'property_nickname'),
      document_date: s('2026-08-01', 'high', 'document_date'),
      due_date: s('2026-10-31', 'high', 'due_date'),
      service_period_start: s(null, 'low'),
      service_period_end: s(null, 'low'),
      amount_due: n(1756.51, 'high', 'amount_due'),
      total_amount: n(1756.51, 'high', 'total_amount'),
      previous_balance: n(0, 'low'),
      payment_received: n(0, 'low'),
      direction: d('payable', 'high', 'direction'),
      likely_category: s('school_tax', 'high', 'category'),
      required_action: s(null, 'low'),
      action_due_date: s(null, 'low'),
      notes: s(
        'Pay 2026-2027 school real estate tax bill either in full by 10/31/2026, at a discount by 8/31/2026, or in up to four installments.',
        'high',
        'notes'
      ),
      proposed_actions: [
        action('obligation', {
          direction: 'payable',
          category: 'school_tax',
          expected_amount: 1756.51,
          due_date: '2026-10-31',
          payment_options: [
            {
              option_type: 'discounted',
              amount: 1703.81,
              due_date: '2026-08-31',
              description: 'Full payment with discount by 8/31/2026',
              discount_amount: 52.7,
              penalty_amount: null,
              penalty_date: null,
              late_payment_terms: [],
              installments: [],
            },
            {
              option_type: 'full',
              amount: 1756.51,
              due_date: '2026-10-31',
              description: 'Full base payment by 10/31/2026',
              discount_amount: null,
              penalty_amount: null,
              penalty_date: null,
              late_payment_terms: [
                term({
                  term_type: 'penalty',
                  rate: 0.1,
                  amount: 1932.16,
                  effective_date: '2026-10-31',
                  due_date: '2026-10-31',
                  description: 'Add 10% penalty after 10/31/2026',
                }),
              ],
              installments: [],
            },
            {
              option_type: 'installment_plan',
              amount: 1756.51,
              due_date: '2026-10-31',
              description: 'Four installment plan',
              discount_amount: null,
              penalty_amount: null,
              penalty_date: null,
              late_payment_terms: [],
              installments: [
                { amount: 439.13, due_date: '2026-08-03', description: 'Installment 1 of 4', late_payment_terms: [] },
                { amount: 439.13, due_date: '2026-09-14', description: 'Installment 2 of 4', late_payment_terms: [] },
                { amount: 439.13, due_date: '2026-10-31', description: 'Installment 3 of 4', late_payment_terms: [] },
                { amount: 439.12, due_date: '2026-12-07', description: 'Installment 4 of 4', late_payment_terms: [] },
              ],
            }
          ],
        }),
      ],
    }
  }

  if (name.includes('notice') || name.includes('letter')) {
    return {
      document_type: 'general_letter',
      document_class: 'operational' as const,
      requires: 'action' as const,
      issuer: s('City Inspection Office', 'high', 'letterhead'),
      account_number: s(null, 'low'),
      account_number_suffix: s(null, 'low'),
      invoice_number: s(null, 'low'),
      parcel_number: s(null, 'low'),
      policy_number: s(null, 'low'),
      service_address: s(address, 'medium', 'service_address'),
      mailing_address: s(null, 'low'),
      tenant_name: s(null, 'low'),
      property_identifiers: s(property?.nickname ?? null, 'medium', 'property_nickname'),
      document_date: s('2026-08-02', 'high', 'document_date'),
      due_date: s('2026-08-20', 'medium', 'due_date'),
      service_period_start: s(null, 'low'),
      service_period_end: s(null, 'low'),
      amount_due: n(null, 'low'),
      total_amount: n(null, 'low'),
      previous_balance: n(null, 'low'),
      payment_received: n(null, 'low'),
      direction: d(null, 'low'),
      likely_category: s('other', 'low'),
      required_action: s('Submit rental inspection form', 'high', 'required_action'),
      action_due_date: s('2026-09-15', 'high', 'action_due_date'),
      notes: s(null, 'low'),
      proposed_actions: [
        action('task', { title: 'Submit rental inspection form', action_due_date: '2026-09-15' }),
      ],
    }
  }

  return emptyExtraction()
}

export const mockDocumentIntelligenceProvider: DocumentIntelligenceProvider = {
  name: 'mock',
  async analyzeDocument(input: DocumentAnalysisInput): Promise<AnalyzedDocument> {
    const startedAt = Date.now()
    const extraction = extractionForFilename(input.filename, input)
    const match = findDocumentMatch(extraction, input)
    return {
      extraction,
      match,
      provider: 'mock',
      model: 'mock-model',
      inputTokens: 100,
      outputTokens: 100,
      durationMs: Date.now() - startedAt,
      rawOutput: { fixture: input.filename },
    }
  },
}
