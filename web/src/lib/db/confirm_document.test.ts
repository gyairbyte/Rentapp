import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest'
import { Client } from 'pg'
import {
  createPoolOrClient,
  resetSchema,
  setupTestUser,
  createTestProperty,
  createTestDocument,
  setAuthUser,
  type DbContext,
} from './test-helpers'

const taxPaymentOptions = [
  {
    option_type: 'discounted',
    amount: 1703.81,
    due_date: '2026-08-31',
    description: 'Full payment with discount by 8/31/2026',
    discount_amount: 52.7,
    penalty_amount: null,
    penalty_date: null,
    installments: [],
  },
  {
    option_type: 'full',
    amount: 1756.51,
    due_date: '2026-10-31',
    description: 'Full base payment by 10/31/2026',
    discount_amount: null,
    penalty_amount: 175.65,
    penalty_date: '2026-11-01',
    installments: [],
  },
  {
    option_type: 'installment_plan',
    amount: 1756.51,
    due_date: '2026-10-31',
    description: 'Four installment plan',
    discount_amount: null,
    penalty_amount: null,
    penalty_date: null,
    installments: [
      { amount: 439.13, due_date: '2026-08-03', description: 'Installment 1 of 4' },
      { amount: 439.13, due_date: '2026-09-14', description: 'Installment 2 of 4' },
      { amount: 439.13, due_date: '2026-10-31', description: 'Installment 3 of 4' },
      { amount: 439.12, due_date: '2026-12-07', description: 'Installment 4 of 4' },
    ],
  },
]

async function callConfirm(
  client: Client,
  userId: string,
  documentId: string,
  propertyId: string,
  overrides: Record<string, unknown> = {},
) {
  await setAuthUser(client, userId)
  const { rows } = await client.query<{ result: { obligation_ids: string[]; task_id: string | null } }>(
    `select public.confirm_document(
      p_user_id := $1::uuid,
      p_document_id := $2::uuid,
      p_property_id := $3::uuid,
      p_amount := $4,
      p_due_date := $5,
      p_direction := $6,
      p_category := $7,
      p_description := $8,
      p_payment_options := $9::jsonb,
      p_selected_payment_option_index := $10
    ) as result`,
    [
      userId,
      documentId,
      propertyId,
      overrides.amount ?? null,
      overrides.due_date ?? null,
      overrides.direction ?? 'payable',
      overrides.category ?? 'school_tax',
      overrides.description ?? 'School tax bill',
      JSON.stringify(overrides.payment_options ?? []),
      overrides.selected_payment_option_index ?? null,
    ],
  )
  return rows[0].result
}

describe('confirm_document multi-payment behavior', () => {
  let client: Client
  let ctx: DbContext

  beforeAll(async () => {
    client = await createPoolOrClient()
  })

  afterAll(async () => {
    await client?.end()
  })

  beforeEach(async () => {
    await resetSchema(client)
    const userId = await setupTestUser(client)
    const propertyId = await createTestProperty(client, userId)
    ctx = { client, userId, propertyId, accountId: null, partyId: null }
  })

  it('selecting four installments creates exactly four obligations', async () => {
    const documentId = await createTestDocument(client, ctx.userId, {})
    await setAuthUser(client, ctx.userId)

    const result = await callConfirm(client, ctx.userId, documentId, ctx.propertyId, {
      payment_options: taxPaymentOptions,
      selected_payment_option_index: 2,
    })

    expect(result.obligation_ids).toHaveLength(4)

    const { rows: obligations } = await client.query(
      'select * from public.obligations where source_document_id = $1 order by source_item_key',
      [documentId],
    )
    expect(obligations).toHaveLength(4)
  })

  it('amounts and dates match all four selected installments', async () => {
    const documentId = await createTestDocument(client, ctx.userId, {})
    await callConfirm(client, ctx.userId, documentId, ctx.propertyId, {
      payment_options: taxPaymentOptions,
      selected_payment_option_index: 2,
    })

    const { rows: obligations } = await client.query(
      'select expected_amount, due_date, source_item_key from public.obligations where source_document_id = $1 order by source_item_key',
      [documentId],
    )

    const expected = taxPaymentOptions[2].installments
    expect(obligations).toHaveLength(4)
    obligations.forEach((row, i) => {
      expect(Number(row.expected_amount)).toBe(expected[i].amount)
      expect(row.due_date.toISOString().slice(0, 10)).toBe(expected[i].due_date)
      expect(row.source_item_key).toBe(`option_2:installment_${i + 1}`)
    })
  })

  it('selecting full payment creates exactly one obligation', async () => {
    const documentId = await createTestDocument(client, ctx.userId, {})
    await callConfirm(client, ctx.userId, documentId, ctx.propertyId, {
      payment_options: taxPaymentOptions,
      selected_payment_option_index: 1,
    })

    const { rows: obligations } = await client.query(
      'select * from public.obligations where source_document_id = $1',
      [documentId],
    )
    expect(obligations).toHaveLength(1)
    expect(Number(obligations[0].expected_amount)).toBe(taxPaymentOptions[1].amount)
    expect(obligations[0].source_item_key).toBe('option_1:full')
  })

  it('repeated/double confirmation creates no duplicates', async () => {
    const documentId = await createTestDocument(client, ctx.userId, {})
    const params = {
      payment_options: taxPaymentOptions,
      selected_payment_option_index: 2,
    }

    const first = await callConfirm(client, ctx.userId, documentId, ctx.propertyId, params)
    const second = await callConfirm(client, ctx.userId, documentId, ctx.propertyId, params)

    expect(first.obligation_ids).toEqual(second.obligation_ids)

    const { rows } = await client.query<{ count: number }>(
      'select count(*)::int as count from public.obligations where source_document_id = $1',
      [documentId],
    )
    expect(rows[0].count).toBe(4)
  })

  it('two source items with the same due date remain distinct', async () => {
    const installments = [
      { amount: 100, due_date: '2026-10-31', description: 'First' },
      { amount: 200, due_date: '2026-10-31', description: 'Second same day' },
    ]
    const documentId = await createTestDocument(client, ctx.userId, {})
    await callConfirm(client, ctx.userId, documentId, ctx.propertyId, {
      payment_options: [
        {
          option_type: 'installment_plan',
          amount: 300,
          due_date: '2026-10-31',
          description: 'Two on the same day',
          discount_amount: null,
          penalty_amount: null,
          penalty_date: null,
          installments,
        },
      ],
      selected_payment_option_index: 0,
    })

    const { rows: obligations } = await client.query(
      'select * from public.obligations where source_document_id = $1 order by source_item_key',
      [documentId],
    )
    expect(obligations).toHaveLength(2)
    expect(Number(obligations[0].expected_amount)).toBe(100)
    expect(Number(obligations[1].expected_amount)).toBe(200)
    expect(obligations[0].source_item_key).not.toBe(obligations[1].source_item_key)
  })

  it('invalid selected index rejects and creates nothing', async () => {
    const documentId = await createTestDocument(client, ctx.userId, {})
    await expect(
      callConfirm(client, ctx.userId, documentId, ctx.propertyId, {
        payment_options: taxPaymentOptions,
        selected_payment_option_index: 99,
      }),
    ).rejects.toThrow('Invalid payment option selection')

    const { rows } = await client.query<{ count: number }>(
      'select count(*)::int as count from public.obligations where source_document_id = $1',
      [documentId],
    )
    expect(rows[0].count).toBe(0)
  })

  it('malformed installment rejects and creates nothing', async () => {
    const documentId = await createTestDocument(client, ctx.userId, {})
    const badOptions = [
      {
        option_type: 'installment_plan',
        amount: 300,
        due_date: '2026-10-31',
        description: 'Bad',
        discount_amount: null,
        penalty_amount: null,
        penalty_date: null,
        installments: [{ amount: 'not-a-number', due_date: '2026-10-31', description: 'Bad installment' }],
      },
    ]

    await expect(
      callConfirm(client, ctx.userId, documentId, ctx.propertyId, {
        payment_options: badOptions,
        selected_payment_option_index: 0,
      }),
    ).rejects.toThrow()

    const { rows } = await client.query<{ count: number }>(
      'select count(*)::int as count from public.obligations where source_document_id = $1',
      [documentId],
    )
    expect(rows[0].count).toBe(0)
  })

  it('zero/negative amount rejects and creates nothing', async () => {
    const documentId = await createTestDocument(client, ctx.userId, {})
    const badOptions = [
      {
        option_type: 'full',
        amount: 0,
        due_date: '2026-10-31',
        description: 'Zero amount',
        discount_amount: null,
        penalty_amount: null,
        penalty_date: null,
        installments: [],
      },
    ]

    await expect(
      callConfirm(client, ctx.userId, documentId, ctx.propertyId, {
        payment_options: badOptions,
        selected_payment_option_index: 0,
      }),
    ).rejects.toThrow('amount must be greater than zero')

    const { rows } = await client.query<{ count: number }>(
      'select count(*)::int as count from public.obligations where source_document_id = $1',
      [documentId],
    )
    expect(rows[0].count).toBe(0)
  })

  it('partial failure rolls back all obligations and leaves the document unconfirmed', async () => {
    const installments = [
      { amount: 100, due_date: '2026-08-03', description: 'Good' },
      { amount: 0, due_date: '2026-09-14', description: 'Bad' },
    ]
    const documentId = await createTestDocument(client, ctx.userId, {})

    await expect(
      callConfirm(client, ctx.userId, documentId, ctx.propertyId, {
        payment_options: [
          {
            option_type: 'installment_plan',
            amount: 100,
            due_date: '2026-09-14',
            description: 'Plan with bad middle item',
            discount_amount: null,
            penalty_amount: null,
            penalty_date: null,
            installments,
          },
        ],
        selected_payment_option_index: 0,
      }),
    ).rejects.toThrow()

    const { rows: obligations } = await client.query<{ count: number }>(
      'select count(*)::int as count from public.obligations where source_document_id = $1',
      [documentId],
    )
    expect(obligations[0].count).toBe(0)

    const { rows: documents } = await client.query(
      'select review_status from public.documents where id = $1',
      [documentId],
    )
    expect(documents[0].review_status).not.toBe('confirmed')
  })

  it('already-confirmed response returns all linked obligation IDs', async () => {
    const documentId = await createTestDocument(client, ctx.userId, {})
    await callConfirm(client, ctx.userId, documentId, ctx.propertyId, {
      payment_options: taxPaymentOptions,
      selected_payment_option_index: 2,
    })

    const { rows: before } = await client.query<{ count: number }>(
      'select count(*)::int as count from public.obligations where source_document_id = $1',
      [documentId],
    )
    expect(before[0].count).toBe(4)

    const result = await callConfirm(client, ctx.userId, documentId, ctx.propertyId, {
      payment_options: taxPaymentOptions,
      selected_payment_option_index: 2,
    })

    expect(result.obligation_ids).toHaveLength(4)

    const { rows: after } = await client.query<{ count: number }>(
      'select count(*)::int as count from public.obligations where source_document_id = $1',
      [documentId],
    )
    expect(after[0].count).toBe(4)
  })

  it('requires a valid property belonging to the user', async () => {
    const documentId = await createTestDocument(client, ctx.userId, {})
    await expect(
      callConfirm(client, ctx.userId, documentId, '00000000-0000-0000-0000-000000000000', {
        payment_options: taxPaymentOptions,
        selected_payment_option_index: 2,
      }),
    ).rejects.toThrow('Property is required and must belong to the user')
  })

  it('unrecognized option type rejects and creates nothing', async () => {
    const documentId = await createTestDocument(client, ctx.userId, {})
    const badOptions = [
      {
        option_type: 'unknown',
        amount: 100,
        due_date: '2026-10-31',
        description: 'Unknown type',
        discount_amount: null,
        penalty_amount: null,
        penalty_date: null,
        installments: [],
      },
    ]

    await expect(
      callConfirm(client, ctx.userId, documentId, ctx.propertyId, {
        payment_options: badOptions,
        selected_payment_option_index: 0,
      }),
    ).rejects.toThrow('Unrecognized payment option type')
  })

  it('empty installment plan rejects and creates nothing', async () => {
    const documentId = await createTestDocument(client, ctx.userId, {})
    const badOptions = [
      {
        option_type: 'installment_plan',
        amount: 100,
        due_date: '2026-10-31',
        description: 'Empty plan',
        discount_amount: null,
        penalty_amount: null,
        penalty_date: null,
        installments: [],
      },
    ]

    await expect(
      callConfirm(client, ctx.userId, documentId, ctx.propertyId, {
        payment_options: badOptions,
        selected_payment_option_index: 0,
      }),
    ).rejects.toThrow('at least one installment')

    const { rows } = await client.query<{ count: number }>(
      'select count(*)::int as count from public.obligations where source_document_id = $1',
      [documentId],
    )
    expect(rows[0].count).toBe(0)
  })
})
