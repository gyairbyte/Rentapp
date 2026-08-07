import OpenAI from 'openai'
import { toFile } from 'openai/uploads'
import type { DocumentIntelligenceProvider, DocumentAnalysisInput, AnalyzedDocument } from './types'
import { emptyExtraction, parseExtraction, documentExtractionJsonSchema } from './extraction-schema'
import { findDocumentMatch } from './matching'

function getModel() {
  return process.env.DOCUMENT_AI_MODEL ?? 'gpt-5.6-terra'
}

function buildPrompt() {
  return `Analyze the attached document and extract the fields in the requested JSON schema.
Be precise. If a field is not visible or cannot be determined, use null for the value and confidence "low".
Do not invent service periods, amounts, or property information that is not shown.
For financial documents, determine the direction (payable by the property owner vs. receivable by the owner, such as rent).
Suggest the most likely Rentapp obligation category (rent, water, sewer, trash, electricity_gas, cable_internet, property_tax, school_tax, insurance, hoa, contractor_invoice, other).
If the document requires nonfinancial action, include a clear required_action and action_due_date.
List all proposed downstream actions in proposed_actions. Most documents will have one action. If a document implies both a payment and a task, include both. Use type "none" if the document does not require any action.`
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  return new OpenAI({ apiKey })
}

function isImageMime(mimeType: string) {
  return ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mimeType.toLowerCase())
}

function isPdfMime(mimeType: string) {
  return mimeType.toLowerCase() === 'application/pdf'
}

export const openaiDocumentIntelligenceProvider: DocumentIntelligenceProvider = {
  name: 'openai',

  async analyzeDocument(input: DocumentAnalysisInput): Promise<AnalyzedDocument> {
    const client = getOpenAIClient()
    const model = getModel()
    const startedAt = Date.now()

    let fileContent:
      | { type: 'input_image'; image_url: string; detail: 'auto' }
      | { type: 'input_file'; file_id: string }

    if (isImageMime(input.mimeType)) {
      const base64 = input.fileBuffer.toString('base64')
      fileContent = {
        type: 'input_image',
        image_url: `data:${input.mimeType};base64,${base64}`,
        detail: 'auto',
      }
    } else if (isPdfMime(input.mimeType)) {
      const file = await toFile(input.fileBuffer, input.filename, { type: 'application/pdf' })
      const uploaded = await client.files.create({ file, purpose: 'user_data' })
      fileContent = { type: 'input_file', file_id: uploaded.id }
    } else {
      throw new Error(`Unsupported document MIME type for AI analysis: ${input.mimeType}`)
    }

    const messageContent = [
      { type: 'input_text' as const, text: buildPrompt() },
      fileContent,
    ]

    try {
      const response = await client.responses.create({
        model,
        input: [{ role: 'user', content: messageContent }],
        text: {
          format: {
            type: 'json_schema',
            name: documentExtractionJsonSchema.name,
            schema: documentExtractionJsonSchema.schema as unknown as Record<string, unknown>,
            strict: documentExtractionJsonSchema.strict,
          },
        },
        store: false,
      })

      const durationMs = Date.now() - startedAt
      const textContent = response.output
        .flatMap((o) => (o.type === 'message' && o.role === 'assistant' ? o.content : []))
        .find((c) => c.type === 'output_text')

      let raw: unknown
      try {
        raw = JSON.parse(textContent?.text ?? '{}')
      } catch {
        raw = { rawText: textContent?.text ?? '' }
      }

      const extraction = parseExtraction(raw)
      const match = findDocumentMatch(extraction, input)

      return {
        extraction,
        match,
        provider: 'openai',
        model,
        inputTokens: response.usage?.input_tokens ?? null,
        outputTokens: response.usage?.output_tokens ?? null,
        durationMs,
        rawOutput: response,
      }
    } catch (error) {
      const durationMs = Date.now() - startedAt
      return {
        extraction: emptyExtraction(),
        match: { property_id: null, account_id: null, party_id: null, reason: 'Analysis failed', confidence: 'low' },
        provider: 'openai',
        model,
        inputTokens: null,
        outputTokens: null,
        durationMs,
        rawOutput: error instanceof Error ? { error: error.message } : { error: 'Unknown error' },
      }
    }
  },
}
