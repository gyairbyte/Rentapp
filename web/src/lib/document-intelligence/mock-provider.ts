import type { DocumentIntelligenceProvider, DocumentAnalysisInput, AnalyzedDocument } from './types'
import { findDocumentMatch } from './matching'
import { emptyExtraction } from './extraction-schema'

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
      issuer: { value: 'City Water Department', confidence: 'high' as const, evidence: 'letterhead' },
      account_number: { value: account?.account_number ?? '3928292', confidence: 'high' as const },
      account_number_suffix: { value: null, confidence: 'low' as const },
      invoice_number: { value: null, confidence: 'low' as const },
      parcel_number: { value: null, confidence: 'low' as const },
      policy_number: { value: null, confidence: 'low' as const },
      service_address: { value: address, confidence: 'high' as const },
      mailing_address: { value: null, confidence: 'low' as const },
      tenant_name: { value: null, confidence: 'low' as const },
      property_identifiers: { value: property?.nickname ?? null, confidence: 'medium' as const },
      document_date: { value: '2026-08-01', confidence: 'high' as const },
      due_date: { value: '2026-08-25', confidence: 'high' as const },
      service_period_start: { value: '2026-07-01', confidence: 'medium' as const },
      service_period_end: { value: '2026-07-31', confidence: 'medium' as const },
      amount_due: { value: 134.6, confidence: 'high' as const },
      total_amount: { value: 134.6, confidence: 'high' as const },
      previous_balance: { value: 0, confidence: 'medium' as const },
      payment_received: { value: 0, confidence: 'low' as const },
      direction: { value: 'payable' as const, confidence: 'high' as const },
      likely_category: { value: 'water', confidence: 'high' as const },
      required_action: { value: null, confidence: 'low' as const },
      action_due_date: { value: null, confidence: 'low' as const },
      notes: { value: null, confidence: 'low' as const },
      proposed_actions: [
        { type: 'obligation' as const, direction: 'payable' as const, category: 'water', expected_amount: 134.6, due_date: '2026-08-25', period_start: '2026-07-01', period_end: '2026-07-31' },
      ],
    }
  }

  if (name.includes('electric')) {
    return {
      document_type: 'electric',
      document_class: 'financial' as const,
      requires: 'money' as const,
      issuer: { value: 'Power Electric Co', confidence: 'high' as const },
      account_number: { value: account?.account_number ?? 'E-8833', confidence: 'high' as const },
      account_number_suffix: { value: null, confidence: 'low' as const },
      invoice_number: { value: null, confidence: 'low' as const },
      parcel_number: { value: null, confidence: 'low' as const },
      policy_number: { value: null, confidence: 'low' as const },
      service_address: { value: address, confidence: 'high' as const },
      mailing_address: { value: null, confidence: 'low' as const },
      tenant_name: { value: null, confidence: 'low' as const },
      property_identifiers: { value: property?.nickname ?? null, confidence: 'medium' as const },
      document_date: { value: '2026-08-05', confidence: 'high' as const },
      due_date: { value: '2026-08-30', confidence: 'high' as const },
      service_period_start: { value: null, confidence: 'low' as const },
      service_period_end: { value: null, confidence: 'low' as const },
      amount_due: { value: 89.99, confidence: 'high' as const },
      total_amount: { value: 89.99, confidence: 'high' as const },
      previous_balance: { value: 0, confidence: 'low' as const },
      payment_received: { value: 0, confidence: 'low' as const },
      direction: { value: 'payable' as const, confidence: 'high' as const },
      likely_category: { value: 'electricity_gas', confidence: 'high' as const },
      required_action: { value: null, confidence: 'low' as const },
      action_due_date: { value: null, confidence: 'low' as const },
      notes: { value: null, confidence: 'low' as const },
      proposed_actions: [
        { type: 'obligation' as const, direction: 'payable' as const, category: 'electricity_gas', expected_amount: 89.99, due_date: '2026-08-30' },
      ],
    }
  }

  if (name.includes('notice') || name.includes('letter')) {
    return {
      document_type: 'general_letter',
      document_class: 'operational' as const,
      requires: 'action' as const,
      issuer: { value: 'City Inspection Office', confidence: 'high' as const },
      account_number: { value: null, confidence: 'low' as const },
      account_number_suffix: { value: null, confidence: 'low' as const },
      invoice_number: { value: null, confidence: 'low' as const },
      parcel_number: { value: null, confidence: 'low' as const },
      policy_number: { value: null, confidence: 'low' as const },
      service_address: { value: address, confidence: 'medium' as const },
      mailing_address: { value: null, confidence: 'low' as const },
      tenant_name: { value: null, confidence: 'low' as const },
      property_identifiers: { value: property?.nickname ?? null, confidence: 'medium' as const },
      document_date: { value: '2026-08-02', confidence: 'high' as const },
      due_date: { value: '2026-08-20', confidence: 'medium' as const },
      service_period_start: { value: null, confidence: 'low' as const },
      service_period_end: { value: null, confidence: 'low' as const },
      amount_due: { value: null, confidence: 'low' as const },
      total_amount: { value: null, confidence: 'low' as const },
      previous_balance: { value: null, confidence: 'low' as const },
      payment_received: { value: null, confidence: 'low' as const },
      direction: { value: null, confidence: 'low' as const },
      likely_category: { value: 'other', confidence: 'low' as const },
      required_action: { value: 'Submit rental inspection form', confidence: 'high' as const },
      action_due_date: { value: '2026-09-15', confidence: 'high' as const },
      notes: { value: null, confidence: 'low' as const },
      proposed_actions: [
        { type: 'task' as const, title: 'Submit rental inspection form', action_due_date: '2026-09-15' },
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
