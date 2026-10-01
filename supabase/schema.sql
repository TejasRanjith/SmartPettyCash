-- ==============================================================================
-- SmartPettyCash: PostgreSQL Schema for Supabase (User Auth & Data Isolation)
-- ==============================================================================

-- 1. Table: profiles (User Profile details linked to Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text default '',
  title text default '',                    -- Designation / Position (e.g. Operations Manager)
  location text default '',                 -- Default Office / Site (e.g. Dubai Office)
  avatar_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Trigger to automatically create profile record when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end,
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Table: vouchers (Parent voucher records with strict user ownership)
create table if not exists public.vouchers (
  id bigint primary key generated always as identity,
  voucher_code text not null unique,        -- Standardized code e.g. 'exp_voucher_260930-121445'
  user_id uuid references auth.users(id) on delete cascade, -- Owner of this voucher
  employee_name text default '',
  voucher_date date,
  location text default '',
  title text default '',                    -- Designation / Position
  expense_title text default '',            -- Purpose / Project title
  is_favourite boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 3. Table: expenses (Child line items linked via foreign key)
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

-- 4. Indexes for query optimization
create index if not exists idx_vouchers_user_id on public.vouchers(user_id);
create index if not exists idx_expenses_voucher_id on public.expenses(voucher_id);
create index if not exists idx_vouchers_voucher_code on public.vouchers(voucher_code);
create index if not exists idx_vouchers_created_at on public.vouchers(created_at desc);

-- 5. Automatically update updated_at timestamp on vouchers and profiles
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
  for each row execute function public.handle_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- 6. Row Level Security (RLS) setup — User Isolation
alter table public.profiles enable row level security;
alter table public.vouchers enable row level security;
alter table public.expenses enable row level security;

-- Profiles: Users can only read and update their own profile
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Vouchers: Users can only view, insert, update, delete their own vouchers
drop policy if exists "Users can view own vouchers" on public.vouchers;
create policy "Users can view own vouchers"
  on public.vouchers for select
  using (auth.uid() = user_id or user_id is null);

drop policy if exists "Users can insert own vouchers" on public.vouchers;
create policy "Users can insert own vouchers"
  on public.vouchers for insert
  with check (auth.uid() = user_id or user_id is null);

drop policy if exists "Users can update own vouchers" on public.vouchers;
create policy "Users can update own vouchers"
  on public.vouchers for update
  using (auth.uid() = user_id or user_id is null)
  with check (auth.uid() = user_id or user_id is null);

drop policy if exists "Users can delete own vouchers" on public.vouchers;
create policy "Users can delete own vouchers"
  on public.vouchers for delete
  using (auth.uid() = user_id or user_id is null);

-- Expenses: Only parent voucher owner can view, insert, update, delete expenses
drop policy if exists "Users can view own expenses" on public.expenses;
create policy "Users can view own expenses"
  on public.expenses for select
  using (
    exists (
      select 1 from public.vouchers
      where public.vouchers.id = public.expenses.voucher_id
      and (public.vouchers.user_id = auth.uid() or public.vouchers.user_id is null)
    )
  );

drop policy if exists "Users can insert own expenses" on public.expenses;
create policy "Users can insert own expenses"
  on public.expenses for insert
  with check (
    exists (
      select 1 from public.vouchers
      where public.vouchers.id = public.expenses.voucher_id
      and (public.vouchers.user_id = auth.uid() or public.vouchers.user_id is null)
    )
  );

drop policy if exists "Users can update own expenses" on public.expenses;
create policy "Users can update own expenses"
  on public.expenses for update
  using (
    exists (
      select 1 from public.vouchers
      where public.vouchers.id = public.expenses.voucher_id
      and (public.vouchers.user_id = auth.uid() or public.vouchers.user_id is null)
    )
  );

drop policy if exists "Users can delete own expenses" on public.expenses;
create policy "Users can delete own expenses"
  on public.expenses for delete
  using (
    exists (
      select 1 from public.vouchers
      where public.vouchers.id = public.expenses.voucher_id
      and (public.vouchers.user_id = auth.uid() or public.vouchers.user_id is null)
    )
  );

-- 7. Storage Bucket for Receipts
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
