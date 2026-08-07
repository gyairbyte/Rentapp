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
  { value: 'photograph', label: 'Photograph' },
  { value: 'pdf', label: 'PDF' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'bill', label: 'Bill' },
  { value: 'letter', label: 'Letter' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'other', label: 'Other' },
]

export const PROCESSING_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
]

export const REVIEW_STATUSES = [
  { value: 'pending', label: 'Pending review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]
