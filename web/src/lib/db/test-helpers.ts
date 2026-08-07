import { Client } from 'pg'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

export type DbContext = {
  client: Client
  userId: string
  propertyId: string
  accountId: string | null
  partyId: string | null
}

export async function getTestDatabaseUrl(): Promise<string> {
  const url = process.env.TEST_DATABASE_URL
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Start a test Postgres with: scripts/start-test-db.sh',
    )
  }
  return url
}

export async function createPoolOrClient(): Promise<Client> {
  const url = await getTestDatabaseUrl()
  const client = new Client({ connectionString: url })
  await client.connect()
  return client
}

export async function resetSchema(client: Client) {
  await client.query('drop schema if exists public cascade')
  await client.query('create schema public')
  await client.query('drop schema if exists auth cascade')
  await client.query('create schema auth')
  await client.query('create extension if not exists pgcrypto')

  // Storage schema stubs referenced by migrations; only buckets and objects need to exist.
  await client.query('create schema if not exists storage')
  await client.query(`
    create table if not exists storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false
    )
  `)
  await client.query(`
    create table if not exists storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null,
      owner uuid null,
      path_tokens text[] null,
      created_at timestamptz not null default now()
    )
  `)

  // Roles referenced by migrations
  await client.query("do $$ begin if not exists (select from pg_roles where rolname = 'anon') then create role anon; end if; end $$")
  await client.query("do $$ begin if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated; end if; end $$")

  // Minimal auth implementation for local migration/RPC testing
  await client.query(`
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text null,
      created_at timestamptz not null default now()
    )
  `)
  await client.query(`
    create or replace function auth.uid()
    returns uuid
    language sql stable
    as $$
      select nullif(current_setting('app.current_user_id', true), '')::uuid;
    $$
  `)

  const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8')
    try {
      await client.query(sql)
    } catch (err) {
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`)
    }
  }
}

export async function setupTestUser(client: Client): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    "insert into auth.users (email) values ('test@example.com') returning id",
  )
  return rows[0].id
}

export async function createTestProperty(client: Client, userId: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into public.properties (user_id, nickname, street_address, city, state, zip)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [userId, '123 Main', '123 Main Street', 'Springfield', 'IL', '62704'],
  )
  return rows[0].id
}

export async function createTestDocument(
  client: Client,
  userId: string,
  extraction: object,
  overrides: { processing_status?: string; review_status?: string } = {},
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into public.documents (
      user_id, storage_path, original_filename, file_hash, file_size, mime_type,
      processing_status, review_status, raw_ai_extraction
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
    [
      userId,
      `${userId}/test.pdf`,
      'test.pdf',
      'deadbeef',
      1000,
      'application/pdf',
      overrides.processing_status ?? 'processed',
      overrides.review_status ?? 'unreviewed',
      JSON.stringify(extraction),
    ],
  )
  return rows[0].id
}

export async function setAuthUser(client: Client, userId: string) {
  await client.query('select set_config($1, $2, false)', ['app.current_user_id', userId])
}

export async function withTransaction<T>(client: Client, fn: () => Promise<T>): Promise<T> {
  await client.query('begin')
  try {
    const result = await fn()
    await client.query('rollback')
    return result
  } catch (err) {
    await client.query('rollback')
    throw err
  }
}
