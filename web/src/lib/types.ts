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
  source_document_id: string | null
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

export type ObligationInsert = Omit<Obligation, 'id' | 'created_at' | 'updated_at' | 'account_id' | 'party_id' | 'recurring_rule_id' | 'source_document_id' | 'description' | 'paid_date' | 'period_start' | 'period_end' | 'notes'>
  & Partial<Pick<Obligation, 'account_id' | 'party_id' | 'recurring_rule_id' | 'source_document_id' | 'description' | 'paid_date' | 'period_start' | 'period_end' | 'notes'>>
export type ObligationUpdate = Partial<Omit<Obligation, 'id' | 'user_id' | 'created_at' | 'updated_at'>>

export type Payment = {
  id: string
  user_id: string
  property_id: string
  obligation_id: string
  evidence_document_id: string | null
  amount: number
  payment_date: string
  method: string | null
  confirmation_reference: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type PaymentInsert = Omit<Payment, 'id' | 'created_at' | 'updated_at' | 'method' | 'confirmation_reference' | 'notes' | 'evidence_document_id'>
  & Partial<Pick<Payment, 'method' | 'confirmation_reference' | 'notes' | 'evidence_document_id'>>
export type PaymentUpdate = Partial<Omit<Payment, 'id' | 'user_id' | 'created_at' | 'updated_at'>>

export type DocumentProcessingRun = {
  id: string
  user_id: string
  document_id: string
  provider: string
  model: string
  started_at: string
  completed_at: string | null
  status: string
  input_tokens: number | null
  output_tokens: number | null
  duration_ms: number | null
  normalized_extraction: DocumentExtraction | null
  raw_output: unknown | null
  extracted_text: string | null
  error_message: string | null
  created_at: string
}

export type DocumentProcessingRunInsert = {
  user_id: string
  document_id: string
  provider: string
  model: string
  status: string
  input_tokens?: number | null
  output_tokens?: number | null
  duration_ms?: number | null
  normalized_extraction?: DocumentExtraction | null
  raw_output?: unknown | null
  extracted_text?: string | null
  error_message?: string | null
}

export type Task = {
  id: string
  user_id: string
  property_id: string | null
  party_id: string | null
  source_document_id: string | null
  title: string
  description: string | null
  due_date: string | null
  status: string
  priority: string | null
  created_at: string
  updated_at: string
}

export type TaskInsert = Omit<Task, 'id' | 'created_at' | 'updated_at' | 'property_id' | 'party_id' | 'source_document_id' | 'description' | 'due_date' | 'priority'>
  & Partial<Pick<Task, 'property_id' | 'party_id' | 'source_document_id' | 'description' | 'due_date' | 'priority'>>
export type TaskUpdate = Partial<Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>>

export type Document = {
  id: string
  user_id: string
  property_id: string | null
  account_id: string | null
  party_id: string | null
  storage_path: string
  original_filename: string
  file_hash: string | null
  file_size: number | null
  mime_type: string | null
  document_type: string | null
  issuer: string | null
  document_date: string | null
  processing_status: string
  review_status: string
  processing_error: string | null
  confirmed_obligation_id: string | null
  confirmed_task_id: string | null
  duplicate_of_document_id: string | null
  raw_extracted_text: string | null
  raw_ai_extraction: string | null
  created_at: string
  updated_at: string
}

export type DocumentInsert = Omit<Document, 'id' | 'created_at' | 'updated_at' | 'property_id' | 'account_id' | 'party_id' | 'mime_type' | 'document_type' | 'issuer' | 'document_date' | 'file_hash' | 'file_size' | 'processing_error' | 'confirmed_obligation_id' | 'confirmed_task_id' | 'duplicate_of_document_id' | 'raw_extracted_text' | 'raw_ai_extraction'>
  & Partial<Pick<Document, 'property_id' | 'account_id' | 'party_id' | 'mime_type' | 'document_type' | 'issuer' | 'document_date' | 'file_hash' | 'file_size' | 'processing_error' | 'confirmed_obligation_id' | 'confirmed_task_id' | 'duplicate_of_document_id' | 'raw_extracted_text' | 'raw_ai_extraction'>>
export type DocumentUpdate = Partial<Omit<Document, 'id' | 'user_id' | 'created_at' | 'updated_at'>>

export type Confidence = 'high' | 'medium' | 'low'

export type ExtractedField<T = string | number | null> = {
  value: T
  confidence: Confidence
  evidence?: string | null
}

export type ProposedAction = {
  type: 'obligation' | 'task' | 'none'
  direction?: 'payable' | 'receivable' | null
  category?: string | null
  description?: string | null
  expected_amount?: number | null
  due_date?: string | null
  action_due_date?: string | null
  period_start?: string | null
  period_end?: string | null
  title?: string | null
}

export type DocumentExtraction = {
  document_type: string | null
  document_class: 'financial' | 'operational' | 'tenant' | 'legal' | 'other' | null
  requires: 'money' | 'action' | 'both' | 'neither'
  issuer: ExtractedField<string | null>
  account_number: ExtractedField<string | null>
  account_number_suffix: ExtractedField<string | null>
  invoice_number: ExtractedField<string | null>
  parcel_number: ExtractedField<string | null>
  policy_number: ExtractedField<string | null>
  service_address: ExtractedField<string | null>
  mailing_address: ExtractedField<string | null>
  tenant_name: ExtractedField<string | null>
  property_identifiers: ExtractedField<string | null>
  document_date: ExtractedField<string | null>
  due_date: ExtractedField<string | null>
  service_period_start: ExtractedField<string | null>
  service_period_end: ExtractedField<string | null>
  amount_due: ExtractedField<number | null>
  total_amount: ExtractedField<number | null>
  previous_balance: ExtractedField<number | null>
  payment_received: ExtractedField<number | null>
  direction: ExtractedField<'payable' | 'receivable' | null>
  likely_category: ExtractedField<string | null>
  required_action: ExtractedField<string | null>
  action_due_date: ExtractedField<string | null>
  notes: ExtractedField<string | null>
  proposed_actions: ProposedAction[]
}

export type DocumentMatch = {
  property_id: string | null
  account_id: string | null
  party_id: string | null
  reason: string
  confidence: Confidence
}

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
      document_processing_runs: { Row: DocumentProcessingRun; Insert: DocumentProcessingRunInsert; Update: Partial<DocumentProcessingRun>; Relationships: [] }
      tasks: { Row: Task; Insert: TaskInsert; Update: TaskUpdate; Relationships: [] }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
