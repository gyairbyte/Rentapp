import { createHash } from 'crypto'
import type { DocumentExtraction, DocumentMatch } from '@/lib/types'
import type { DocumentAnalysisInput } from './types'

function normalize(text: string | null | undefined): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/#/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeAddress(text: string | null | undefined): string {
  return normalize(text)
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\bavenues\b/g, 'ave')
    .replace(/\broad\b/g, 'rd')
    .replace(/\bboulevard\b/g, 'blvd')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\blane\b/g, 'ln')
    .replace(/\bcourt\b/g, 'ct')
    .replace(/\bapartment\b/g, 'apt')
    .replace(/\bunit\b/g, 'unit')
    .replace(/\bnorth\b/g, 'n')
    .replace(/\bsouth\b/g, 's')
    .replace(/\beast\b/g, 'e')
    .replace(/\bwest\b/g, 'w')
    .replace(/(\d{5})-\d{4}/g, '$1')
    .trim()
}

function addressMatchScore(addr1: string, addr2: string): number {
  const a = normalizeAddress(addr1)
  const b = normalizeAddress(addr2)
  if (!a || !b) return 0
  if (a === b) return 1

  const tokensA = a.split(' ').filter(Boolean)
  const tokensB = b.split(' ').filter(Boolean)
  const setA = new Set(tokensA)
  const setB = new Set(tokensB)

  // If one address is a subset of the other (e.g., short document address vs full property address),
  // treat it as a strong match as long as at least 3 significant tokens align.
  const intersectionA = tokensA.filter((t) => setB.has(t))
  const intersectionB = tokensB.filter((t) => setA.has(t))
  const minTokens = Math.min(tokensA.length, tokensB.length)
  if (minTokens >= 3 && intersectionA.length === minTokens) return 1
  if (minTokens >= 3 && intersectionB.length === minTokens) return 1

  // Partial match: enough shared significant tokens relative to the larger address.
  const intersection = [...setA].filter((t) => setB.has(t))
  const unionSize = new Set([...tokensA, ...tokensB]).size
  if (intersection.length >= 3 && intersection.length / unionSize >= 0.5) return 0.8
  if (intersection.length >= 2 && intersection.length / unionSize >= 0.7) return 0.8
  return 0
}

function providerNameMatch(name1: string | null | undefined, name2: string | null | undefined): boolean {
  const a = normalize(name1)
  const b = normalize(name2)
  if (!a || !b) return false
  return a.includes(b) || b.includes(a)
}

function accountProviderMatches(
  account: DocumentAnalysisInput['userAccounts'][number],
  providerName: string,
  userParties: DocumentAnalysisInput['userParties']
): boolean {
  if (!account.party_id) return false
  const party = userParties.find((p) => p.id === account.party_id)
  return party ? providerNameMatch(party.name, providerName) : false
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
        party_id: account.party_id,
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
    const matchingAccounts = input.userAccounts.filter((a) => {
      const normalizedAccountNum = normalize(a.account_number)
      const suffixMatch = normalizedAccountNum && normalizedAccountNum.endsWith(accountSuffix)
      return suffixMatch && accountProviderMatches(a, providerName, input.userParties)
    })
    if (matchingAccounts.length === 1) {
      const account = matchingAccounts[0]
      return {
        property_id: account.property_id,
        account_id: account.id,
        party_id: account.party_id,
        reason: 'Matched by provider and account-number suffix',
        confidence: 'medium',
      }
    }
  }

  // 5. Provider + account type (only when a single account belongs to that provider and matches the category)
  if (providerName) {
    const typeLabel = extraction.likely_category.value ?? extraction.document_type ?? ''
    if (typeLabel) {
      const matchingAccounts = input.userAccounts.filter((a) => {
        const typeMatches = typeLabel.toLowerCase().includes(a.account_type.toLowerCase()) || a.account_type.toLowerCase().includes(typeLabel.toLowerCase())
        return typeMatches && accountProviderMatches(a, providerName, input.userParties)
      })
      if (matchingAccounts.length === 1) {
        const account = matchingAccounts[0]
        return {
          property_id: account.property_id,
          account_id: account.id,
          party_id: account.party_id,
          reason: 'Matched by provider and single account of likely type',
          confidence: 'medium',
        }
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
