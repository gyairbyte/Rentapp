import { createHash } from 'crypto'
import type { DocumentExtraction, DocumentMatch } from '@/lib/types'
import type { DocumentAnalysisInput } from './types'

function normalize(text: string | null | undefined): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/#/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeAddress(text: string | null | undefined): string {
  return normalize(text)
    .replace(/street/g, 'st')
    .replace(/avenue/g, 'ave')
    .replace(/road/g, 'rd')
    .replace(/boulevard/g, 'blvd')
    .replace(/drive/g, 'dr')
    .replace(/lane/g, 'ln')
    .replace(/court/g, 'ct')
    .replace(/apartment/g, 'apt')
    .replace(/unit/g, 'unit')
    .replace(/north/g, 'n')
    .replace(/south/g, 's')
    .replace(/east/g, 'e')
    .replace(/west/g, 'w')
    .trim()
}

function addressMatchScore(addr1: string, addr2: string): number {
  const a = normalizeAddress(addr1)
  const b = normalizeAddress(addr2)
  if (!a || !b) return 0
  if (a === b) return 1
  // Both contain same significant tokens in any order
  const tokensA = new Set(a.split(' ').filter(Boolean))
  const tokensB = b.split(' ').filter(Boolean)
  const intersection = tokensB.filter((t) => tokensA.has(t))
  if (intersection.length >= 3 && intersection.length / Math.max(tokensA.size, tokensB.length) >= 0.6) return 0.8
  return 0
}

function providerNameMatch(name1: string | null | undefined, name2: string | null | undefined): boolean {
  const a = normalize(name1)
  const b = normalize(name2)
  if (!a || !b) return false
  return a.includes(b) || b.includes(a)
}

export function findDocumentMatch(
  extraction: DocumentExtraction,
  input: DocumentAnalysisInput
): DocumentMatch {
  const serviceAddress = extraction.service_address.value ?? extraction.mailing_address.value ?? extraction.property_identifiers.value
  const providerName = extraction.issuer.value
  const accountNumber = normalize(extraction.account_number.value)
  const accountSuffix = normalize(extraction.account_number_suffix.value)
  const invoiceNumber = normalize(extraction.invoice_number.value)
  const parcelNumber = normalize(extraction.parcel_number.value)
  const policyNumber = normalize(extraction.policy_number.value)

  // 1. Exact known account number
  if (accountNumber) {
    const account = input.userAccounts.find((a) => normalize(a.account_number) === accountNumber)
    if (account) {
      return {
        property_id: account.property_id,
        account_id: account.id,
        party_id: null,
        reason: 'Matched by exact account number',
        confidence: 'high',
      }
    }
  }

  // 2. Exact parcel / policy / invoice identifier on document tied to party/provider
  if (parcelNumber || policyNumber || invoiceNumber) {
    // Not yet stored on parties/accounts in the schema, so fall through.
  }

  // 3. Exact normalized service/property address
  if (serviceAddress) {
    const property = input.userProperties.find((p) => addressMatchScore(serviceAddress, `${p.street_address}, ${p.city}, ${p.state} ${p.zip}`) >= 0.8)
    if (property) {
      return {
        property_id: property.id,
        account_id: null,
        party_id: null,
        reason: 'Matched by property address',
        confidence: 'high',
      }
    }
  }

  // 4. Provider + account-number suffix
  if (providerName && accountSuffix) {
    const account = input.userAccounts.find((a) => {
      const normalizedAccountNum = normalize(a.account_number)
      const suffixMatch = normalizedAccountNum && normalizedAccountNum.endsWith(accountSuffix)
      return suffixMatch
    })
    if (account) {
      return {
        property_id: account.property_id,
        account_id: account.id,
        party_id: null,
        reason: 'Matched by provider and account-number suffix',
        confidence: 'medium',
      }
    }
  }

  // 5. Provider + any account of matching type
  if (providerName) {
    const matchingTypeAccounts = input.userAccounts.filter((a) => {
      const typeLabel = extraction.likely_category.value ?? extraction.document_type ?? ''
      return typeLabel.toLowerCase().includes(a.account_type.toLowerCase()) || a.account_type.toLowerCase().includes(typeLabel.toLowerCase())
    })
    if (matchingTypeAccounts.length === 1) {
      return {
        property_id: matchingTypeAccounts[0].property_id,
        account_id: matchingTypeAccounts[0].id,
        party_id: null,
        reason: 'Matched by provider and single account of likely type',
        confidence: 'medium',
      }
    }
  }

  // 6. Strong address match (lower threshold)
  if (serviceAddress) {
    const property = input.userProperties.find((p) => addressMatchScore(serviceAddress, `${p.street_address}, ${p.city}, ${p.state} ${p.zip}`) >= 0.5)
    if (property) {
      return {
        property_id: property.id,
        account_id: null,
        party_id: null,
        reason: 'Matched by partial address',
        confidence: 'medium',
      }
    }
  }

  // 7. Tenant/provider relationship by name
  if (providerName) {
    const party = input.userParties.find((p) => providerNameMatch(p.name, providerName))
    if (party?.property_id) {
      return {
        property_id: party.property_id,
        account_id: null,
        party_id: party.id,
        reason: 'Matched by provider/party name',
        confidence: 'low',
      }
    }
  }

  // 8. AI-suggested property is not available in the current schema; return unresolved.
  return {
    property_id: null,
    account_id: null,
    party_id: null,
    reason: 'Could not confidently match to a property or account',
    confidence: 'low',
  }
}

export function hashFileBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}
