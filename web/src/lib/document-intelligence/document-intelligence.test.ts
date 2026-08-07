import { describe, it, expect } from 'vitest'
import { findDocumentMatch, hashFileBuffer } from './matching'
import { detectSemanticDuplicates } from './duplicates'
import { mockDocumentIntelligenceProvider } from './mock-provider'
import { failingDocumentIntelligenceProvider } from './failing-provider'
import { emptyExtraction } from './extraction-schema'
import type { DocumentExtraction } from '@/lib/types'

const properties = [
  { id: 'p-1', nickname: '123 Main', street_address: '123 Main Street', city: 'Springfield', state: 'IL', zip: '62704' },
  { id: 'p-2', nickname: 'Walton', street_address: '78 Walton Avenue', city: 'Springfield', state: 'IL', zip: '62704' },
  { id: 'p-bergen', nickname: 'Fountain Hill', street_address: '610 S Bergen Street', city: 'Fountain Hill', state: 'PA', zip: '18015' },
]

const accounts = [
  { id: 'a-1', property_id: 'p-1', account_type: 'water', account_number: '3928292', party_id: 'pt-1' },
  { id: 'a-2', property_id: 'p-1', account_type: 'electricity_gas', account_number: 'E-8833', party_id: 'pt-3' },
  { id: 'a-3', property_id: 'p-2', account_type: 'water', account_number: '999292', party_id: 'pt-4' },
  { id: 'a-4', property_id: 'p-1', account_type: 'water', account_number: '4928292', party_id: 'pt-2' },
]

const parties = [
  { id: 'pt-1', property_id: 'p-1', name: 'City Water Department', party_type: 'utility_provider' },
  { id: 'pt-2', property_id: null, name: 'Generic Contractor', party_type: 'contractor' },
  { id: 'pt-3', property_id: 'p-1', name: 'Power Electric Co', party_type: 'utility_provider' },
  { id: 'pt-4', property_id: 'p-2', name: 'Springfield Water', party_type: 'utility_provider' },
]

function makeExtraction(overrides: Partial<DocumentExtraction> = {}): DocumentExtraction {
  return { ...emptyExtraction(), ...overrides }
}

function field<T>(value: T, confidence: 'high' | 'medium' | 'low' = 'low') {
  return { value, confidence, evidence: null }
}

function makeInput(overrides: Partial<Parameters<typeof findDocumentMatch>[1]> = {}): Parameters<typeof findDocumentMatch>[1] {
  return {
    fileBuffer: Buffer.from(''),
    mimeType: 'application/pdf',
    filename: 'doc.pdf',
    userProperties: properties,
    userAccounts: accounts,
    userParties: parties,
    ...overrides,
  }
}

describe('Document matching', () => {
  it('matches by exact account number', () => {
    const extraction = makeExtraction({
      account_number: field('3928292', 'high'),
      issuer: field('City Water Department', 'high'),
      service_address: field(null),
    })
    const match = findDocumentMatch(extraction, makeInput())
    expect(match.property_id).toBe('p-1')
    expect(match.account_id).toBe('a-1')
    expect(match.party_id).toBe('pt-1')
    expect(match.confidence).toBe('high')
  })

  it('matches by property address when no account number is given', () => {
    const extraction = makeExtraction({
      service_address: field('123 Main St, Springfield, IL 62704', 'high'),
      issuer: field('City Water Department', 'high'),
    })
    const match = findDocumentMatch(extraction, makeInput())
    expect(match.property_id).toBe('p-1')
    expect(match.confidence).toBe('high')
  })

  it('flags uncertain match when address is missing or ambiguous', () => {
    const extraction = makeExtraction({ issuer: field('Unknown Provider', 'low') })
    const match = findDocumentMatch(extraction, makeInput())
    expect(match.property_id).toBeNull()
    expect(match.confidence).toBe('low')
  })

  it('matches by provider party name as a fallback', () => {
    const extraction = makeExtraction({ issuer: field('City Water Department', 'medium'), account_number: field(null, 'low') })
    const match = findDocumentMatch(extraction, makeInput())
    expect(match.property_id).toBe('p-1')
    expect(match.party_id).toBe('pt-1')
    expect(match.confidence).toBe('low')
  })

  it('matches by provider + account-number suffix and validates provider', () => {
    // Two accounts share the suffix "292" but only a-1 belongs to City Water Department.
    const extraction = makeExtraction({
      issuer: field('City Water Department', 'medium'),
      account_number: field(null, 'low'),
      account_number_suffix: field('292', 'medium'),
    })
    const match = findDocumentMatch(extraction, makeInput())
    expect(match.property_id).toBe('p-1')
    expect(match.account_id).toBe('a-1')
    expect(match.confidence).toBe('medium')
  })

  it('does not select an arbitrary suffix match when provider does not match', () => {
    // a-3 and a-4 share suffix "292" but neither belongs to the unmatched provider.
    const extraction = makeExtraction({
      issuer: field('Acme Utilities', 'medium'),
      account_number_suffix: field('292', 'medium'),
    })
    const match = findDocumentMatch(extraction, makeInput())
    expect(match.account_id).toBeNull()
  })

  it('matches by provider + account type and validates provider', () => {
    const extraction = makeExtraction({
      issuer: field('City Water Department', 'medium'),
      likely_category: field('water', 'medium'),
    })
    const match = findDocumentMatch(extraction, makeInput())
    expect(match.account_id).toBe('a-1')
    expect(match.confidence).toBe('medium')
  })

  it('does not match by account type alone when provider is ambiguous', () => {
    // Remove party links so provider cannot be validated.
    const extraction = makeExtraction({
      issuer: field('City Water Department', 'medium'),
      likely_category: field('water', 'medium'),
    })
    const accountsWithoutParties = accounts.map((a) => ({ ...a, party_id: null as string | null }))
    const match = findDocumentMatch(extraction, makeInput({ userAccounts: accountsWithoutParties }))
    expect(match.account_id).toBeNull()
  })

  it.each([
    ['610 S Bergen, Fountain Hill, PA 18015', 'p-bergen'],
    ['610 South Bergen Street, Fountain Hill, PA 18015', 'p-bergen'],
    ['610 S. Bergen St., Fountain Hill, Pennsylvania 18015', 'p-bergen'],
    ['610 S BERGEN ST, FOUNTAIN HILL, PA 18015-1234', 'p-bergen'],
  ])('matches an exact normalized address with high confidence: %s', (address, expectedPropertyId) => {
    const extraction = makeExtraction({
      service_address: field(address, 'high'),
    })
    const match = findDocumentMatch(extraction, makeInput({ userProperties: properties }))
    expect(match.property_id).toBe(expectedPropertyId)
    expect(match.confidence).toBe('high')
  })
})

describe('File duplicate detection', () => {
  it('hashes identical buffers to the same value', () => {
    const a = hashFileBuffer(Buffer.from('same'))
    const b = hashFileBuffer(Buffer.from('same'))
    expect(a).toBe(b)
    expect(a).toHaveLength(64)
  })

  it('hashes different buffers to different values', () => {
    const a = hashFileBuffer(Buffer.from('a'))
    const b = hashFileBuffer(Buffer.from('b'))
    expect(a).not.toBe(b)
  })
})

describe('Semantic duplicate detection', () => {
  it('warns about same provider, account, and statement date', () => {
    const extraction = makeExtraction({
      issuer: field('City Water Department', 'high'),
      account_number: field('3928292', 'high'),
      document_date: field('2026-08-01', 'high'),
      amount_due: field(134.6, 'high'),
      due_date: field('2026-08-25', 'high'),
    })
    const candidates = [
      { id: 'd-1', original_filename: 'water_august.pdf', user_id: 'u-1', property_id: 'p-1', account_id: 'a-1', account_number: '3928292', issuer: 'City Water Department', document_date: '2026-08-01', amount_due: 134.6, due_date: '2026-08-25', invoice_number: null },
      { id: 'd-2', original_filename: 'water_july.pdf', user_id: 'u-1', property_id: 'p-1', account_id: 'a-1', account_number: '3928292', issuer: 'City Water Department', document_date: '2026-07-01', amount_due: 128, due_date: '2026-07-25', invoice_number: null },
    ]
    const duplicates = detectSemanticDuplicates(extraction, candidates, 'p-1')
    expect(duplicates).toHaveLength(1)
    expect(duplicates[0].candidate.id).toBe('d-1')
    expect(duplicates[0].confidence).toBe('high')
  })

  it('warns about same invoice number', () => {
    const extraction = makeExtraction({ invoice_number: field('INV-99', 'high') })
    const candidates = [
      { id: 'd-1', original_filename: 'invoice.pdf', user_id: 'u-1', property_id: 'p-1', account_id: null, account_number: null, issuer: 'Contractor', document_date: '2026-08-01', amount_due: 500, due_date: '2026-08-15', invoice_number: 'INV-99' },
    ]
    const duplicates = detectSemanticDuplicates(extraction, candidates, 'p-1')
    expect(duplicates).toHaveLength(1)
  })

  it('warns about same property, amount, and due date', () => {
    const extraction = makeExtraction({
      issuer: field('Contractor', 'high'),
      amount_due: field(500, 'high'),
      due_date: field('2026-08-15', 'high'),
    })
    const candidates = [
      { id: 'd-1', original_filename: 'contractor.pdf', user_id: 'u-1', property_id: 'p-1', account_id: null, account_number: null, issuer: 'Contractor', document_date: '2026-08-01', amount_due: 500, due_date: '2026-08-15', invoice_number: null },
    ]
    const duplicates = detectSemanticDuplicates(extraction, candidates, 'p-1')
    expect(duplicates).toHaveLength(1)
    expect(duplicates[0].confidence).toBe('medium')
  })

  it('does not flag the same amount and due date across different properties', () => {
    const extraction = makeExtraction({
      issuer: field('Contractor', 'high'),
      amount_due: field(500, 'high'),
      due_date: field('2026-08-15', 'high'),
    })
    const candidates = [
      { id: 'd-1', original_filename: 'p2_contractor.pdf', user_id: 'u-1', property_id: 'p-2', account_id: null, account_number: null, issuer: 'Contractor', document_date: '2026-08-01', amount_due: 500, due_date: '2026-08-15', invoice_number: null },
    ]
    const duplicates = detectSemanticDuplicates(extraction, candidates, 'p-1')
    expect(duplicates).toHaveLength(0)
  })

  it('does not fabricate duplicates when fields are null', () => {
    const extraction = emptyExtraction()
    const candidates = [
      { id: 'd-1', original_filename: 'unknown.pdf', user_id: 'u-1', property_id: null, account_id: null, account_number: null, issuer: null, document_date: null, amount_due: null, due_date: null, invoice_number: null },
    ]
    const duplicates = detectSemanticDuplicates(extraction, candidates, null)
    expect(duplicates).toHaveLength(0)
  })
})

describe('Mock AI provider', () => {
  it('returns a water bill extraction with a match', async () => {
    const provider = mockDocumentIntelligenceProvider
    const input = {
      fileBuffer: Buffer.from('water bill'),
      mimeType: 'application/pdf',
      filename: 'august_water.pdf',
      userProperties: properties,
      userAccounts: accounts,
      userParties: parties,
    }
    const result = await provider.analyzeDocument(input)
    expect(result.extraction.document_type).toBe('water')
    expect(result.extraction.amount_due.value).toBe(134.6)
    expect(result.match.property_id).toBe('p-1')
    expect(result.provider).toBe('mock')
  })

  it('does not fabricate values for an unknown fixture', async () => {
    const provider = mockDocumentIntelligenceProvider
    const input = {
      fileBuffer: Buffer.from('random'),
      mimeType: 'application/pdf',
      filename: 'garbage.bin',
      userProperties: properties,
      userAccounts: accounts,
      userParties: parties,
    }
    const result = await provider.analyzeDocument(input)
    expect(result.extraction.document_type).toBeNull()
    expect(result.match.confidence).toBe('low')
  })
})

describe('Provider failure handling', () => {
  it('propagates a provider error instead of returning an empty extraction', async () => {
    const provider = failingDocumentIntelligenceProvider
    const input = makeInput()
    await expect(provider.analyzeDocument(input)).rejects.toThrow('Provider failure')
  })
})

describe('Payment options extraction', () => {
  it('extracts a school tax notice with document, issuer, parcel, property match, and genuine payment choices', async () => {
    const provider = mockDocumentIntelligenceProvider
    const bergenProperties = properties.filter((p) => p.id === 'p-bergen')
    const input = {
      fileBuffer: Buffer.from('tax notice'),
      mimeType: 'application/pdf',
      filename: 'Bethlehem_Area_School_District_2026_2027_tax_notice.pdf',
      userProperties: bergenProperties,
      userAccounts: accounts,
      userParties: parties,
    }
    const result = await provider.analyzeDocument(input)
    expect(result.extraction.document_type).toBe('school_tax')
    expect(result.extraction.issuer.value).toBe('Bethlehem Area School District')
    expect(result.extraction.parcel_number.value).toBe('642702833391')
    expect(result.match.property_id).toBe('p-bergen')
    expect(result.match.confidence).toBe('high')

    const proposedObligation = result.extraction.proposed_actions.find((a) => a.type === 'obligation')
    expect(proposedObligation).toBeDefined()
    expect(proposedObligation!.payment_options).toHaveLength(3)

    const selectable = proposedObligation!.payment_options.filter(
      (o) => ['full', 'discounted', 'installment_plan'].includes(o.option_type)
    )
    expect(selectable).toHaveLength(3)

    const discount = proposedObligation!.payment_options.find((o) => o.option_type === 'discounted')
    expect(discount).toBeDefined()
    expect(discount!.due_date).toBe('2026-08-31')
    expect(discount!.amount).toBe(1703.81)

    const full = proposedObligation!.payment_options.find((o) => o.option_type === 'full')
    expect(full).toBeDefined()
    expect(full!.due_date).toBe('2026-10-31')
    expect(full!.amount).toBe(1756.51)
    expect(full!.late_payment_terms.length).toBeGreaterThan(0)
    const penalty = full!.late_payment_terms.find((t) => t.term_type === 'penalty')
    expect(penalty).toBeDefined()
    expect(penalty!.rate).toBe(0.1)
    expect(penalty!.amount).toBe(1932.16)

    const installment = proposedObligation!.payment_options.find((o) => o.option_type === 'installment_plan')
    expect(installment).toBeDefined()
    expect(installment!.installments).toHaveLength(4)
    expect(installment!.installments[0].due_date).toBe('2026-08-03')
    expect(installment!.installments[3].due_date).toBe('2026-12-07')
    expect(installment!.installments.every((inst) => Array.isArray(inst.late_payment_terms))).toBe(true)
  })
})
