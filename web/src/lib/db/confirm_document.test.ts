import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
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

const unbalancedTaxPaymentOptions = [
  {
    option_type: 'installment_plan',
    amount: 1756.51,
    due_date: '2026-10-31',
    description: 'Four installment plan',
    discount_amount: null,
    penalty_amount: null,
    penalty_date: null,
    late_payment_terms: [],
    installments: [
      { amount: 439.13, due_date: '2026-08-03', description: 'Installment 1 of 4', late_payment_terms: [] },
      { amount: 439.13, due_date: '2026-09-14', description: 'Installment 2 of 4', late_payment_terms: [] },
      { amount: 439.13, due_date: '2026-10-31', description: 'Installment 3 of 4', late_payment_terms: [] },
      { amount: 439.13, due_date: '2026-12-07', description: 'Installment 4 of 4', late_payment_terms: [] },
    ],
  },
]

const taxPaymentOptions = [
  {
    option_type: 'discounted',
    amount: 1703.81,
    due_date: '2026-08-31',
    description: 'Full payment with discount by 8/31/2026',
    discount_amount: 52.7,
    penalty_amount: null,
    penalty_date: null,
    late_payment_terms: [],
    installments: [],
  },
  {
    option_type: 'full',
    amount: 1756.51,
    due_date: '2026-10-31',
    description: 'Full base payment by 10/31/2026',
    discount_amount: null,
    penalty_amount: null,
    penalty_date: null,
    late_payment_terms: [
      { term_type: 'penalty', amount: 1932.16, rate: 0.1, effective_date: '2026-10-31', due_date: '2026-10-31', description: 'Add 10% penalty after 10/31/2026' },
    ],
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
    late_payment_terms: [],
    installments: [
      { amount: 439.13, due_date: '2026-08-03', description: 'Installment 1 of 4', late_payment_terms: [] },
      { amount: 439.13, due_date: '2026-09-14', description: 'Installment 2 of 4', late_payment_terms: [] },
      { amount: 439.13, due_date: '2026-10-31', description: 'Installment 3 of 4', late_payment_terms: [] },
      { amount: 439.12, due_date: '2026-12-07', description: 'Installment 4 of 4', late_payment_terms: [] },
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

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeDb('confirm_document multi-payment behavior', () => {
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
      { amount: 100, due_date: '2026-10-31', description: 'First', late_payment_terms: [] },
      { amount: 200, due_date: '2026-10-31', description: 'Second same day', late_payment_terms: [] },
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
          late_payment_terms: [],
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
        installments: [{ amount: 'not-a-number', due_date: '2026-10-31', description: 'Bad installment', late_payment_terms: [] }],
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
        late_payment_terms: [],
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
      { amount: 100, due_date: '2026-08-03', description: 'Good', late_payment_terms: [] },
      { amount: 0, due_date: '2026-09-14', description: 'Bad', late_payment_terms: [] },
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
            late_payment_terms: [],
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
        late_payment_terms: [],
        installments: [],
      },
    ]

    await expect(
      callConfirm(client, ctx.userId, documentId, ctx.propertyId, {
        payment_options: badOptions,
        selected_payment_option_index: 0,
      }),
    ).rejects.toThrow('Unrecognized or non-selectable payment option type')
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
        late_payment_terms: [],
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

  it('selecting full payment with a late-payment penalty term creates only one obligation, not the penalty', async () => {
    const documentId = await createTestDocument(client, ctx.userId, {})
    await callConfirm(client, ctx.userId, documentId, ctx.propertyId, {
      payment_options: taxPaymentOptions,
      selected_payment_option_index: 1,
    })

    const { rows: obligations } = await client.query(
      'select expected_amount, source_item_key from public.obligations where source_document_id = $1 order by source_item_key',
      [documentId],
    )
    expect(obligations).toHaveLength(1)
    expect(Number(obligations[0].expected_amount)).toBe(taxPaymentOptions[1].amount)
    expect(obligations[0].source_item_key).toBe('option_1:full')
  })

  it('selecting a penalty option type rejects and creates nothing', async () => {
    const documentId = await createTestDocument(client, ctx.userId, {})
    const penaltyOptions = [
      ...taxPaymentOptions,
      {
        option_type: 'penalty',
        amount: 1932.16,
        due_date: '2026-10-31',
        description: 'Add 10% penalty after 10/31/2026',
        discount_amount: null,
        penalty_amount: null,
        penalty_date: null,
        late_payment_terms: [],
        installments: [],
      },
    ]

    await expect(
      callConfirm(client, ctx.userId, documentId, ctx.propertyId, {
        payment_options: penaltyOptions,
        selected_payment_option_index: 3,
      }),
    ).rejects.toThrow('non-selectable payment option type')

    const { rows } = await client.query<{ count: number }>(
      'select count(*)::int as count from public.obligations where source_document_id = $1',
      [documentId],
    )
    expect(rows[0].count).toBe(0)
  })

  it('rejects an unbalanced installment plan and creates zero obligations', async () => {
    const documentId = await createTestDocument(client, ctx.userId, {})
    await setAuthUser(client, ctx.userId)

    await expect(
      callConfirm(client, ctx.userId, documentId, ctx.propertyId, {
        payment_options: unbalancedTaxPaymentOptions,
        selected_payment_option_index: 0,
      }),
    ).rejects.toThrow('Installment total')

    const { rows } = await client.query<{ count: number }>(
      'select count(*)::int as count from public.obligations where source_document_id = $1',
      [documentId],
    )
    expect(rows[0].count).toBe(0)

    const { rows: docs } = await client.query(
      'select review_status from public.documents where id = $1',
      [documentId],
    )
    expect(docs[0].review_status).not.toBe('confirmed')
  })

  it('creates exactly four obligations from the corrected fixture, including installment 4 at $439.12', async () => {
    const documentId = await createTestDocument(client, ctx.userId, {})
    await callConfirm(client, ctx.userId, documentId, ctx.propertyId, {
      payment_options: taxPaymentOptions,
      selected_payment_option_index: 2,
    })

    const { rows } = await client.query(
      'select expected_amount, source_item_key from public.obligations where source_document_id = $1 order by source_item_key',
      [documentId],
    )

    expect(rows).toHaveLength(4)
    expect(Number(rows[3].expected_amount)).toBe(439.12)
    expect(rows[3].source_item_key).toBe('option_2:installment_4')
  })

  it('rejects a plan amount with more than two decimal places', async () => {
    const documentId = await createTestDocument(client, ctx.userId, {})
    const badOptions = [
      {
        option_type: 'installment_plan',
        amount: 100.005,
        due_date: '2026-10-31',
        description: 'Bad precision plan',
        discount_amount: null,
        penalty_amount: null,
        penalty_date: null,
        late_payment_terms: [],
        installments: [
          { amount: 50, due_date: '2026-08-03', description: 'Half', late_payment_terms: [] },
          { amount: 50.01, due_date: '2026-09-14', description: 'Half+cent', late_payment_terms: [] },
        ],
      },
    ]

    await expect(
      callConfirm(client, ctx.userId, documentId, ctx.propertyId, {
        payment_options: badOptions,
        selected_payment_option_index: 0,
      }),
    ).rejects.toThrow('valid to cents')

    const { rows } = await client.query<{ count: number }>(
      'select count(*)::int as count from public.obligations where source_document_id = $1',
      [documentId],
    )
    expect(rows[0].count).toBe(0)

    const { rows: docs } = await client.query(
      'select review_status from public.documents where id = $1',
      [documentId],
    )
    expect(docs[0].review_status).not.toBe('confirmed')
  })

  it('rejects an installment amount with more than two decimal places', async () => {
    const documentId = await createTestDocument(client, ctx.userId, {})
    const badOptions = [
      {
        option_type: 'installment_plan',
        amount: 100,
        due_date: '2026-10-31',
        description: 'Bad installment precision',
        discount_amount: null,
        penalty_amount: null,
        penalty_date: null,
        late_payment_terms: [],
        installments: [
          { amount: 33.335, due_date: '2026-08-03', description: 'Third', late_payment_terms: [] },
          { amount: 33.33, due_date: '2026-09-14', description: 'Third', late_payment_terms: [] },
          { amount: 33.34, due_date: '2026-10-31', description: 'Third', late_payment_terms: [] },
        ],
      },
    ]

    await expect(
      callConfirm(client, ctx.userId, documentId, ctx.propertyId, {
        payment_options: badOptions,
        selected_payment_option_index: 0,
      }),
    ).rejects.toThrow('valid to cents')

    const { rows } = await client.query<{ count: number }>(
      'select count(*)::int as count from public.obligations where source_document_id = $1',
      [documentId],
    )
    expect(rows[0].count).toBe(0)
  })

  it('upgrades from migration 008 to 009 and rejects an unbalanced schedule', async () => {
    await setAuthUser(client, ctx.userId)
    const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
    const migration008 = readFileSync(join(migrationsDir, '008_confirm_document_option_types.sql'), 'utf-8')
    const migration009 = readFileSync(join(migrationsDir, '009_installment_exact_cent_validation.sql'), 'utf-8')

    await client.query('drop function if exists public.confirm_document(uuid, uuid, uuid, uuid, uuid, text, text, date, date, date, date, numeric, text, text, text, text, date, text, jsonb, int)')
    await client.query(migration008)
    await client.query(migration009)

    const documentId = await createTestDocument(client, ctx.userId, {})
    await expect(
      callConfirm(client, ctx.userId, documentId, ctx.propertyId, {
        payment_options: unbalancedTaxPaymentOptions,
        selected_payment_option_index: 0,
      }),
    ).rejects.toThrow('Installment total')

    const { rows } = await client.query<{ count: number }>(
      'select count(*)::int as count from public.obligations where source_document_id = $1',
      [documentId],
    )
    expect(rows[0].count).toBe(0)
  })
})
