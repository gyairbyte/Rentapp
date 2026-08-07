import OpenAI from 'openai'
import type { DocumentIntelligenceProvider, DocumentAnalysisInput, AnalyzedDocument } from './types'
import { parseExtraction, documentExtractionJsonSchema } from './extraction-schema'
import { findDocumentMatch } from './matching'

function getModel() {
  return process.env.DOCUMENT_AI_MODEL ?? 'gpt-4.1'
}

function buildPrompt() {
  return `Analyze the attached document and extract the fields in the requested JSON schema.
Be precise. If a field is not visible or cannot be determined, use null for the value and confidence "low".
Do not invent service periods, amounts, or property information that is not shown.
For financial documents, determine the direction (payable by the property owner vs. receivable by the owner, such as rent).
Suggest the most likely Rentapp obligation category (rent, water, sewer, trash, electricity_gas, cable_internet, property_tax, school_tax, insurance, hoa, contractor_invoice, other).
If the document requires nonfinancial action, include a clear required_action and action_due_date.
List all proposed downstream actions in proposed_actions. Most documents will have one action. If a document implies both a payment and a task, include both. Use type "none" if the document does not require any action.
If a financial document offers multiple payment deadlines or options (for example: a discounted full-payment deadline, a base full-payment deadline, or an installment plan with multiple payments), represent every genuine selectable payment path in the obligation action's payment_options array. Allowed payment option types are "full", "discounted", and "installment_plan". Each option must include option_type, amount, due_date, description, discount_amount, penalty_amount, penalty_date, late_payment_terms, and an installments array for installment plans.
Late fees, penalties, and conditional post-deadline amounts are not selectable payment options. Do not create a payment_options entry for a penalty or late fee. Instead, capture that information as late_payment_terms on the related base/full, discounted, or installment option. Each term should include term_type (penalty, late_fee, discount, or other), amount, rate (e.g. 0.10 for 10%), effective_date, due_date, and description. Do not collapse a multi-deadline notice into a single due date.`
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

    let fileContent: OpenAI.Responses.ResponseInputContent

    if (isImageMime(input.mimeType)) {
      const base64 = input.fileBuffer.toString('base64')
      fileContent = {
        type: 'input_image',
        image_url: `data:${input.mimeType};base64,${base64}`,
        detail: 'auto',
      }
    } else if (isPdfMime(input.mimeType)) {
      const base64 = input.fileBuffer.toString('base64')
      fileContent = {
        type: 'input_file',
        filename: input.filename,
        file_data: `data:${input.mimeType};base64,${base64}`,
        detail: 'auto',
      }
    } else {
      throw new Error(`Unsupported document MIME type for AI analysis: ${input.mimeType}`)
    }

    const response = await client.responses.create({
      model,
      input: [{ role: 'user', content: [{ type: 'input_text' as const, text: buildPrompt() }, fileContent] }],
      text: {
        format: {
          type: 'json_schema',
          name: documentExtractionJsonSchema.name,
          schema: documentExtractionJsonSchema.schema as Record<string, unknown>,
          strict: documentExtractionJsonSchema.strict,
        },
      },
      store: false,
    })

    const durationMs = Date.now() - startedAt

    if (response.error) {
      throw new Error(`OpenAI response error: ${response.error.message || 'unknown'}`)
    }

    const rawText = response.output_text
    if (!rawText) {
      throw new Error('OpenAI returned no structured output text')
    }

    let raw: unknown
    try {
      raw = JSON.parse(rawText)
    } catch {
      throw new Error('OpenAI response was not valid JSON')
    }

    const parsed = parseExtraction(raw)
    if (!parsed) {
      throw new Error('Could not parse structured extraction from OpenAI response')
    }

    const match = findDocumentMatch(parsed, input)

    return {
      extraction: parsed,
      match,
      provider: 'openai',
      model,
      inputTokens: response.usage?.input_tokens ?? null,
      outputTokens: response.usage?.output_tokens ?? null,
      durationMs,
      rawOutput: response,
    }
  },
}
