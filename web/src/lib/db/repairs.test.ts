import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest'
import { Client } from 'pg'
import { createPoolOrClient, resetSchema, setupTestUser, createTestProperty, setAuthUser } from './test-helpers'
import type { Repair } from '@/lib/types'

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeDb('repairs database behavior', () => {
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

  async function insertRepair(overrides: Partial<Repair> = {}) {
    const result = await client.query<{ id: string }>(
      `insert into public.repairs (
        user_id, property_id, party_id, title, description, priority, status,
        reported_date, scheduled_date, completed_date
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      [
        userId,
        propertyId,
        overrides.party_id ?? null,
        overrides.title ?? 'Test repair',
        overrides.description ?? null,
        overrides.priority ?? 'normal',
        overrides.status ?? 'reported',
        overrides.reported_date ?? '2026-08-07',
        overrides.scheduled_date ?? null,
        overrides.completed_date ?? null,
      ],
    )
    return result.rows[0].id
  }

  it('creates a repair with required fields', async () => {
    const id = await insertRepair({ title: 'Leaky roof', priority: 'urgent' })

    await setAuthUser(client, userId)
    const { rows } = await client.query('select * from public.repairs where id = $1', [id])
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toBe('Leaky roof')
    expect(rows[0].priority).toBe('urgent')
    expect(rows[0].status).toBe('reported')
    expect(rows[0].user_id).toBe(userId)
    expect(rows[0].property_id).toBe(propertyId)
  })

  it('excludes closed repairs from active filter', async () => {
    const active = await insertRepair({ status: 'scheduled' })
    const closed = await insertRepair({ status: 'closed', title: 'Old repair' })

    await setAuthUser(client, userId)
    const { rows } = await client.query(
      "select * from public.repairs where user_id = $1 and status not in ('closed')",
      [userId],
    )
    const ids = rows.map((r) => r.id)
    expect(ids).toContain(active)
    expect(ids).not.toContain(closed)
  })

  it('isolates repairs by user_id', async () => {
    const otherUserId = await setupTestUser(client)
    await createTestProperty(client, otherUserId)
    const repairId = await insertRepair()

    await setAuthUser(client, otherUserId)
    const { rows } = await client.query('select * from public.repairs where user_id = $1', [otherUserId])
    expect(rows).toHaveLength(0)

    await setAuthUser(client, userId)
    const { rows: mine } = await client.query('select * from public.repairs where user_id = $1', [userId])
    expect(mine).toHaveLength(1)
    expect(mine[0].id).toBe(repairId)
  })

  it('rejects inserting a repair for another users property', async () => {
    const otherUserId = await setupTestUser(client)
    const otherPropertyId = await createTestProperty(client, otherUserId)

    await client.query('BEGIN')
    await client.query('SET LOCAL ROLE authenticated')
    await setAuthUser(client, userId)

    await expect(
      client.query(
        `insert into public.repairs (user_id, property_id, title, priority, status, reported_date)
         values ($1, $2, $3, $4, $5, $6)`,
        [userId, otherPropertyId, 'Bad repair', 'normal', 'reported', '2026-08-07'],
      ),
    ).rejects.toThrow()

    await client.query('ROLLBACK')
  })

  it('supports the full status lifecycle', async () => {
    const id = await insertRepair({ status: 'reported' })

    for (const status of ['evaluating', 'assigned', 'scheduled', 'completed', 'closed']) {
      await client.query('update public.repairs set status = $1 where id = $2', [status, id])
      const { rows } = await client.query('select status from public.repairs where id = $1', [id])
      expect(rows[0].status).toBe(status)
    }
  })

  it('preserves completed and closed repairs as history', async () => {
    const completed = await insertRepair({ status: 'completed', completed_date: '2026-08-10' })
    const closed = await insertRepair({ status: 'closed', completed_date: '2026-08-11' })

    await setAuthUser(client, userId)
    const { rows } = await client.query('select * from public.repairs where user_id = $1', [userId])
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.id).sort()).toEqual([completed, closed].sort())
  })
})
