import type { DocumentExtraction } from '@/lib/types'

export type DuplicateCandidate = {
  id: string
  original_filename: string
  user_id: string
  property_id: string | null
  account_id: string | null
  account_number: string | null
  issuer: string | null
  document_date: string | null
  amount_due: number | null
  due_date: string | null
  invoice_number: string | null
}

export type DuplicateResult = {
  candidate: DuplicateCandidate
  reason: string
  confidence: 'high' | 'medium' | 'low'
}

function normalize(text: string | null | undefined): string {
  return (text ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function sameValue(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalize(a) === normalize(b) && normalize(a).length > 0
}

export function detectSemanticDuplicates(
  extraction: DocumentExtraction,
  candidates: DuplicateCandidate[],
  documentPropertyId: string | null
): DuplicateResult[] {
  const matches: DuplicateResult[] = []

  const provider = normalize(extraction.issuer.value)
  const accountNumber = normalize(extraction.account_number.value)
  const invoiceNumber = normalize(extraction.invoice_number.value)
  const documentDate = extraction.document_date.value
  const amountDue = extraction.amount_due.value
  const dueDate = extraction.due_date.value

  for (const candidate of candidates) {
    const candidateProvider = normalize(candidate.issuer)
    const candidateAccount = normalize(candidate.account_number)
    const candidateInvoice = normalize(candidate.invoice_number)

    // provider + account + statement date
    if (provider && candidateProvider && sameValue(provider, candidateProvider) && accountNumber && sameValue(accountNumber, candidateAccount) && sameValue(documentDate, candidate.document_date)) {
      matches.push({ candidate, reason: 'Same provider, account, and statement date', confidence: 'high' })
      continue
    }

    // provider + invoice number
    if (invoiceNumber && candidateInvoice && sameValue(invoiceNumber, candidateInvoice)) {
      matches.push({ candidate, reason: 'Same invoice number', confidence: 'high' })
      continue
    }

    // property + amount + due date
    if (
      documentPropertyId &&
      candidate.property_id === documentPropertyId &&
      sameValue(dueDate, candidate.due_date) &&
      amountDue !== null &&
      candidate.amount_due !== null &&
      amountDue === candidate.amount_due
    ) {
      matches.push({ candidate, reason: 'Same property, amount, and due date', confidence: 'medium' })
      continue
    }
  }

  return matches
}
