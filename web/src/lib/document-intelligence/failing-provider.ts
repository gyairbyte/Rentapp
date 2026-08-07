import type { DocumentIntelligenceProvider, DocumentAnalysisInput, AnalyzedDocument } from './types'

export const failingDocumentIntelligenceProvider: DocumentIntelligenceProvider = {
  name: 'failing',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async analyzeDocument(_input: DocumentAnalysisInput): Promise<AnalyzedDocument> {
    throw new Error('Provider failure')
  },
}
