import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest'
import { Client } from 'pg'
import {
  createPoolOrClient,
  resetSchema,
  setupTestUser,
  createTestProperty,
  createTestDocument,
  setAuthUser,
} from './test-helpers'
import { buildBillsFromObligations, getBillHref } from '@/lib/bills'
import type { Obligation, Document, Property, Payment } from '@/lib/types'

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeDb('bills read model from database', () => {
  let client: Client
  let userId: string
  let propertyId: string

  beforeAll(async () => {
    client = await createPoolOrClient()
  })

  afterAll(async () => {
    await client?.end()
  })

  beforeEach(async () => {
    await resetSchema(client)
    userId = await setupTestUser(client)
    propertyId = await createTestProperty(client, userId)
  })

  async function insertObligation(overrides: Partial<Obligation> = {}) {
    const result = await client.query<{ id: string }>(
      `insert into public.obligations (
        user_id, property_id, source_document_id, source_item_key,
        direction, category, description, expected_amount, paid_amount, due_date, status
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
      [
        userId,
        propertyId,
        overrides.source_document_id ?? null,
        overrides.source_item_key ?? null,
        overrides.direction ?? 'payable',
        overrides.category ?? 'school_tax',
        overrides.description ?? null,
        overrides.expected_amount ?? 100,
        overrides.paid_amount ?? 0,
        overrides.due_date ?? '2026-08-31',
        overrides.status ?? 'upcoming',
      ],
    )
    return result.rows[0].id
  }

  async function loadBillsData(today: string) {
    await setAuthUser(client, userId)
    const { rows: obligations } = await client.query('select * from public.obligations where user_id = $1', [userId])
    const { rows: documents } = await client.query('select * from public.documents where user_id = $1', [userId])
    const { rows: properties } = await client.query('select * from public.properties where user_id = $1', [userId])
    const { rows: payments } = await client.query('select * from public.payments where user_id = $1', [userId])

    return buildBillsFromObligations(
      obligations as unknown as Obligation[],
      {
        documents: documents as unknown as Document[],
        properties: properties as unknown as Property[],
        accounts: [],
        parties: [],
        payments: payments as unknown as Payment[],
      },
      today,
    )
  }

  it('groups four Bethlehem school-tax installments into one bill totaling $1,756.51', async () => {
    const documentId = await createTestDocument(client, userId, {})
    await setAuthUser(client, userId)

    await insertObligation({ source_document_id: documentId, source_item_key: 'option_2:installment_1', expected_amount: 439.13, due_date: '2026-08-03', description: 'Installment 1 of 4' })
    await insertObligation({ source_document_id: documentId, source_item_key: 'option_2:installment_2', expected_amount: 439.13, due_date: '2026-09-14', description: 'Installment 2 of 4' })
    await insertObligation({ source_document_id: documentId, source_item_key: 'option_2:installment_3', expected_amount: 439.13, due_date: '2026-10-31', description: 'Installment 3 of 4' })
    await insertObligation({ source_document_id: documentId, source_item_key: 'option_2:installment_4', expected_amount: 439.12, due_date: '2026-12-07', description: 'Installment 4 of 4' })

    const bills = await loadBillsData('2026-08-07')

    expect(bills).toHaveLength(1)
    const bill = bills[0]
    expect(bill.id).toBe(documentId)
    expect(bill.total_cents).toBe(175651)
    expect(bill.remaining_cents).toBe(175651)
    expect(bill.overdue_cents).toBe(43913)
    expect(bill.due_this_month_cents).toBe(43913)
    expect(bill.status).toBe('overdue')
    expect(getBillHref(bill)).toBe(`/bills/${documentId}`)
    expect(bill.obligations[0].derived_status).toBe('overdue')
    expect(bill.obligations[1].derived_status).toBe('upcoming')
    expect(bill.obligations[2].derived_status).toBe('upcoming')
    expect(bill.obligations[3].derived_status).toBe('upcoming')
  })

  it('does not include canceled or waived obligations in remaining totals', async () => {
    const documentId = await createTestDocument(client, userId, {})
    await insertObligation({ source_document_id: documentId, source_item_key: 'option_2:installment_1', expected_amount: 439.13, due_date: '2026-08-03', status: 'canceled' })
    await insertObligation({ source_document_id: documentId, source_item_key: 'option_2:installment_2', expected_amount: 439.13, due_date: '2026-09-14', status: 'waived' })
    await insertObligation({ source_document_id: documentId, source_item_key: 'option_2:installment_3', expected_amount: 439.13, due_date: '2026-10-31' })
    await insertObligation({ source_document_id: documentId, source_item_key: 'option_2:installment_4', expected_amount: 439.12, due_date: '2026-12-07' })

    const bills = await loadBillsData('2026-08-07')

    expect(bills[0].total_cents).toBe(175651)
    expect(bills[0].remaining_cents).toBe(87825) // 43913 + 43912
    expect(bills[0].paid_cents).toBe(0)
  })

  it('keeps standalone obligations as separate bills without a source document', async () => {
    await insertObligation({ source_document_id: null, expected_amount: 120, due_date: '2026-08-31', category: 'water', description: 'Water bill' })
    await insertObligation({ source_document_id: null, expected_amount: 80, due_date: '2026-08-31', category: 'trash', description: 'Trash bill' })

    const bills = await loadBillsData('2026-08-07')

    expect(bills).toHaveLength(2)
    expect(bills.every((b) => !b.is_document_backed)).toBe(true)
  })

  it('does not merge obligations from different source documents even with the same property', async () => {
    const { rows: [{ id: documentA }] } = await client.query<{ id: string }>(
      `insert into public.documents (user_id, storage_path, original_filename, file_hash, file_size, mime_type, processing_status, review_status)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [userId, `${userId}/a.pdf`, 'a.pdf', 'hash-a', 1, 'application/pdf', 'processed', 'unreviewed'],
    )
    const { rows: [{ id: documentB }] } = await client.query<{ id: string }>(
      `insert into public.documents (user_id, storage_path, original_filename, file_hash, file_size, mime_type, processing_status, review_status)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [userId, `${userId}/b.pdf`, 'b.pdf', 'hash-b', 1, 'application/pdf', 'processed', 'unreviewed'],
    )

    await insertObligation({ source_document_id: documentA, expected_amount: 100, due_date: '2026-08-31' })
    await insertObligation({ source_document_id: documentB, expected_amount: 200, due_date: '2026-09-30' })

    const bills = await loadBillsData('2026-08-07')

    expect(bills).toHaveLength(2)
    const totals = bills.map((b) => b.total_cents).sort((a, b) => a - b)
    expect(totals).toEqual([10000, 20000])
  })

  it('reduces the grouped bill remaining balance and marks the paid installment as paid', async () => {
    const documentId = await createTestDocument(client, userId, {})

    const { rows: [installment1] } = await client.query<{ id: string }>(
      `insert into public.obligations (user_id, property_id, source_document_id, source_item_key, direction, category, description, expected_amount, paid_amount, due_date, status)
       values ($1, $2, $3, $4, 'payable', 'school_tax', 'Installment 1 of 4', 439.13, 0, '2026-08-03', 'upcoming') returning id`,
      [userId, propertyId, documentId, 'option_2:installment_1'],
    )
    await client.query(
      `insert into public.obligations (user_id, property_id, source_document_id, source_item_key, direction, category, description, expected_amount, paid_amount, due_date, status)
       values ($1, $2, $3, $4, 'payable', 'school_tax', 'Installment 2 of 4', 439.13, 0, '2026-09-14', 'upcoming')`,
      [userId, propertyId, documentId, 'option_2:installment_2'],
    )
    await client.query(
      `insert into public.obligations (user_id, property_id, source_document_id, source_item_key, direction, category, description, expected_amount, paid_amount, due_date, status)
       values ($1, $2, $3, $4, 'payable', 'school_tax', 'Installment 3 of 4', 439.13, 0, '2026-10-31', 'upcoming')`,
      [userId, propertyId, documentId, 'option_2:installment_3'],
    )
    await client.query(
      `insert into public.obligations (user_id, property_id, source_document_id, source_item_key, direction, category, description, expected_amount, paid_amount, due_date, status)
       values ($1, $2, $3, $4, 'payable', 'school_tax', 'Installment 4 of 4', 439.12, 0, '2026-12-07', 'upcoming')`,
      [userId, propertyId, documentId, 'option_2:installment_4'],
    )

    await client.query(
      `insert into public.payments (user_id, property_id, obligation_id, amount, payment_date, method)
       values ($1, $2, $3, 439.13, '2026-08-07', 'check')`,
      [userId, propertyId, installment1.id],
    )

    // Simulate syncObligationPayments updating the obligation after the payment insert.
    await client.query(
      `update public.obligations set paid_amount = 439.13, status = 'paid', paid_date = '2026-08-07' where id = $1`,
      [installment1.id],
    )

    const bills = await loadBillsData('2026-08-07')

    expect(bills).toHaveLength(1)
    const bill = bills[0]
    expect(bill.total_cents).toBe(175651)
    expect(bill.paid_cents).toBe(43913)
    expect(bill.remaining_cents).toBe(131738)
    expect(bill.overdue_cents).toBe(0)
    expect(bill.paid_count).toBe(1)
    expect(bill.obligations).toHaveLength(4)
    expect(bill.obligations[0].derived_status).toBe('paid')
    expect(bill.obligations[0].remaining_cents).toBe(0)
    expect(bill.obligations[1].derived_status).toBe('upcoming')
    expect(bill.obligations[3].remaining_cents).toBe(43912)
  })

  it('isolates rows by user_id when multiple users have obligations', async () => {
    const otherUserId = await setupTestUser(client)
    const otherPropertyId = await createTestProperty(client, otherUserId)

    const documentId = await createTestDocument(client, userId, {})
    await insertObligation({ source_document_id: documentId, expected_amount: 439.13, due_date: '2026-08-03' })
    await insertObligation({ source_document_id: documentId, expected_amount: 439.13, due_date: '2026-09-14' })
    await insertObligation({ source_document_id: documentId, expected_amount: 439.13, due_date: '2026-10-31' })
    await insertObligation({ source_document_id: documentId, expected_amount: 439.12, due_date: '2026-12-07' })

    await client.query(
      `insert into public.obligations (user_id, property_id, source_document_id, direction, category, expected_amount, due_date, status)
       values ($1, $2, $3, 'payable', 'school_tax', 9999, '2026-08-01', 'upcoming')`,
      [otherUserId, otherPropertyId, documentId],
    )

    await setAuthUser(client, userId)
    const { rows: obligations } = await client.query('select * from public.obligations where user_id = $1', [userId])
    const { rows: documents } = await client.query('select * from public.documents where user_id = $1', [userId])
    const { rows: properties } = await client.query('select * from public.properties where user_id = $1', [userId])

    const bills = buildBillsFromObligations(
      obligations as unknown as Obligation[],
      { documents: documents as unknown as Document[], properties: properties as unknown as Property[], accounts: [], parties: [], payments: [] },
      '2026-08-07',
    )

    expect(bills).toHaveLength(1)
    expect(bills[0].total_cents).toBe(175651)
  })
})
