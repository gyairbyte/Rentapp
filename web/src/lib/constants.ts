export const PROPERTY_TYPES = [
  { value: 'single_family', label: 'Single-family' },
  { value: 'multi_family', label: 'Multi-family' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'other', label: 'Other' },
]

export const PARTY_TYPES = [
  { value: 'tenant', label: 'Tenant' },
  { value: 'utility_provider', label: 'Utility / Provider' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'government_tax_authority', label: 'Government / Tax authority' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'other', label: 'Other' },
]

export const ACCOUNT_TYPES = [
  { value: 'water', label: 'Water' },
  { value: 'sewer', label: 'Sewer' },
  { value: 'trash', label: 'Trash' },
  { value: 'electricity_gas', label: 'Electricity / Gas' },
  { value: 'cable_internet', label: 'Cable / Internet' },
  { value: 'property_tax', label: 'Property tax' },
  { value: 'school_tax', label: 'School tax' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'hoa', label: 'HOA' },
  { value: 'other', label: 'Other' },
]

export const DIRECTIONS = [
  { value: 'payable', label: 'Payable (bill / expense)' },
  { value: 'receivable', label: 'Receivable (rent / income)' },
]

export const OBLIGATION_CATEGORIES = [
  { value: 'rent', label: 'Rent' },
  { value: 'water', label: 'Water' },
  { value: 'sewer', label: 'Sewer' },
  { value: 'trash', label: 'Trash' },
  { value: 'electricity_gas', label: 'Electricity / Gas' },
  { value: 'cable_internet', label: 'Cable / Internet' },
  { value: 'property_tax', label: 'Property tax' },
  { value: 'school_tax', label: 'School tax' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'contractor_invoice', label: 'Contractor invoice' },
  { value: 'hoa', label: 'HOA' },
  { value: 'reimbursement', label: 'Reimbursement' },
  { value: 'other', label: 'Other' },
]

export const OBLIGATION_STATUSES = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'due', label: 'Due' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'waived', label: 'Waived' },
  { value: 'canceled', label: 'Canceled' },
]

export const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semiannual', label: 'Semiannual' },
  { value: 'annual', label: 'Annual' },
]

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'ach', label: 'ACH' },
  { value: 'wire', label: 'Wire' },
  { value: 'card', label: 'Card' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'other', label: 'Other' },
]

export const DOCUMENT_TYPES = [
  { value: 'rent', label: 'Rent' },
  { value: 'water', label: 'Water' },
  { value: 'sewer', label: 'Sewer' },
  { value: 'gas', label: 'Gas' },
  { value: 'electric', label: 'Electric' },
  { value: 'trash', label: 'Trash' },
  { value: 'cable_internet', label: 'Cable / Internet' },
  { value: 'property_tax', label: 'Property tax' },
  { value: 'school_tax', label: 'School tax' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'hoa', label: 'HOA' },
  { value: 'contractor_invoice', label: 'Contractor invoice' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'repair_notice', label: 'Repair notice / request' },
  { value: 'inspection_notice', label: 'Inspection notice' },
  { value: 'violation_notice', label: 'Violation / code notice' },
  { value: 'permit', label: 'Permit / licensing' },
  { value: 'tenant_correspondence', label: 'Tenant correspondence' },
  { value: 'legal_correspondence', label: 'Legal / court correspondence' },
  { value: 'general_letter', label: 'General letter' },
  { value: 'photograph', label: 'Photograph' },
  { value: 'pdf', label: 'PDF' },
  { value: 'other', label: 'Other' },
]

export const DOCUMENT_CLASSES = [
  { value: 'financial', label: 'Financial' },
  { value: 'operational', label: 'Operational' },
  { value: 'tenant', label: 'Tenant' },
  { value: 'legal', label: 'Legal' },
  { value: 'other', label: 'Other' },
]

export const REQUIRES_OPTIONS = [
  { value: 'money', label: 'Money' },
  { value: 'action', label: 'Action' },
  { value: 'both', label: 'Both' },
  { value: 'neither', label: 'Neither' },
]

export const CONFIDENCES = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

export const PROCESSING_STATUSES = [
  { value: 'uploaded', label: 'Uploaded' },
  { value: 'processing', label: 'Processing' },
  { value: 'processed', label: 'Processed' },
  { value: 'failed', label: 'Failed' },
]

export const REVIEW_STATUSES = [
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'archived', label: 'Archived' },
]

export const TASK_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'completed', label: 'Completed' },
  { value: 'canceled', label: 'Canceled' },
]

export const TASK_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
]

export const REPAIR_STATUSES = [
  { value: 'reported', label: 'Reported' },
  { value: 'evaluating', label: 'Evaluating' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
]

export const REPAIR_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'urgent', label: 'Urgent' },
]
