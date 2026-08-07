create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null,
  street_address text not null,
  city text not null,
  state text not null,
  zip text not null,
  property_type text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.properties enable row level security;

create policy "Users can view own properties"
  on public.properties for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own properties"
  on public.properties for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own properties"
  on public.properties for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own properties"
  on public.properties for delete
  to authenticated
  using (user_id = auth.uid());

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists properties_updated_at on public.properties;
create trigger properties_updated_at
  before update on public.properties
  for each row
  execute function public.handle_updated_at();

-- Grant table access to Supabase auth roles so RLS policies can be evaluated.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.properties to anon, authenticated;
