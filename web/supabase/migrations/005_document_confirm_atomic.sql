-- Replace partial unique indexes on source_document_id with non-partial unique indexes.
-- PostgreSQL unique indexes allow multiple NULL values, and ON CONFLICT(source_document_id)
-- can only target a deterministic non-partial unique constraint or index.

drop index if exists public.obligations_source_document_id_unique;
create unique index if not exists obligations_source_document_id_unique
  on public.obligations (source_document_id);

drop index if exists public.tasks_source_document_id_unique;
create unique index if not exists tasks_source_document_id_unique
  on public.tasks (source_document_id);

-- Atomic, idempotent document confirmation.
-- All writes (obligation, task, document confirmation) happen in one transaction.
-- If any step fails, the whole transaction rolls back.
-- If the document is already confirmed, the function returns the existing ids.
-- Ownership is enforced by checking auth.uid() against the supplied user_id and
-- by validating that referenced properties/accounts/parties belong to that user.
create or replace function public.confirm_document(
  p_user_id uuid,
  p_document_id uuid,
  p_property_id uuid,
  p_account_id uuid default null,
  p_party_id uuid default null,
  p_document_type text default null,
  p_issuer text default null,
  p_document_date date default null,
  p_due_date date default null,
  p_period_start date default null,
  p_period_end date default null,
  p_amount numeric(12,2) default null,
  p_direction text default 'payable',
  p_category text default 'other',
  p_description text default null,
  p_required_action text default null,
  p_action_due_date date default null,
  p_task_title text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document documents%rowtype;
  v_obligation_id uuid;
  v_task_id uuid;
  v_should_create_obligation boolean := (p_amount is not null and p_amount > 0 and p_due_date is not null);
  v_should_create_task boolean := (p_required_action is not null or p_task_title is not null);
  v_status text;
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'User mismatch' using errcode = 'P0001';
  end if;

  select * into v_document
  from public.documents
  where id = p_document_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Document not found' using errcode = 'P0001';
  end if;

  -- Idempotent retry: if already confirmed, return the existing downstream ids.
  if v_document.review_status = 'confirmed' then
    return jsonb_build_object('obligation_id', v_document.confirmed_obligation_id, 'task_id', v_document.confirmed_task_id);
  end if;

  if p_property_id is null or not exists (
    select 1 from public.properties where id = p_property_id and user_id = p_user_id
  ) then
    raise exception 'Property is required and must belong to the user' using errcode = 'P0001';
  end if;

  if p_account_id is not null and not exists (
    select 1 from public.accounts
    where id = p_account_id and user_id = p_user_id
      and (property_id = p_property_id)
  ) then
    raise exception 'Account does not belong to the user or property' using errcode = 'P0001';
  end if;

  if p_party_id is not null and not exists (
    select 1 from public.parties
    where id = p_party_id and user_id = p_user_id
      and (property_id is null or property_id = p_property_id)
  ) then
    raise exception 'Party does not belong to the user or property' using errcode = 'P0001';
  end if;

  if v_should_create_obligation then
    v_status := case
      when p_due_date < current_date then 'overdue'
      when p_due_date <= current_date + interval '7 days' then 'due'
      else 'upcoming'
    end;

    insert into public.obligations (
      user_id, property_id, account_id, party_id, source_document_id,
      direction, category, description, expected_amount, paid_amount,
      due_date, status, paid_date, period_start, period_end, notes
    ) values (
      p_user_id, p_property_id, p_account_id, p_party_id, p_document_id,
      p_direction, p_category, coalesce(p_description, p_category), p_amount, 0,
      p_due_date, v_status, null, p_period_start, p_period_end, null
    )
    on conflict (source_document_id) do update set
      property_id = excluded.property_id,
      account_id = excluded.account_id,
      party_id = excluded.party_id,
      direction = excluded.direction,
      category = excluded.category,
      description = excluded.description,
      expected_amount = excluded.expected_amount,
      due_date = excluded.due_date,
      status = excluded.status,
      period_start = excluded.period_start,
      period_end = excluded.period_end
    returning id into v_obligation_id;
  end if;

  if v_should_create_task then
    insert into public.tasks (
      user_id, property_id, party_id, source_document_id,
      title, description, due_date, status, priority
    ) values (
      p_user_id, p_property_id, p_party_id, p_document_id,
      coalesce(p_task_title, p_required_action, 'Task'), p_required_action, p_action_due_date, 'open', 'normal'
    )
    on conflict (source_document_id) do update set
      property_id = excluded.property_id,
      party_id = excluded.party_id,
      title = excluded.title,
      description = excluded.description,
      due_date = excluded.due_date
    returning id into v_task_id;
  end if;

  update public.documents
  set
    property_id = p_property_id,
    account_id = p_account_id,
    party_id = p_party_id,
    document_type = p_document_type,
    issuer = p_issuer,
    document_date = p_document_date,
    review_status = 'confirmed',
    confirmed_obligation_id = v_obligation_id,
    confirmed_task_id = v_task_id
  where id = p_document_id and user_id = p_user_id;

  return jsonb_build_object('obligation_id', v_obligation_id, 'task_id', v_task_id);
end;
$$;

grant execute on function public.confirm_document to authenticated;
