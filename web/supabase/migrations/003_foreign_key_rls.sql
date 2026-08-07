-- Harden cross-table ownership so users cannot create records that reference
-- another user's properties, parties, accounts, recurring rules, or obligations.
-- Select/delete policies remain user-scoped on the row's user_id.
-- Insert/update policies additionally validate that referenced FKs belong to the current user.

-- Parties

drop policy if exists "Users can insert own parties" on public.parties;
create policy "Users can insert own parties"
  on public.parties for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (property_id is null or property_id in (select id from public.properties where user_id = auth.uid()))
  );

drop policy if exists "Users can update own parties" on public.parties;
create policy "Users can update own parties"
  on public.parties for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (property_id is null or property_id in (select id from public.properties where user_id = auth.uid()))
  );

-- Accounts

drop policy if exists "Users can insert own accounts" on public.accounts;
create policy "Users can insert own accounts"
  on public.accounts for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and property_id in (select id from public.properties where user_id = auth.uid())
    and (party_id is null or party_id in (select id from public.parties where user_id = auth.uid()))
  );

drop policy if exists "Users can update own accounts" on public.accounts;
create policy "Users can update own accounts"
  on public.accounts for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and property_id in (select id from public.properties where user_id = auth.uid())
    and (party_id is null or party_id in (select id from public.parties where user_id = auth.uid()))
  );

-- Recurring rules

drop policy if exists "Users can insert own recurring rules" on public.recurring_rules;
create policy "Users can insert own recurring rules"
  on public.recurring_rules for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and property_id in (select id from public.properties where user_id = auth.uid())
    and (account_id is null or account_id in (select id from public.accounts where user_id = auth.uid()))
    and (party_id is null or party_id in (select id from public.parties where user_id = auth.uid()))
  );

drop policy if exists "Users can update own recurring rules" on public.recurring_rules;
create policy "Users can update own recurring rules"
  on public.recurring_rules for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and property_id in (select id from public.properties where user_id = auth.uid())
    and (account_id is null or account_id in (select id from public.accounts where user_id = auth.uid()))
    and (party_id is null or party_id in (select id from public.parties where user_id = auth.uid()))
  );

-- Obligations

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
  );

-- Payments

drop policy if exists "Users can insert own payments" on public.payments;
create policy "Users can insert own payments"
  on public.payments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and property_id in (select id from public.properties where user_id = auth.uid())
    and obligation_id in (select id from public.obligations where user_id = auth.uid())
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
  );

-- Documents

drop policy if exists "Users can insert own documents" on public.documents;
create policy "Users can insert own documents"
  on public.documents for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (property_id is null or property_id in (select id from public.properties where user_id = auth.uid()))
  );

drop policy if exists "Users can update own documents" on public.documents;
create policy "Users can update own documents"
  on public.documents for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (property_id is null or property_id in (select id from public.properties where user_id = auth.uid()))
  );
