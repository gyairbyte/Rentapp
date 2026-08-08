-- Document storage foundation additions
-- Extends the documents table with optional obligation linkage, notes, and a clean lifecycle default.

-- Link a document to a generic obligation (e.g., evidence) separate from the AI-confirmed obligation.
alter table public.documents
  add column if not exists obligation_id uuid null references public.obligations(id) on delete set null,
  add column if not exists notes text null;

-- Make the upload lifecycle default explicit. Existing pending rows are treated as uploaded.
update public.documents
  set processing_status = 'uploaded'
  where processing_status = 'pending' or processing_status is null;

alter table public.documents
  alter column processing_status set default 'uploaded';

alter table public.documents
  drop constraint if exists documents_processing_status_check;

alter table public.documents
  add constraint documents_processing_status_check
  check (processing_status in ('uploaded', 'processing', 'processed', 'failed'));

-- Indexes for common access patterns.
create index if not exists documents_user_id_idx on public.documents (user_id);
create index if not exists documents_user_status_idx on public.documents (user_id, review_status, processing_status);
create index if not exists documents_property_created_idx on public.documents (property_id, created_at desc);
create index if not exists documents_obligation_id_idx on public.documents (obligation_id);

-- Re-create document FK ownership policies to include obligation_id.
drop policy if exists "Users can insert own documents" on public.documents;
create policy "Users can insert own documents"
  on public.documents for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (property_id is null or property_id in (select id from public.properties where user_id = auth.uid()))
    and (account_id is null or account_id in (select id from public.accounts where user_id = auth.uid()))
    and (party_id is null or party_id in (select id from public.parties where user_id = auth.uid()))
    and (obligation_id is null or obligation_id in (select id from public.obligations where user_id = auth.uid()))
    and (confirmed_obligation_id is null or confirmed_obligation_id in (select id from public.obligations where user_id = auth.uid()))
    and (confirmed_task_id is null or confirmed_task_id in (select id from public.tasks where user_id = auth.uid()))
    and (duplicate_of_document_id is null or duplicate_of_document_id in (select id from public.documents where user_id = auth.uid()))
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
    and (obligation_id is null or obligation_id in (select id from public.obligations where user_id = auth.uid()))
    and (confirmed_obligation_id is null or confirmed_obligation_id in (select id from public.obligations where user_id = auth.uid()))
    and (confirmed_task_id is null or confirmed_task_id in (select id from public.tasks where user_id = auth.uid()))
    and (duplicate_of_document_id is null or duplicate_of_document_id in (select id from public.documents where user_id = auth.uid()))
  );

-- Ensure the authenticated role can access the table through RLS.
grant select, insert, update, delete on public.documents to authenticated;
