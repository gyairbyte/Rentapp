-- Document Intelligence phase schema additions

-- Extend documents with processing metadata and review linkage
alter table public.documents
  add column if not exists file_hash text,
  add column if not exists file_size bigint,
  add column if not exists processing_error text,
  add column if not exists account_id uuid null references public.accounts(id) on delete set null,
  add column if not exists party_id uuid null references public.parties(id) on delete set null,
  add column if not exists confirmed_obligation_id uuid null references public.obligations(id) on delete set null,
  add column if not exists confirmed_task_id uuid null references public.tasks(id) on delete set null,
  add column if not exists duplicate_of_document_id uuid null references public.documents(id) on delete set null;

-- Exact duplicate prevention per user by file hash
create unique index if not exists documents_user_file_hash_unique
  on public.documents (user_id, file_hash)
  where file_hash is not null;

-- Document processing runs (auditable, supports retries)
create table if not exists public.document_processing_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  provider text not null,
  model text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  status text not null default 'running',
  input_tokens bigint null,
  output_tokens bigint null,
  duration_ms bigint null,
  normalized_extraction jsonb null,
  raw_output jsonb null,
  extracted_text text null,
  error_message text null,
  created_at timestamptz not null default now()
);

alter table public.document_processing_runs enable row level security;

create policy "Users can view own document processing runs"
  on public.document_processing_runs for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own document processing runs"
  on public.document_processing_runs for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own document processing runs"
  on public.document_processing_runs for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own document processing runs"
  on public.document_processing_runs for delete
  to authenticated
  using (user_id = auth.uid());

-- Tasks for nonfinancial actions from documents
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid null references public.properties(id) on delete set null,
  party_id uuid null references public.parties(id) on delete set null,
  source_document_id uuid null references public.documents(id) on delete set null,
  title text not null,
  description text null,
  due_date date null,
  status text not null default 'open',
  priority text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "Users can view own tasks"
  on public.tasks for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own tasks"
  on public.tasks for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (property_id is null or property_id in (select id from public.properties where user_id = auth.uid()))
    and (party_id is null or party_id in (select id from public.parties where user_id = auth.uid()))
    and (source_document_id is null or source_document_id in (select id from public.documents where user_id = auth.uid()))
  );

create policy "Users can update own tasks"
  on public.tasks for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (property_id is null or property_id in (select id from public.properties where user_id = auth.uid()))
    and (party_id is null or party_id in (select id from public.parties where user_id = auth.uid()))
    and (source_document_id is null or source_document_id in (select id from public.documents where user_id = auth.uid()))
  );

create policy "Users can delete own tasks"
  on public.tasks for delete
  to authenticated
  using (user_id = auth.uid());

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
  before update on public.tasks
  for each row
  execute function public.handle_updated_at();

-- Link obligations and payments back to source documents
alter table public.obligations
  add column if not exists source_document_id uuid null references public.documents(id) on delete set null;

alter table public.payments
  add column if not exists evidence_document_id uuid null references public.documents(id) on delete set null;

-- Document FK ownership policies (drop existing and recreate with additional FKs)
drop policy if exists "Users can insert own documents" on public.documents;
create policy "Users can insert own documents"
  on public.documents for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (property_id is null or property_id in (select id from public.properties where user_id = auth.uid()))
    and (account_id is null or account_id in (select id from public.accounts where user_id = auth.uid()))
    and (party_id is null or party_id in (select id from public.parties where user_id = auth.uid()))
  );

drop policy if exists "Users can update own documents" on public.documents;
create policy "Users can update own documents"
  on public.documents for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (property_id is null or property_id in (select id from public.properties where user_id = auth.uid()))
    and (account_id is null or account_id in (select id from public.accounts where user_id = auth.uid()))
    and (party_id is null or party_id in (select id from public.parties where user_id = auth.uid()))
    and (confirmed_obligation_id is null or confirmed_obligation_id in (select id from public.obligations where user_id = auth.uid()))
    and (confirmed_task_id is null or confirmed_task_id in (select id from public.tasks where user_id = auth.uid()))
    and (duplicate_of_document_id is null or duplicate_of_document_id in (select id from public.documents where user_id = auth.uid()))
  );

-- Obligations policy needs to validate source_document ownership
drop policy if exists "Users can insert own obligations" on public.obligations;
create policy "Users can insert own obligations"
  on public.obligations for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and property_id in (select id from public.properties where user_id = auth.uid())
    and (account_id is null or account_id in (select id from public.accounts where user_id = auth.uid()))
    and (party_id is null or party_id in (select id from public.parties where user_id = auth.uid()))
    and (recurring_rule_id is null or recurring_rule_id in (select id from public.recurring_rules where user_id = auth.uid()))
    and (source_document_id is null or source_document_id in (select id from public.documents where user_id = auth.uid()))
  );

drop policy if exists "Users can update own obligations" on public.obligations;
create policy "Users can update own obligations"
  on public.obligations for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and property_id in (select id from public.properties where user_id = auth.uid())
    and (account_id is null or account_id in (select id from public.accounts where user_id = auth.uid()))
    and (party_id is null or party_id in (select id from public.parties where user_id = auth.uid()))
    and (recurring_rule_id is null or recurring_rule_id in (select id from public.recurring_rules where user_id = auth.uid()))
    and (source_document_id is null or source_document_id in (select id from public.documents where user_id = auth.uid()))
  );

-- Payments policy needs to validate evidence_document ownership
drop policy if exists "Users can insert own payments" on public.payments;
create policy "Users can insert own payments"
  on public.payments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and property_id in (select id from public.properties where user_id = auth.uid())
    and obligation_id in (select id from public.obligations where user_id = auth.uid())
    and (evidence_document_id is null or evidence_document_id in (select id from public.documents where user_id = auth.uid()))
  );

drop policy if exists "Users can update own payments" on public.payments;
create policy "Users can update own payments"
  on public.payments for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and property_id in (select id from public.properties where user_id = auth.uid())
    and obligation_id in (select id from public.obligations where user_id = auth.uid())
    and (evidence_document_id is null or evidence_document_id in (select id from public.documents where user_id = auth.uid()))
  );

-- Grant access to new tables
grant select, insert, update, delete on public.document_processing_runs to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant usage, select on all sequences in schema public to authenticated;
