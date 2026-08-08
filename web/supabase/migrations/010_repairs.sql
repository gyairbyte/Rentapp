-- Repairs / work orders

-- Statuses: reported, evaluating, assigned, scheduled, completed, closed
-- Priorities: low, normal, urgent

create table if not exists public.repairs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  party_id uuid null references public.parties(id) on delete set null,
  title text not null,
  description text null,
  priority text not null default 'normal',
  status text not null default 'reported',
  reported_date date not null,
  scheduled_date date null,
  completed_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.repairs enable row level security;

-- Indexes for common access patterns
create index if not exists repairs_user_id_idx on public.repairs (user_id);
create index if not exists repairs_user_status_idx on public.repairs (user_id, status);
create index if not exists repairs_property_status_idx on public.repairs (property_id, status);
create index if not exists repairs_party_id_idx on public.repairs (party_id);

-- Updated-at trigger
drop trigger if exists repairs_updated_at on public.repairs;
create trigger repairs_updated_at
  before update on public.repairs
  for each row
  execute function public.handle_updated_at();

-- Policies

drop policy if exists "Users can view own repairs" on public.repairs;
create policy "Users can view own repairs"
  on public.repairs for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert own repairs" on public.repairs;
create policy "Users can insert own repairs"
  on public.repairs for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and property_id in (select id from public.properties where user_id = auth.uid())
    and (party_id is null or party_id in (select id from public.parties where user_id = auth.uid()))
  );

drop policy if exists "Users can update own repairs" on public.repairs;
create policy "Users can update own repairs"
  on public.repairs for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and property_id in (select id from public.properties where user_id = auth.uid())
    and (party_id is null or party_id in (select id from public.parties where user_id = auth.uid()))
  );

drop policy if exists "Users can delete own repairs" on public.repairs;
create policy "Users can delete own repairs"
  on public.repairs for delete
  to authenticated
  using (user_id = auth.uid());
