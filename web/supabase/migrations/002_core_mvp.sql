-- Core MVP schema additions

-- Property archiving
alter table public.properties add column if not exists archived boolean not null default false;

-- Parties
create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid null references public.properties(id) on delete set null,
  name text not null,
  party_type text not null,
  email text null,
  phone text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.parties enable row level security;

create policy "Users can view own parties"
  on public.parties for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own parties"
  on public.parties for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own parties"
  on public.parties for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own parties"
  on public.parties for delete
  to authenticated
  using (user_id = auth.uid());

-- Property accounts (utility / tax / insurance / etc.)
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  party_id uuid null references public.parties(id) on delete set null,
  account_type text not null,
  account_number text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounts enable row level security;

create policy "Users can view own accounts"
  on public.accounts for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own accounts"
  on public.accounts for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own accounts"
  on public.accounts for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own accounts"
  on public.accounts for delete
  to authenticated
  using (user_id = auth.uid());

-- Recurring obligation rules
create table if not exists public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  account_id uuid null references public.accounts(id) on delete set null,
  party_id uuid null references public.parties(id) on delete set null,
  direction text not null,
  category text not null,
  description text null,
  amount numeric(12,2) not null,
  frequency text not null,
  day_of_month integer not null,
  start_date date not null,
  end_date date null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recurring_rules enable row level security;

create policy "Users can view own recurring rules"
  on public.recurring_rules for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own recurring rules"
  on public.recurring_rules for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own recurring rules"
  on public.recurring_rules for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own recurring rules"
  on public.recurring_rules for delete
  to authenticated
  using (user_id = auth.uid());

-- Obligations (money owed or due)
create table if not exists public.obligations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  account_id uuid null references public.accounts(id) on delete set null,
  party_id uuid null references public.parties(id) on delete set null,
  recurring_rule_id uuid null references public.recurring_rules(id) on delete set null,
  direction text not null,
  category text not null,
  description text null,
  expected_amount numeric(12,2) not null,
  paid_amount numeric(12,2) not null default 0,
  due_date date not null,
  status text not null default 'upcoming',
  paid_date date null,
  period_start date null,
  period_end date null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.obligations enable row level security;

create policy "Users can view own obligations"
  on public.obligations for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own obligations"
  on public.obligations for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own obligations"
  on public.obligations for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own obligations"
  on public.obligations for delete
  to authenticated
  using (user_id = auth.uid());

-- Payments against obligations
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  obligation_id uuid not null references public.obligations(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_date date not null,
  method text null,
  confirmation_reference text null,
  notes text null,
  evidence_document_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments enable row level security;

create policy "Users can view own payments"
  on public.payments for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own payments"
  on public.payments for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own payments"
  on public.payments for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own payments"
  on public.payments for delete
  to authenticated
  using (user_id = auth.uid());

-- Documents
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid null references public.properties(id) on delete set null,
  storage_path text not null,
  original_filename text not null,
  mime_type text null,
  document_type text null,
  issuer text null,
  document_date date null,
  processing_status text not null default 'pending',
  review_status text not null default 'pending',
  raw_extracted_text text null,
  raw_ai_extraction text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "Users can view own documents"
  on public.documents for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own documents"
  on public.documents for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own documents"
  on public.documents for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own documents"
  on public.documents for delete
  to authenticated
  using (user_id = auth.uid());

-- Updated-at triggers for new tables
drop trigger if exists parties_updated_at on public.parties;
create trigger parties_updated_at
  before update on public.parties
  for each row
  execute function public.handle_updated_at();

drop trigger if exists accounts_updated_at on public.accounts;
create trigger accounts_updated_at
  before update on public.accounts
  for each row
  execute function public.handle_updated_at();

drop trigger if exists recurring_rules_updated_at on public.recurring_rules;
create trigger recurring_rules_updated_at
  before update on public.recurring_rules
  for each row
  execute function public.handle_updated_at();

drop trigger if exists obligations_updated_at on public.obligations;
create trigger obligations_updated_at
  before update on public.obligations
  for each row
  execute function public.handle_updated_at();

drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at
  before update on public.payments
  for each row
  execute function public.handle_updated_at();

drop trigger if exists documents_updated_at on public.documents;
create trigger documents_updated_at
  before update on public.documents
  for each row
  execute function public.handle_updated_at();

-- Private document storage bucket
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do update set public = false;

-- Storage policies: authenticated users own objects in the documents bucket
create policy "Users can upload own documents"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documents' and owner = auth.uid());

create policy "Users can view own documents"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documents' and owner = auth.uid());

create policy "Users can update own documents"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'documents' and owner = auth.uid())
  with check (owner = auth.uid());

create policy "Users can delete own documents"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'documents' and owner = auth.uid());
