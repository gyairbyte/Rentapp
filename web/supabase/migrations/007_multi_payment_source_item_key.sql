-- Harden multi-payment document confirmation integrity.
-- A single document can create multiple obligations, and two source items can legitimately
-- share the same due date, so identity must not rely on (source_document_id, due_date).
-- Add a stable source_item_key and enforce idempotency on (source_document_id, source_item_key).

alter table public.obligations
  add column if not exists source_item_key text null;

-- Remove any prior per-document uniqueness indexes so multiple source items per document are allowed.
drop index if exists public.obligations_source_document_id_due_date_unique;
drop index if exists public.obligations_source_document_id_unique;

-- A partial unique index would block ON CONFLICT inference, so use a non-partial index
-- and let source_item_key distinguish items. NULL keys do not conflict.
create unique index if not exists obligations_source_document_item_unique
  on public.obligations (source_document_id, source_item_key);

-- Atomic, idempotent, trust-boundary-aware document confirmation.
-- Payment plans are authoritative only from the document's stored extraction/AI result;
-- this function validates the selected plan against the supplied p_payment_options.
-- The client submits only a selected option index; the server action must load and
-- validate the document's canonical extraction before calling this function.
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
  p_task_title text default null,
  p_payment_options jsonb default '[]'::jsonb,
  p_selected_payment_option_index int default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document documents%rowtype;
  v_obligation_ids uuid[] := '{}'::uuid[];
  v_obligation_id uuid;
  v_task_id uuid;
  v_option jsonb;
  v_installments jsonb;
  v_inst jsonb;
  v_amount numeric(12,2);
  v_due_date date;
  v_status text;
  v_has_obligations boolean := false;
  v_should_create_task boolean := (p_required_action is not null or p_task_title is not null);
  v_i int;
  v_count int;
  v_source_item_key text;
  v_option_type text;
  v_existing_obligations uuid[];
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

  -- Idempotent retry: if already confirmed, return all downstream obligations.
  if v_document.review_status = 'confirmed' then
    select array_agg(id order by source_item_key nulls first, due_date)
    into v_existing_obligations
    from public.obligations
    where source_document_id = p_document_id and user_id = p_user_id;

    return jsonb_build_object(
      'obligation_id', v_document.confirmed_obligation_id,
      'obligation_ids', coalesce(to_jsonb(v_existing_obligations), '[]'::jsonb),
      'task_id', v_document.confirmed_task_id
    );
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

  -- Validate selected payment plan (authoritative extraction data supplied by server action).
  if p_selected_payment_option_index is not null then
    if p_payment_options is null or jsonb_typeof(p_payment_options) != 'array' then
      raise exception 'Invalid payment options' using errcode = 'P0001';
    end if;

    if p_selected_payment_option_index < 0 or p_selected_payment_option_index >= jsonb_array_length(p_payment_options) then
      raise exception 'Invalid payment option selection' using errcode = 'P0001';
    end if;

    v_option := p_payment_options->p_selected_payment_option_index;
    v_option_type := v_option->>'option_type';

    if v_option_type not in ('full', 'discounted', 'installment_plan') then
      raise exception 'Unrecognized or non-selectable payment option type' using errcode = 'P0001';
    end if;

    if v_option_type = 'installment_plan' then
      v_installments := v_option->'installments';
      v_count := coalesce(jsonb_array_length(v_installments), 0);
      if v_count = 0 then
        raise exception 'Installment plan must contain at least one installment' using errcode = 'P0001';
      end if;

      for v_i in 0..v_count - 1 loop
        v_inst := v_installments->v_i;
        begin
          v_amount := (v_inst->>'amount')::numeric(12,2);
          v_due_date := (v_inst->>'due_date')::date;
        exception when others then
          raise exception 'Installment % has invalid amount or due date', (v_i + 1) using errcode = 'P0001';
        end;

        if v_amount is null or v_amount <= 0 then
          raise exception 'Installment % amount must be greater than zero', (v_i + 1) using errcode = 'P0001';
        end if;
        if v_due_date is null then
          raise exception 'Installment % due date is required', (v_i + 1) using errcode = 'P0001';
        end if;

        v_status := case
          when v_due_date < current_date then 'overdue'
          when v_due_date <= current_date + interval '7 days' then 'due'
          else 'upcoming'
        end;

        v_source_item_key := 'option_' || p_selected_payment_option_index || ':installment_' || (v_i + 1);

        insert into public.obligations (
          user_id, property_id, account_id, party_id, source_document_id, source_item_key,
          direction, category, description, expected_amount, paid_amount,
          due_date, status, paid_date, period_start, period_end, notes
        ) values (
          p_user_id, p_property_id, p_account_id, p_party_id, p_document_id, v_source_item_key,
          p_direction, p_category, coalesce(v_inst->>'description', p_description, p_category), v_amount, 0,
          v_due_date, v_status, null, p_period_start, p_period_end, null
        )
        on conflict (source_document_id, source_item_key) do update set
          property_id = excluded.property_id,
          account_id = excluded.account_id,
          party_id = excluded.party_id,
          source_item_key = excluded.source_item_key,
          direction = excluded.direction,
          category = excluded.category,
          description = excluded.description,
          expected_amount = excluded.expected_amount,
          due_date = excluded.due_date,
          status = excluded.status,
          period_start = excluded.period_start,
          period_end = excluded.period_end
        returning id into v_obligation_id;

        v_obligation_ids := v_obligation_ids || v_obligation_id;
        v_has_obligations := true;
      end loop;
    else
      begin
        v_amount := (v_option->>'amount')::numeric(12,2);
        v_due_date := (v_option->>'due_date')::date;
      exception when others then
        raise exception 'Selected payment option has invalid amount or due date' using errcode = 'P0001';
      end;

      if v_amount is null or v_amount <= 0 then
        raise exception 'Selected payment option amount must be greater than zero' using errcode = 'P0001';
      end if;
      if v_due_date is null then
        raise exception 'Selected payment option due date is required' using errcode = 'P0001';
      end if;

      v_status := case
        when v_due_date < current_date then 'overdue'
        when v_due_date <= current_date + interval '7 days' then 'due'
        else 'upcoming'
      end;

      v_source_item_key := 'option_' || p_selected_payment_option_index || ':' || v_option_type;

      insert into public.obligations (
        user_id, property_id, account_id, party_id, source_document_id, source_item_key,
        direction, category, description, expected_amount, paid_amount,
        due_date, status, paid_date, period_start, period_end, notes
      ) values (
        p_user_id, p_property_id, p_account_id, p_party_id, p_document_id, v_source_item_key,
        p_direction, p_category, coalesce(v_option->>'description', p_description, p_category), v_amount, 0,
        v_due_date, v_status, null, p_period_start, p_period_end, null
      )
      on conflict (source_document_id, source_item_key) do update set
        property_id = excluded.property_id,
        account_id = excluded.account_id,
        party_id = excluded.party_id,
        source_item_key = excluded.source_item_key,
        direction = excluded.direction,
        category = excluded.category,
        description = excluded.description,
        expected_amount = excluded.expected_amount,
        due_date = excluded.due_date,
        status = excluded.status,
        period_start = excluded.period_start,
        period_end = excluded.period_end
      returning id into v_obligation_id;

      v_obligation_ids := array[v_obligation_id];
      v_has_obligations := true;
    end if;
  end if;

  -- Fallback single-obligation path: used for legacy/manual confirmations with no payment plan.
  if not v_has_obligations then
    if p_amount is null or p_amount <= 0 or p_due_date is null then
      raise exception 'Amount and due date are required to create an obligation' using errcode = 'P0001';
    end if;

    v_status := case
      when p_due_date < current_date then 'overdue'
      when p_due_date <= current_date + interval '7 days' then 'due'
      else 'upcoming'
    end;

    v_source_item_key := 'single';

    insert into public.obligations (
      user_id, property_id, account_id, party_id, source_document_id, source_item_key,
      direction, category, description, expected_amount, paid_amount,
      due_date, status, paid_date, period_start, period_end, notes
    ) values (
      p_user_id, p_property_id, p_account_id, p_party_id, p_document_id, v_source_item_key,
      p_direction, p_category, coalesce(p_description, p_category), p_amount, 0,
      p_due_date, v_status, null, p_period_start, p_period_end, null
    )
    on conflict (source_document_id, source_item_key) do update set
      property_id = excluded.property_id,
      account_id = excluded.account_id,
      party_id = excluded.party_id,
      source_item_key = excluded.source_item_key,
      direction = excluded.direction,
      category = excluded.category,
      description = excluded.description,
      expected_amount = excluded.expected_amount,
      due_date = excluded.due_date,
      status = excluded.status,
      period_start = excluded.period_start,
      period_end = excluded.period_end
    returning id into v_obligation_id;

    v_obligation_ids := array[v_obligation_id];
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
    confirmed_obligation_id = v_obligation_ids[1],
    confirmed_task_id = v_task_id
  where id = p_document_id and user_id = p_user_id;

  return jsonb_build_object(
    'obligation_id', v_obligation_ids[1],
    'obligation_ids', coalesce(to_jsonb(v_obligation_ids), '[]'::jsonb),
    'task_id', v_task_id
  );
end;
$$;

grant execute on function public.confirm_document to authenticated;
