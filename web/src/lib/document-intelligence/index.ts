import { openaiDocumentIntelligenceProvider } from './openai-provider'
import { mockDocumentIntelligenceProvider } from './mock-provider'
import type { DocumentIntelligenceProvider } from './types'

const providers: Record<string, DocumentIntelligenceProvider> = {
  openai: openaiDocumentIntelligenceProvider,
  mock: mockDocumentIntelligenceProvider,
}

export function getDocumentIntelligenceProvider(name?: string): DocumentIntelligenceProvider {
  const key = name ?? 'openai'
  const provider = providers[key]
  if (!provider) {
    throw new Error(`Document intelligence provider "${key}" is not configured`)
  }
  return provider
}

export * from './types'
export * from './extraction-schema'
export * from './matching'
export * from './duplicates'
