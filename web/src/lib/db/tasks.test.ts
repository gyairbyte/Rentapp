import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Client } from 'pg'
import {
  createPoolOrClient,
  resetSchema,
  setupTestUser,
  createTestProperty,
  createTestDocument,
  setAuthUser,
} from './test-helpers'

const createTestParty = async (client: Client, userId: string, propertyId: string | null = null) => {
  const { rows } = await client.query<{ id: string }>(
    `insert into public.parties (user_id, name, party_type, property_id)
     values ($1, $2, $3, $4) returning id`,
    [userId, 'Test Party', 'contractor', propertyId],
  )
  return rows[0].id
}

const createDocumentWithHash = async (client: Client, userId: string, hash: string) => {
  const { rows } = await client.query<{ id: string }>(
    `insert into public.documents (
      user_id, storage_path, original_filename, file_hash, file_size, mime_type,
      processing_status, review_status, raw_ai_extraction
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
    [userId, `${userId}/test.pdf`, 'test.pdf', hash, 1000, 'application/pdf', 'processed', 'unreviewed', '{}'],
  )
  return rows[0].id
}

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeDb('tasks migration and RLS', () => {
  let client: Client
  let userId: string
  let otherUserId: string
  let propertyId: string
  let secondPropertyId: string
  let otherPropertyId: string
  let secondPropertyPartyId: string
  let globalPartyId: string

  beforeAll(async () => {
    client = await createPoolOrClient()
    await resetSchema(client)
    userId = await setupTestUser(client)
    otherUserId = await setupTestUser(client)
    propertyId = await createTestProperty(client, userId)
    secondPropertyId = await createTestProperty(client, userId)
    otherPropertyId = await createTestProperty(client, otherUserId)
    secondPropertyPartyId = await createTestParty(client, userId, secondPropertyId)
    globalPartyId = await createTestParty(client, userId, null)
  }, 60000)

  afterAll(async () => {
    await client?.end()
  })

  beforeEach(async () => {
    await client.query('ROLLBACK').catch(() => {})
    await client.query('RESET ROLE').catch(() => {})
  })

  async function asAuthenticated(fn: () => Promise<void>) {
    await client.query('BEGIN')
    await client.query('SET LOCAL ROLE authenticated')
    await setAuthUser(client, userId)
    try {
      await fn()
    } finally {
      await client.query('ROLLBACK').catch(() => {})
    }
  }

  it('rejects unsupported statuses and priorities', async () => {
    await asAuthenticated(async () => {
      await expect(
        client.query(`insert into public.tasks (user_id, title, status, priority) values ($1, $2, $3, $4)`, [
          userId,
          'Bad',
          'pending',
          'normal',
        ]),
      ).rejects.toThrow()

      await client.query('ROLLBACK').catch(() => {})
      await client.query('BEGIN')
      await client.query('SET LOCAL ROLE authenticated')
      await setAuthUser(client, userId)

      await expect(
        client.query(`insert into public.tasks (user_id, title, status, priority) values ($1, $2, $3, $4)`, [
          userId,
          'Bad',
          'open',
          'extreme',
        ]),
      ).rejects.toThrow()
    })
  })

  it('defaults status to open and priority to normal', async () => {
    await asAuthenticated(async () => {
      const { rows } = await client.query<{ id: string; status: string; priority: string }>(
        `insert into public.tasks (user_id, title) values ($1, $2) returning id, status, priority`,
        [userId, 'Default task'],
      )
      expect(rows[0].status).toBe('open')
      expect(rows[0].priority).toBe('normal')
    })
  })

  it('sets completed_at on completion and clears on reopen', async () => {
    await asAuthenticated(async () => {
      const { rows } = await client.query<{ id: string }>(
        `insert into public.tasks (user_id, title, status) values ($1, $2, 'open') returning id`,
        [userId, 'Lifecycle'],
      )
      const taskId = rows[0].id

      await client.query(`update public.tasks set status = 'completed' where id = $1`, [taskId])
      const completed = await client.query(`select completed_at from public.tasks where id = $1`, [taskId])
      expect(completed.rows[0].completed_at).not.toBeNull()

      await client.query(`update public.tasks set status = 'open' where id = $1`, [taskId])
      const reopened = await client.query(`select completed_at from public.tasks where id = $1`, [taskId])
      expect(reopened.rows[0].completed_at).toBeNull()
    })
  })

  it('enforces user isolation through RLS', async () => {
    await asAuthenticated(async () => {
      const { rows } = await client.query<{ id: string }>(
        `insert into public.tasks (user_id, title) values ($1, $2) returning id`,
        [userId, 'Private task'],
      )
      const taskId = rows[0].id

      await setAuthUser(client, otherUserId)
      const otherRead = await client.query(`select id from public.tasks where id = $1`, [taskId])
      expect(otherRead.rows).toHaveLength(0)

      const otherUpdate = await client.query(`update public.tasks set title = 'Hacked' where id = $1`, [taskId])
      expect(otherUpdate.rowCount).toBe(0)

      const otherDelete = await client.query(`delete from public.tasks where id = $1`, [taskId])
      expect(otherDelete.rowCount).toBe(0)
    })
  })

  it('rejects a property owned by another user', async () => {
    await asAuthenticated(async () => {
      await expect(
        client.query(
          `insert into public.tasks (user_id, title, property_id) values ($1, $2, $3)`,
          [userId, 'Wrong property', otherPropertyId],
        ),
      ).rejects.toThrow()
    })
  })

  it('rejects a party that belongs to a different property', async () => {
    await asAuthenticated(async () => {
      await expect(
        client.query(
          `insert into public.tasks (user_id, title, property_id, party_id) values ($1, $2, $3, $4)`,
          [userId, 'Party mismatch', propertyId, secondPropertyPartyId],
        ),
      ).rejects.toThrow(/Party does not belong/)
    })
  })

  it('allows a global party with any property', async () => {
    await asAuthenticated(async () => {
      const { rows } = await client.query<{ id: string }>(
        `insert into public.tasks (user_id, title, property_id, party_id) values ($1, $2, $3, $4) returning id`,
        [userId, 'Global party ok', propertyId, globalPartyId],
      )
      expect(rows[0].id).toBeTruthy()
    })
  })

  it('prevents source_document_id from being changed', async () => {
    await asAuthenticated(async () => {
      const documentId = await createDocumentWithHash(client, userId, 'deadbeef')
      const otherDocumentId = await createDocumentWithHash(client, userId, 'cafebabe')

      const { rows } = await client.query<{ id: string }>(
        `insert into public.tasks (user_id, title, source_document_id) values ($1, $2, $3) returning id`,
        [userId, 'Source linked', documentId],
      )
      const taskId = rows[0].id

      await expect(
        client.query(`update public.tasks set source_document_id = $1 where id = $2`, [otherDocumentId, taskId]),
      ).rejects.toThrow(/source_document_id cannot be changed/)
    })
  })

  it('confirms a document task idempotently', async () => {
    await client.query('BEGIN')
    await setAuthUser(client, userId)
    const documentId = await createTestDocument(client, userId, {})

    const first = await client.query<{ result: { task_id?: string } }>(
      `select public.confirm_document($1, $2, $3, null, null, null, null, null, '2026-08-10', null, null, 100, 'payable', 'other', null, 'Fix roof', '2026-08-10', 'Fix roof', '[]'::jsonb, null) as result`,
      [userId, documentId, propertyId],
    )
    const firstTaskId = first.rows[0].result.task_id
    expect(firstTaskId).toBeTruthy()

    const second = await client.query<{ result: { task_id?: string } }>(
      `select public.confirm_document($1, $2, $3, null, null, null, null, null, '2026-08-10', null, null, 100, 'payable', 'other', null, 'Fix roof', '2026-08-10', 'Fix roof', '[]'::jsonb, null) as result`,
      [userId, documentId, propertyId],
    )
    expect(second.rows[0].result.task_id).toBe(firstTaskId)

    const count = await client.query(`select count(*) from public.tasks where source_document_id = $1`, [documentId])
    expect(count.rows[0].count).toBe('1')
    await client.query('ROLLBACK')
  })
})
