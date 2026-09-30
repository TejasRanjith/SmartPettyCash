-- ==============================================================================
-- SmartPettyCash: PostgreSQL Schema for Supabase
-- ==============================================================================

-- 1. Table: vouchers (Parent voucher records)
create table if not exists public.vouchers (
  id bigint primary key generated always as identity,
  voucher_code text not null unique,        -- Standardized code e.g. 'exp_voucher_260930-121445'
  employee_name text default '',
  voucher_date date,
  location text default '',
  title text default '',                    -- Designation / Position
  expense_title text default '',            -- Purpose / Project title
  is_favourite boolean default false,
  user_id uuid references auth.users(id) on delete set null, -- Optional Supabase Auth user
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 2. Table: expenses (Child line items linked via foreign key)
create table if not exists public.expenses (
  id bigint primary key generated always as identity,
  voucher_id bigint references public.vouchers(id) on delete cascade,
  receipt_no integer,
  expense_date date,
  description text,
  amount numeric(12, 2) default 0,
  currency text default 'AED',
  amount_aed numeric(12, 2) default 0,
  receipt_image_url text,                   -- Cloud storage URL or base64 fallback
  created_at timestamp with time zone default now()
);

-- 3. Indexes for query optimization
create index if not exists idx_expenses_voucher_id on public.expenses(voucher_id);
create index if not exists idx_vouchers_voucher_code on public.vouchers(voucher_code);
create index if not exists idx_vouchers_created_at on public.vouchers(created_at desc);

-- 4. Automatically update updated_at timestamp on vouchers
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_vouchers_updated_at on public.vouchers;
create trigger set_vouchers_updated_at
  before update on public.vouchers
  for each row
  execute function public.handle_updated_at();

-- 5. Row Level Security (RLS) setup
alter table public.vouchers enable row level security;
alter table public.expenses enable row level security;

-- Permissive policies for team/collaborative use (switch to auth.uid() = user_id if strict user isolation is required)
drop policy if exists "Enable all access for vouchers" on public.vouchers;
create policy "Enable all access for vouchers"
  on public.vouchers for all
  using (true)
  with check (true);

drop policy if exists "Enable all access for expenses" on public.expenses;
create policy "Enable all access for expenses"
  on public.expenses for all
  using (true)
  with check (true);

-- 6. Storage Bucket for Receipts
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

drop policy if exists "Public Receipts Access" on storage.objects;
drop policy if exists "Public Receipts Select" on storage.objects;
create policy "Public Receipts Select"
  on storage.objects for select
  using (bucket_id = 'receipts');

drop policy if exists "Public Receipts Insert" on storage.objects;
create policy "Public Receipts Insert"
  on storage.objects for insert
  with check (bucket_id = 'receipts');

drop policy if exists "Public Receipts Update" on storage.objects;
create policy "Public Receipts Update"
  on storage.objects for update
  using (bucket_id = 'receipts')
  with check (bucket_id = 'receipts');

drop policy if exists "Public Receipts Delete" on storage.objects;
create policy "Public Receipts Delete"
  on storage.objects for delete
  using (bucket_id = 'receipts');
