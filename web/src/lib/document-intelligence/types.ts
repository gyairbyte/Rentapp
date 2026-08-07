import type { DocumentExtraction, DocumentMatch } from '@/lib/types'

export type AnalyzedDocument = {
  extraction: DocumentExtraction
  match: DocumentMatch
  provider: string
  model: string
  inputTokens: number | null
  outputTokens: number | null
  durationMs: number | null
  rawOutput: unknown
}

export type DocumentAnalysisInput = {
  fileBuffer: Buffer
  mimeType: string
  filename: string
  userProperties: {
    id: string
    nickname: string
    street_address: string
    city: string
    state: string
    zip: string
  }[]
  userAccounts: {
    id: string
    property_id: string
    account_type: string
    account_number: string | null
    party_id: string | null
  }[]
  userParties: {
    id: string
    property_id: string | null
    name: string
    party_type: string
  }[]
}

export interface DocumentIntelligenceProvider {
  name: string
  analyzeDocument(input: DocumentAnalysisInput): Promise<AnalyzedDocument>
}
