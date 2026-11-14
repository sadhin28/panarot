-- Pan Arot Pro initial schema. Apply in a new Supabase project.
create extension if not exists pgcrypto;

create type public.app_role as enum ('admin','employee');
create type public.party_status as enum ('active','inactive');
create type public.payment_method as enum ('cash','bank','bkash','nagad','rocket','other');
create type public.transaction_status as enum ('draft','posted','reversed');

create table public.business_settings (
  id uuid primary key default gen_random_uuid(),
  business_name text not null default 'আমার পান আরত',
  address text,
  phone text,
  logo_url text,
  commission_rate numeric(6,3) not null default 10 check (commission_rate >= 0 and commission_rate <= 100),
  timezone text not null default 'Asia/Dhaka',
  currency_code text not null default 'BDT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'employee',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.buyers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  full_name text not null,
  phone text,
  address text,
  status public.party_status not null default 'active',
  opening_balance numeric(14,2) not null default 0,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index buyers_name_idx on public.buyers using gin (to_tsvector('simple', full_name));
create index buyers_phone_idx on public.buyers(phone);

create table public.sellers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  full_name text not null,
  phone text,
  address text,
  status public.party_status not null default 'active',
  opening_balance numeric(14,2) not null default 0,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sellers_name_idx on public.sellers using gin (to_tsvector('simple', full_name));
create index sellers_phone_idx on public.sellers(phone);

create table public.pan_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit_name text not null default 'বীরা',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  transaction_no text not null unique,
  transaction_date date not null default (now() at time zone 'Asia/Dhaka')::date,
  seller_id uuid not null references public.sellers(id),
  pan_type_id uuid references public.pan_types(id),
  pan_type_name text not null default 'সাধারণ পান',
  quantity_bira numeric(14,3) not null check (quantity_bira > 0),
  rate_per_bira numeric(14,2) not null check (rate_per_bira >= 0),
  gross_amount numeric(14,2) generated always as (round(quantity_bira * rate_per_bira, 2)) stored,
  commission_rate numeric(6,3) not null default 10 check (commission_rate >= 0 and commission_rate <= 100),
  commission_amount numeric(14,2) not null check (commission_amount >= 0),
  net_payable numeric(14,2) not null check (net_payable >= 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  due_amount numeric(14,2) not null default 0 check (due_amount >= 0),
  status public.transaction_status not null default 'posted',
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (commission_amount <= gross_amount),
  check (net_payable = gross_amount - commission_amount),
  check (paid_amount + due_amount = net_payable)
);
create index purchases_date_idx on public.purchases(transaction_date desc);
create index purchases_seller_idx on public.purchases(seller_id, transaction_date desc);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  transaction_no text not null unique,
  transaction_date date not null default (now() at time zone 'Asia/Dhaka')::date,
  buyer_id uuid not null references public.buyers(id),
  pan_type_id uuid references public.pan_types(id),
  pan_type_name text not null default 'সাধারণ পান',
  quantity_bira numeric(14,3) not null check (quantity_bira > 0),
  rate_per_bira numeric(14,2) not null check (rate_per_bira >= 0),
  total_amount numeric(14,2) not null check (total_amount >= 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  due_amount numeric(14,2) not null default 0 check (due_amount >= 0),
  status public.transaction_status not null default 'posted',
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_amount = round(quantity_bira * rate_per_bira, 2)),
  check (paid_amount + due_amount = total_amount)
);
create index sales_date_idx on public.sales(transaction_date desc);
create index sales_buyer_idx on public.sales(buyer_id, transaction_date desc);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_no text not null unique,
  payment_date date not null default (now() at time zone 'Asia/Dhaka')::date,
  party_kind text not null check (party_kind in ('buyer','seller')),
  buyer_id uuid references public.buyers(id),
  seller_id uuid references public.sellers(id),
  related_purchase_id uuid references public.purchases(id),
  related_sale_id uuid references public.sales(id),
  amount numeric(14,2) not null check (amount > 0),
  method public.payment_method not null default 'cash',
  reference_no text,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check ((party_kind='buyer' and buyer_id is not null and seller_id is null) or (party_kind='seller' and seller_id is not null and buyer_id is null))
);
create index payments_date_idx on public.payments(payment_date desc);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_no text not null unique,
  expense_date date not null default (now() at time zone 'Asia/Dhaka')::date,
  category text not null,
  description text,
  amount numeric(14,2) not null check (amount > 0),
  method public.payment_method not null default 'cash',
  attachment_path text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.other_income (
  id uuid primary key default gen_random_uuid(),
  income_no text not null unique,
  income_date date not null default (now() at time zone 'Asia/Dhaka')::date,
  category text not null,
  description text,
  amount numeric(14,2) not null check (amount > 0),
  method public.payment_method not null default 'cash',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  movement_date date not null default (now() at time zone 'Asia/Dhaka')::date,
  pan_type_id uuid references public.pan_types(id),
  pan_type_name text not null default 'সাধারণ পান',
  movement_kind text not null check (movement_kind in ('purchase','sale','damage','adjustment_in','adjustment_out')),
  quantity_bira numeric(14,3) not null check (quantity_bira > 0),
  source_purchase_id uuid references public.purchases(id),
  source_sale_id uuid references public.sales(id),
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index stock_movements_date_idx on public.stock_movements(movement_date desc);

create table public.profit_sharing_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  method text not null check (method in ('purchase_percentage','per_bira','business_profit_percentage','manual')),
  rate numeric(12,4) not null default 0 check (rate >= 0),
  minimum_membership_days integer not null default 365 check (minimum_membership_days >= 0),
  active_from date not null,
  active_to date,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.profit_sharing_records (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id),
  rule_id uuid references public.profit_sharing_rules(id),
  period_start date not null,
  period_end date not null,
  eligible_purchase numeric(14,2) not null default 0,
  eligible_bira numeric(14,3) not null default 0,
  share_amount numeric(14,2) not null default 0,
  approved_amount numeric(14,2),
  status text not null default 'pending' check (status in ('pending','approved','paid','cancelled')),
  note text,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (buyer_id, period_start, period_end)
);
create table public.profit_sharing_payments (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.profit_sharing_records(id),
  payment_no text not null unique,
  paid_date date not null default (now() at time zone 'Asia/Dhaka')::date,
  amount numeric(14,2) not null check (amount > 0),
  method public.payment_method not null default 'cash',
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default (now() at time zone 'Asia/Dhaka')::date,
  account_code text not null,
  account_name text not null,
  party_kind text check (party_kind in ('buyer','seller','business')),
  buyer_id uuid references public.buyers(id),
  seller_id uuid references public.sellers(id),
  source_type text not null,
  source_id uuid not null,
  description text,
  debit numeric(14,2) not null default 0 check (debit >= 0),
  credit numeric(14,2) not null default 0 check (credit >= 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (debit > 0 or credit > 0)
);
create index ledger_date_idx on public.ledger_entries(entry_date desc);
create index ledger_buyer_idx on public.ledger_entries(buyer_id, entry_date desc);
create index ledger_seller_idx on public.ledger_entries(seller_id, entry_date desc);

create table public.daily_closings (
  id uuid primary key default gen_random_uuid(),
  closing_date date not null unique,
  opening_cash numeric(14,2) not null default 0,
  cash_in numeric(14,2) not null default 0,
  cash_out numeric(14,2) not null default 0,
  expected_closing_cash numeric(14,2) not null default 0,
  actual_cash numeric(14,2),
  difference numeric(14,2),
  status text not null default 'open' check (status in ('open','closed','reopened')),
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  reopen_reason text,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index audit_logs_time_idx on public.audit_logs(created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id),
  title text not null,
  message text not null,
  kind text not null default 'info',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Bootstrap: create a profile for each auth user. First user must be promoted to admin
-- manually in Supabase SQL Editor after account signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email, ''), 'employee')
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.is_active=true);
$$;
create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active=true);
$$;

-- Enable RLS for all app tables.
do $$ declare t text; begin
  foreach t in array array['business_settings','profiles','buyers','sellers','pan_types','purchases','sales','payments','expenses','other_income','stock_movements','profit_sharing_rules','profit_sharing_records','profit_sharing_payments','ledger_entries','daily_closings','audit_logs','notifications'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Admin has full control; active employees can read and insert common operational rows.
create policy profiles_read on public.profiles for select using (id=auth.uid() or public.is_admin());
create policy profiles_admin_manage on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy settings_read on public.business_settings for select using (public.is_active_user());
create policy settings_admin_manage on public.business_settings for all using (public.is_admin()) with check (public.is_admin());

create policy buyers_read on public.buyers for select using (public.is_active_user());
create policy buyers_insert on public.buyers for insert with check (public.is_active_user());
create policy buyers_admin_update on public.buyers for update using (public.is_admin()) with check (public.is_admin());
create policy buyers_admin_delete on public.buyers for delete using (public.is_admin());
create policy sellers_read on public.sellers for select using (public.is_active_user());
create policy sellers_insert on public.sellers for insert with check (public.is_active_user());
create policy sellers_admin_update on public.sellers for update using (public.is_admin()) with check (public.is_admin());
create policy sellers_admin_delete on public.sellers for delete using (public.is_admin());

create policy pan_types_read on public.pan_types for select using (public.is_active_user());
create policy pan_types_admin_manage on public.pan_types for all using (public.is_admin()) with check (public.is_admin());

create policy purchases_read on public.purchases for select using (public.is_active_user());
create policy purchases_insert on public.purchases for insert with check (public.is_active_user());
create policy purchases_admin_update on public.purchases for update using (public.is_admin()) with check (public.is_admin());
create policy sales_read on public.sales for select using (public.is_active_user());
create policy sales_insert on public.sales for insert with check (public.is_active_user());
create policy sales_admin_update on public.sales for update using (public.is_admin()) with check (public.is_admin());

create policy payments_read on public.payments for select using (public.is_active_user());
create policy payments_insert on public.payments for insert with check (public.is_active_user());
create policy payments_admin_manage on public.payments for update using (public.is_admin()) with check (public.is_admin());
create policy expenses_read on public.expenses for select using (public.is_active_user());
create policy expenses_insert on public.expenses for insert with check (public.is_active_user());
create policy expenses_admin_manage on public.expenses for all using (public.is_admin()) with check (public.is_admin());
create policy income_read on public.other_income for select using (public.is_active_user());
create policy income_insert on public.other_income for insert with check (public.is_active_user());
create policy income_admin_manage on public.other_income for all using (public.is_admin()) with check (public.is_admin());

create policy stock_read on public.stock_movements for select using (public.is_active_user());
create policy stock_insert on public.stock_movements for insert with check (public.is_active_user());
create policy stock_admin_manage on public.stock_movements for update using (public.is_admin()) with check (public.is_admin());
create policy profit_rules_read on public.profit_sharing_rules for select using (public.is_active_user());
create policy profit_rules_admin on public.profit_sharing_rules for all using (public.is_admin()) with check (public.is_admin());
create policy profit_records_read on public.profit_sharing_records for select using (public.is_active_user());
create policy profit_records_admin on public.profit_sharing_records for all using (public.is_admin()) with check (public.is_admin());
create policy profit_payments_read on public.profit_sharing_payments for select using (public.is_active_user());
create policy profit_payments_insert on public.profit_sharing_payments for insert with check (public.is_active_user());
create policy profit_payments_admin_update on public.profit_sharing_payments for update using (public.is_admin()) with check (public.is_admin());

create policy ledger_read on public.ledger_entries for select using (public.is_active_user());
create policy ledger_insert on public.ledger_entries for insert with check (public.is_active_user());
create policy ledger_admin_update on public.ledger_entries for update using (public.is_admin()) with check (public.is_admin());
create policy closing_read on public.daily_closings for select using (public.is_active_user());
create policy closing_admin on public.daily_closings for all using (public.is_admin()) with check (public.is_admin());
create policy audit_admin_read on public.audit_logs for select using (public.is_admin());
create policy audit_insert on public.audit_logs for insert with check (public.is_active_user());
create policy notification_read on public.notifications for select using (recipient_id=auth.uid() or public.is_admin());
create policy notification_update on public.notifications for update using (recipient_id=auth.uid() or public.is_admin()) with check (recipient_id=auth.uid() or public.is_admin());

-- A secure summary view can be extended as more posting RPCs are implemented.
create or replace view public.current_stock as
select pan_type_name,
  sum(case when movement_kind in ('purchase','adjustment_in') then quantity_bira else 0 end)
  - sum(case when movement_kind in ('sale','damage','adjustment_out') then quantity_bira else 0 end) as quantity_bira
from public.stock_movements group by pan_type_name;
