import { describe, it, expect } from 'vitest'
import { documentExtractionJsonSchema, parseExtraction, emptyExtraction } from './extraction-schema'

describe('documentExtractionJsonSchema strictness', () => {
  function assertStrictObject(schema: Record<string, unknown>, path: string) {
    expect(schema.type, `${path} must declare type object`).toBe('object')
    expect(schema.additionalProperties, `${path} must set additionalProperties=false`).toBe(false)

    const properties = Object.keys((schema.properties ?? {}) as Record<string, unknown>)
    const required = (schema.required ?? []) as string[]
    for (const key of properties) {
      expect(required, `${path} is missing ${key} in required`).toContain(key)
    }

    for (const [key, value] of Object.entries(schema.properties as Record<string, unknown>)) {
      const sub = value as Record<string, unknown>
      if (sub.type === 'object') {
        assertStrictObject(sub, `${path}.${key}`)
      } else if (sub.type === 'array' && sub.items) {
        const items = sub.items as Record<string, unknown>
        if (items.type === 'object') {
          assertStrictObject(items, `${path}.${key}[]`)
        }
      }
    }
  }

  it('declares every nested object property as required and sets additionalProperties=false', () => {
    assertStrictObject(documentExtractionJsonSchema.schema, 'documentExtractionJsonSchema.schema')
  })

  it('includes evidence in every extracted field required array', () => {
    const schema = documentExtractionJsonSchema.schema as Record<string, unknown>
    const stringFields = [
      'issuer',
      'account_number',
      'account_number_suffix',
      'invoice_number',
      'parcel_number',
      'policy_number',
      'service_address',
      'mailing_address',
      'tenant_name',
      'property_identifiers',
      'document_date',
      'due_date',
      'service_period_start',
      'service_period_end',
      'amount_due',
      'total_amount',
      'previous_balance',
      'payment_received',
      'direction',
      'likely_category',
      'required_action',
      'action_due_date',
      'notes',
    ]
    for (const field of stringFields) {
      const sub = (schema.properties as Record<string, unknown>)[field] as Record<string, unknown>
      expect(sub.required, `${field} missing required array`).toContain('evidence')
    }
  })
})

describe('parseExtraction', () => {
  it('accepts a valid extraction with nullable evidence and nullable proposed-action fields', () => {
    const raw = {
      document_type: 'water',
      document_class: 'financial',
      requires: 'money',
      issuer: { value: 'City Water', confidence: 'high', evidence: null },
      account_number: { value: '123', confidence: 'high', evidence: 'account_number' },
      account_number_suffix: { value: null, confidence: 'low', evidence: null },
      invoice_number: { value: null, confidence: 'low', evidence: null },
      parcel_number: { value: null, confidence: 'low', evidence: null },
      policy_number: { value: null, confidence: 'low', evidence: null },
      service_address: { value: '123 Main St', confidence: 'high', evidence: 'service_address' },
      mailing_address: { value: null, confidence: 'low', evidence: null },
      tenant_name: { value: null, confidence: 'low', evidence: null },
      property_identifiers: { value: null, confidence: 'low', evidence: null },
      document_date: { value: '2026-08-01', confidence: 'high', evidence: null },
      due_date: { value: '2026-08-25', confidence: 'high', evidence: null },
      service_period_start: { value: null, confidence: 'low', evidence: null },
      service_period_end: { value: null, confidence: 'low', evidence: null },
      amount_due: { value: 134.6, confidence: 'high', evidence: null },
      total_amount: { value: 134.6, confidence: 'high', evidence: null },
      previous_balance: { value: 0, confidence: 'medium', evidence: null },
      payment_received: { value: 0, confidence: 'low', evidence: null },
      direction: { value: 'payable', confidence: 'high', evidence: null },
      likely_category: { value: 'water', confidence: 'high', evidence: null },
      required_action: { value: null, confidence: 'low', evidence: null },
      action_due_date: { value: null, confidence: 'low', evidence: null },
      notes: { value: null, confidence: 'low', evidence: null },
      proposed_actions: [
        {
          type: 'obligation',
          direction: 'payable',
          category: 'water',
          description: null,
          expected_amount: 134.6,
          due_date: '2026-08-25',
          action_due_date: null,
          period_start: null,
          period_end: null,
          title: null,
          payment_options: [],
        },
      ],
    }
    const parsed = parseExtraction(raw)
    expect(parsed).not.toBeNull()
    expect(parsed?.issuer.value).toBe('City Water')
    expect(parsed?.issuer.evidence).toBeNull()
    expect(parsed?.proposed_actions[0].title).toBeNull()
  })

  it('rejects an extraction with a missing evidence field', () => {
    const raw = {
      ...emptyExtraction(),
      issuer: { value: 'City Water', confidence: 'high' },
    }
    const parsed = parseExtraction(raw)
    expect(parsed).toBeNull()
  })

  it('rejects a proposed_action that is missing required fields', () => {
    const base = emptyExtraction()
    const raw = {
      ...base,
      proposed_actions: [{ type: 'obligation' }],
    }
    const parsed = parseExtraction(raw)
    expect(parsed).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(parseExtraction(undefined)).toBeNull()
  })

  it('accepts a legacy payment option without late_payment_terms, defaulting to an empty array', () => {
    const raw = {
      ...emptyExtraction(),
      proposed_actions: [
        {
          type: 'obligation',
          direction: 'payable',
          category: 'water',
          description: null,
          expected_amount: 100,
          due_date: '2026-08-25',
          action_due_date: null,
          period_start: null,
          period_end: null,
          title: null,
          payment_options: [
            {
              option_type: 'installment_plan',
              amount: 100,
              due_date: '2026-08-25',
              description: 'Installment plan',
              discount_amount: null,
              penalty_amount: null,
              penalty_date: null,
              installments: [
                { amount: 50, due_date: '2026-08-25', description: 'First' },
              ],
            },
          ],
        },
      ],
    }
    const parsed = parseExtraction(raw)
    expect(parsed).not.toBeNull()
    expect(parsed?.proposed_actions[0].payment_options[0].late_payment_terms).toEqual([])
    expect(parsed?.proposed_actions[0].payment_options[0].installments[0].late_payment_terms).toEqual([])
  })

  it('parses a payment option with late_payment_terms and installment late_payment_terms', () => {
    const raw = {
      ...emptyExtraction(),
      proposed_actions: [
        {
          type: 'obligation',
          direction: 'payable',
          category: 'school_tax',
          description: null,
          expected_amount: 1756.51,
          due_date: '2026-10-31',
          action_due_date: null,
          period_start: null,
          period_end: null,
          title: null,
          payment_options: [
            {
              option_type: 'full',
              amount: 1756.51,
              due_date: '2026-10-31',
              description: 'Full base payment',
              discount_amount: null,
              penalty_amount: null,
              penalty_date: null,
              late_payment_terms: [
                {
                  term_type: 'penalty',
                  amount: 1932.16,
                  rate: 0.1,
                  effective_date: '2026-10-31',
                  due_date: '2026-10-31',
                  description: 'Add 10% penalty after 10/31/2026',
                },
              ],
              installments: [],
            },
          ],
        },
      ],
    }
    const parsed = parseExtraction(raw)
    expect(parsed).not.toBeNull()
    const term = parsed?.proposed_actions[0].payment_options[0].late_payment_terms[0]
    expect(term?.term_type).toBe('penalty')
    expect(term?.rate).toBe(0.1)
    expect(term?.amount).toBe(1932.16)
  })
})
