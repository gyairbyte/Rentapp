-- Tasks & Deadlines workspace v1

-- Track when a task was completed.
alter table public.tasks add column if not exists completed_at timestamptz null;

-- Backfill missing/null priorities and unsupported statuses before adding constraints.
update public.tasks
set priority = 'normal'
where priority is null or priority = '';

update public.tasks
set status = 'open'
where status not in ('open', 'in_progress', 'completed', 'canceled') or status is null;

update public.tasks
set completed_at = updated_at
where status = 'completed' and completed_at is null;

-- Enforce the supported task lifecycle and priorities.
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check
  check (status in ('open', 'in_progress', 'completed', 'canceled'));

alter table public.tasks drop constraint if exists tasks_priority_check;
alter table public.tasks add constraint tasks_priority_check
  check (priority in ('low', 'normal', 'high', 'urgent'));

alter table public.tasks alter column status set default 'open';
alter table public.tasks alter column priority set default 'normal';

-- Make source_document_id immutable so users cannot reassign the source of an AI-created task.
create or replace function public.tasks_immutable_source_document()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if NEW.source_document_id is distinct from OLD.source_document_id then
    raise exception 'source_document_id cannot be changed' using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

drop trigger if exists tasks_immutable_source_document_trigger on public.tasks;
create trigger tasks_immutable_source_document_trigger
  before update on public.tasks
  for each row
  execute function public.tasks_immutable_source_document();

-- Set and clear completed_at based on status.
create or replace function public.tasks_completed_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.status = 'completed' and NEW.completed_at is null then
      NEW.completed_at := now();
    end if;
  elsif TG_OP = 'UPDATE' then
    if NEW.status = 'completed' and (OLD.status != 'completed' or NEW.completed_at is null) then
      NEW.completed_at := now();
    elsif NEW.status != 'completed' then
      NEW.completed_at := null;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists tasks_completed_at_trigger on public.tasks;
create trigger tasks_completed_at_trigger
  before insert or update on public.tasks
  for each row
  execute function public.tasks_completed_at();

-- Ensure a task's party belongs to the selected property or is a global party.
create or replace function public.tasks_party_property_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_party_property_id uuid;
begin
  if NEW.party_id is not null then
    select property_id into v_party_property_id
    from public.parties
    where id = NEW.party_id and user_id = NEW.user_id;

    if not found then
      raise exception 'Party not found' using errcode = 'P0001';
    end if;

    if v_party_property_id is not null and v_party_property_id is distinct from NEW.property_id then
      raise exception 'Party does not belong to the selected property' using errcode = 'P0001';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists tasks_party_property_consistency_trigger on public.tasks;
create trigger tasks_party_property_consistency_trigger
  before insert or update on public.tasks
  for each row
  execute function public.tasks_party_property_consistency();

-- Useful access patterns.
create index if not exists idx_tasks_user_status_due on public.tasks (user_id, status, due_date);
create index if not exists idx_tasks_user_priority on public.tasks (user_id, priority);
create index if not exists idx_tasks_property_id on public.tasks (property_id);
create index if not exists idx_tasks_due_date on public.tasks (due_date);

-- Harden RLS policies to include source-document ownership and keep user scoping.
drop policy if exists "Users can view own tasks" on public.tasks;
drop policy if exists "Users can insert own tasks" on public.tasks;
drop policy if exists "Users can update own tasks" on public.tasks;
drop policy if exists "Users can delete own tasks" on public.tasks;

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

-- Ensure the authenticated role can still access the table through RLS.
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on public.tasks to authenticated, anon;
