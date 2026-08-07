export type Property = {
  id: string
  user_id: string
  nickname: string
  street_address: string
  city: string
  state: string
  zip: string
  property_type: string | null
  active: boolean
  archived: boolean
  created_at: string
  updated_at: string
}

export type PropertyInsert = Omit<Property, 'id' | 'created_at' | 'updated_at'>
export type PropertyUpdate = Partial<Omit<Property, 'id' | 'user_id' | 'created_at' | 'updated_at'>>

export type Party = {
  id: string
  user_id: string
  property_id: string | null
  name: string
  party_type: string
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type PartyInsert = Omit<Party, 'id' | 'created_at' | 'updated_at' | 'property_id' | 'email' | 'phone' | 'notes'>
  & Partial<Pick<Party, 'property_id' | 'email' | 'phone' | 'notes'>>
export type PartyUpdate = Partial<Omit<Party, 'id' | 'user_id' | 'created_at' | 'updated_at'>>

export type Account = {
  id: string
  user_id: string
  property_id: string
  party_id: string | null
  account_type: string
  account_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type AccountInsert = Omit<Account, 'id' | 'created_at' | 'updated_at' | 'party_id' | 'account_number' | 'notes'>
  & Partial<Pick<Account, 'party_id' | 'account_number' | 'notes'>>
export type AccountUpdate = Partial<Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at'>>

export type RecurringRule = {
  id: string
  user_id: string
  property_id: string
  account_id: string | null
  party_id: string | null
  direction: string
  category: string
  description: string | null
  amount: number
  frequency: string
  day_of_month: number
  start_date: string
  end_date: string | null
  active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type RecurringRuleInsert = Omit<RecurringRule, 'id' | 'created_at' | 'updated_at' | 'account_id' | 'party_id' | 'description' | 'end_date' | 'notes'>
  & Partial<Pick<RecurringRule, 'account_id' | 'party_id' | 'description' | 'end_date' | 'notes'>>
export type RecurringRuleUpdate = Partial<Omit<RecurringRule, 'id' | 'user_id' | 'created_at' | 'updated_at'>>

export type Obligation = {
  id: string
  user_id: string
  property_id: string
  account_id: string | null
  party_id: string | null
  recurring_rule_id: string | null
  direction: string
  category: string
  description: string | null
  expected_amount: number
  paid_amount: number
  due_date: string
  status: string
  paid_date: string | null
  period_start: string | null
  period_end: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type ObligationInsert = Omit<Obligation, 'id' | 'created_at' | 'updated_at' | 'account_id' | 'party_id' | 'recurring_rule_id' | 'description' | 'paid_date' | 'period_start' | 'period_end' | 'notes'>
  & Partial<Pick<Obligation, 'account_id' | 'party_id' | 'recurring_rule_id' | 'description' | 'paid_date' | 'period_start' | 'period_end' | 'notes'>>
export type ObligationUpdate = Partial<Omit<Obligation, 'id' | 'user_id' | 'created_at' | 'updated_at'>>

export type Payment = {
  id: string
  user_id: string
  property_id: string
  obligation_id: string
  amount: number
  payment_date: string
  method: string | null
  confirmation_reference: string | null
  notes: string | null
  evidence_document_id: string | null
  created_at: string
  updated_at: string
}

export type PaymentInsert = Omit<Payment, 'id' | 'created_at' | 'updated_at' | 'method' | 'confirmation_reference' | 'notes' | 'evidence_document_id'>
  & Partial<Pick<Payment, 'method' | 'confirmation_reference' | 'notes' | 'evidence_document_id'>>
export type PaymentUpdate = Partial<Omit<Payment, 'id' | 'user_id' | 'created_at' | 'updated_at'>>

export type Document = {
  id: string
  user_id: string
  property_id: string | null
  storage_path: string
  original_filename: string
  mime_type: string | null
  document_type: string | null
  issuer: string | null
  document_date: string | null
  processing_status: string
  review_status: string
  raw_extracted_text: string | null
  raw_ai_extraction: string | null
  created_at: string
  updated_at: string
}

export type DocumentInsert = Omit<Document, 'id' | 'created_at' | 'updated_at' | 'property_id' | 'mime_type' | 'document_type' | 'issuer' | 'document_date' | 'raw_extracted_text' | 'raw_ai_extraction'>
  & Partial<Pick<Document, 'property_id' | 'mime_type' | 'document_type' | 'issuer' | 'document_date' | 'raw_extracted_text' | 'raw_ai_extraction'>>
export type DocumentUpdate = Partial<Omit<Document, 'id' | 'user_id' | 'created_at' | 'updated_at'>>

export type Database = {
  public: {
    Tables: {
      properties: { Row: Property; Insert: PropertyInsert; Update: PropertyUpdate; Relationships: [] }
      parties: { Row: Party; Insert: PartyInsert; Update: PartyUpdate; Relationships: [] }
      accounts: { Row: Account; Insert: AccountInsert; Update: AccountUpdate; Relationships: [] }
      recurring_rules: { Row: RecurringRule; Insert: RecurringRuleInsert; Update: RecurringRuleUpdate; Relationships: [] }
      obligations: { Row: Obligation; Insert: ObligationInsert; Update: ObligationUpdate; Relationships: [] }
      payments: { Row: Payment; Insert: PaymentInsert; Update: PaymentUpdate; Relationships: [] }
      documents: { Row: Document; Insert: DocumentInsert; Update: DocumentUpdate; Relationships: [] }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
