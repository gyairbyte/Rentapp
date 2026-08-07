import { z } from 'zod'
import type { DocumentExtraction } from '@/lib/types'

const confidenceSchema = z.enum(['high', 'medium', 'low'])

// Every nested object in the OpenAI strict schema must list all of its properties
// in its `required` array. Fields that are logically optional are represented as
// required-but-nullable so the model always returns the key.
const extractedStringSchema = z.object({
  value: z.string().nullable(),
  confidence: confidenceSchema,
  evidence: z.string().nullable(),
})

const extractedNumberSchema = z.object({
  value: z.number().nullable(),
  confidence: confidenceSchema,
  evidence: z.string().nullable(),
})

const extractedDirectionSchema = z.object({
  value: z.enum(['payable', 'receivable']).nullable(),
  confidence: confidenceSchema,
  evidence: z.string().nullable(),
})

const paymentTermSchema = z.object({
  term_type: z.enum(['penalty', 'late_fee', 'discount', 'other']),
  amount: z.number().nullable(),
  rate: z.number().nullable(),
  effective_date: z.string().nullable(),
  due_date: z.string().nullable(),
  description: z.string().nullable(),
})

const paymentInstallmentSchema = z.object({
  amount: z.number().nullable(),
  due_date: z.string().nullable(),
  description: z.string().nullable(),
  late_payment_terms: z.array(paymentTermSchema).default([]),
})

const paymentOptionSchema = z.object({
  option_type: z.enum(['full', 'discounted', 'installment_plan', 'other', 'penalty', 'late_fee']),
  amount: z.number().nullable(),
  due_date: z.string().nullable(),
  description: z.string().nullable(),
  discount_amount: z.number().nullable(),
  penalty_amount: z.number().nullable(),
  penalty_date: z.string().nullable(),
  late_payment_terms: z.array(paymentTermSchema).default([]),
  installments: z.array(paymentInstallmentSchema).default([]),
})

const proposedActionSchema = z.object({
  type: z.enum(['obligation', 'task', 'none']),
  direction: z.enum(['payable', 'receivable']).nullable(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  expected_amount: z.number().nullable(),
  due_date: z.string().nullable(),
  action_due_date: z.string().nullable(),
  period_start: z.string().nullable(),
  period_end: z.string().nullable(),
  title: z.string().nullable(),
  payment_options: z.array(paymentOptionSchema),
})

export const documentExtractionSchema = z.object({
  document_type: z.string().nullable(),
  document_class: z.enum(['financial', 'operational', 'tenant', 'legal', 'other']).nullable(),
  requires: z.enum(['money', 'action', 'both', 'neither']),
  issuer: extractedStringSchema,
  account_number: extractedStringSchema,
  account_number_suffix: extractedStringSchema,
  invoice_number: extractedStringSchema,
  parcel_number: extractedStringSchema,
  policy_number: extractedStringSchema,
  service_address: extractedStringSchema,
  mailing_address: extractedStringSchema,
  tenant_name: extractedStringSchema,
  property_identifiers: extractedStringSchema,
  document_date: extractedStringSchema,
  due_date: extractedStringSchema,
  service_period_start: extractedStringSchema,
  service_period_end: extractedStringSchema,
  amount_due: extractedNumberSchema,
  total_amount: extractedNumberSchema,
  previous_balance: extractedNumberSchema,
  payment_received: extractedNumberSchema,
  direction: extractedDirectionSchema,
  likely_category: extractedStringSchema,
  required_action: extractedStringSchema,
  action_due_date: extractedStringSchema,
  notes: extractedStringSchema,
  proposed_actions: z.array(proposedActionSchema),
})

export type DocumentExtractionSchema = z.infer<typeof documentExtractionSchema>

function field<T>(value: T, confidence: 'high' | 'medium' | 'low' = 'low', evidence: string | null = null) {
  return { value, confidence, evidence }
}

export function emptyExtraction(): DocumentExtraction {
  return {
    document_type: null,
    document_class: 'other',
    requires: 'neither',
    issuer: field(null),
    account_number: field(null),
    account_number_suffix: field(null),
    invoice_number: field(null),
    parcel_number: field(null),
    policy_number: field(null),
    service_address: field(null),
    mailing_address: field(null),
    tenant_name: field(null),
    property_identifiers: field(null),
    document_date: field(null),
    due_date: field(null),
    service_period_start: field(null),
    service_period_end: field(null),
    amount_due: field(null),
    total_amount: field(null),
    previous_balance: field(null),
    payment_received: field(null),
    direction: field(null),
    likely_category: field(null),
    required_action: field(null),
    action_due_date: field(null),
    notes: field(null),
    proposed_actions: [],
  }
}

export function parseExtraction(raw: unknown): DocumentExtraction | null {
  if (raw === null || raw === undefined) return null
  const parsed = documentExtractionSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export function parseExtractionOrEmpty(raw: unknown): DocumentExtraction {
  return parseExtraction(raw) ?? emptyExtraction()
}

function extractedJsonSchema(type: 'string' | 'number' = 'string') {
  return {
    type: 'object',
    properties: {
      value: type === 'number' ? { type: ['number', 'null'] } : { type: ['string', 'null'] },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      evidence: { type: ['string', 'null'] },
    },
    required: ['value', 'confidence', 'evidence'],
    additionalProperties: false,
  }
}

const directionJsonSchema = {
  type: 'object',
  properties: {
    value: { type: ['string', 'null'], enum: ['payable', 'receivable', null] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    evidence: { type: ['string', 'null'] },
  },
  required: ['value', 'confidence', 'evidence'],
  additionalProperties: false,
}

const paymentTermJsonSchema = {
  type: 'object',
  properties: {
    term_type: { type: 'string', enum: ['penalty', 'late_fee', 'discount', 'other'] },
    amount: { type: ['number', 'null'] },
    rate: { type: ['number', 'null'] },
    effective_date: { type: ['string', 'null'] },
    due_date: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] },
  },
  required: ['term_type', 'amount', 'rate', 'effective_date', 'due_date', 'description'],
  additionalProperties: false,
}

const paymentInstallmentJsonSchema = {
  type: 'object',
  properties: {
    amount: { type: ['number', 'null'] },
    due_date: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] },
    late_payment_terms: {
      type: 'array',
      items: paymentTermJsonSchema,
    },
  },
  required: ['amount', 'due_date', 'description', 'late_payment_terms'],
  additionalProperties: false,
}

const paymentOptionJsonSchema = {
  type: 'object',
  properties: {
    option_type: { type: 'string', enum: ['full', 'discounted', 'installment_plan', 'other', 'penalty', 'late_fee'] },
    amount: { type: ['number', 'null'] },
    due_date: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] },
    discount_amount: { type: ['number', 'null'] },
    penalty_amount: { type: ['number', 'null'] },
    penalty_date: { type: ['string', 'null'] },
    late_payment_terms: {
      type: 'array',
      items: paymentTermJsonSchema,
    },
    installments: {
      type: 'array',
      items: paymentInstallmentJsonSchema,
    },
  },
  required: ['option_type', 'amount', 'due_date', 'description', 'discount_amount', 'penalty_amount', 'penalty_date', 'late_payment_terms', 'installments'],
  additionalProperties: false,
}

const proposedActionJsonSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['obligation', 'task', 'none'] },
    direction: { type: ['string', 'null'], enum: ['payable', 'receivable', null] },
    category: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] },
    expected_amount: { type: ['number', 'null'] },
    due_date: { type: ['string', 'null'] },
    action_due_date: { type: ['string', 'null'] },
    period_start: { type: ['string', 'null'] },
    period_end: { type: ['string', 'null'] },
    title: { type: ['string', 'null'] },
    payment_options: {
      type: 'array',
      items: paymentOptionJsonSchema,
    },
  },
  required: ['type', 'direction', 'category', 'description', 'expected_amount', 'due_date', 'action_due_date', 'period_start', 'period_end', 'title', 'payment_options'],
  additionalProperties: false,
}

export const documentExtractionJsonSchema = {
  name: 'document_extraction',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      document_type: { type: ['string', 'null'] },
      document_class: { type: ['string', 'null'], enum: ['financial', 'operational', 'tenant', 'legal', 'other', null] },
      requires: { type: 'string', enum: ['money', 'action', 'both', 'neither'] },
      issuer: extractedJsonSchema(),
      account_number: extractedJsonSchema(),
      account_number_suffix: extractedJsonSchema(),
      invoice_number: extractedJsonSchema(),
      parcel_number: extractedJsonSchema(),
      policy_number: extractedJsonSchema(),
      service_address: extractedJsonSchema(),
      mailing_address: extractedJsonSchema(),
      tenant_name: extractedJsonSchema(),
      property_identifiers: extractedJsonSchema(),
      document_date: extractedJsonSchema(),
      due_date: extractedJsonSchema(),
      service_period_start: extractedJsonSchema(),
      service_period_end: extractedJsonSchema(),
      amount_due: extractedJsonSchema('number'),
      total_amount: extractedJsonSchema('number'),
      previous_balance: extractedJsonSchema('number'),
      payment_received: extractedJsonSchema('number'),
      direction: directionJsonSchema,
      likely_category: extractedJsonSchema(),
      required_action: extractedJsonSchema(),
      action_due_date: extractedJsonSchema(),
      notes: extractedJsonSchema(),
      proposed_actions: {
        type: 'array',
        items: proposedActionJsonSchema,
      },
    },
    required: [
      'document_type',
      'document_class',
      'requires',
      'issuer',
      'account_number',
      'account_number_suffix',
      'invoice_number',
      'parcel_number',
      'policy_number',
      'service_address',
      'mailing_address',
      'tenant_name',
      'property_identifiers',
      'document_date',
      'due_date',
      'service_period_start',
      'service_period_end',
      'amount_due',
      'total_amount',
      'previous_balance',
      'payment_received',
      'direction',
      'likely_category',
      'required_action',
      'action_due_date',
      'notes',
      'proposed_actions',
    ],
    additionalProperties: false,
  },
}
