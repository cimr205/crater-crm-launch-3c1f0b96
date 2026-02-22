-- =========================================================
-- Full auth + multi-tenant rebuild for Supabase + Railway
-- =========================================================

create extension if not exists pgcrypto;

-- Roles catalog (flexible, future-safe)
create table if not exists public.roles (
  slug text primary key,
  label text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_slug text not null references public.roles(slug) on delete cascade,
  permission text not null,
  created_at timestamptz not null default now(),
  primary key (role_slug, permission)
);

-- Companies (tenants)
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cvr text,
  address text,
  country text,
  phone text,
  email text,
  plan text not null default 'starter',
  user_limit integer,
  payment_status text not null default 'pending',
  invite_code text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_companies_created_at on public.companies (created_at desc);
create index if not exists idx_companies_invite_code on public.companies (invite_code);

-- Company users (mapped 1:1 to auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role text not null references public.roles(slug),
  email text not null unique,
  full_name text,
  is_global_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_company_id on public.users (company_id);
create index if not exists idx_users_role on public.users (role);

-- Audit trail
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  "timestamp" timestamptz not null default now()
);

create index if not exists idx_activity_logs_company_timestamp on public.activity_logs (company_id, "timestamp" desc);

-- Optional subscription metadata
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  provider text,
  provider_subscription_id text,
  status text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed system roles
insert into public.roles (slug, label, description, is_system)
values
  ('owner', 'Owner', 'Tenant owner with full control', true),
  ('admin', 'Admin', 'Tenant administrator', true),
  ('employee', 'Medarbejder', 'Standard team member', true)
on conflict (slug) do update set label = excluded.label, description = excluded.description;

-- Seed baseline permissions
insert into public.role_permissions (role_slug, permission)
values
  ('owner', '*'),
  ('admin', 'company.read'),
  ('admin', 'company.update'),
  ('admin', 'members.read'),
  ('admin', 'members.update'),
  ('admin', 'activity.read'),
  ('employee', 'profile.read')
on conflict (role_slug, permission) do nothing;

-- ---------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------
create or replace function public.current_user_company_id()
returns uuid
language sql
stable
as $$
  select u.company_id
  from public.users u
  where u.id = auth.uid()
  limit 1;
$$;

create or replace function public.current_user_is_global_admin()
returns boolean
language sql
stable
as $$
  select coalesce(u.is_global_admin, false)
  from public.users u
  where u.id = auth.uid()
  limit 1;
$$;

-- ---------------------------------------------------------
-- RLS enablement
-- ---------------------------------------------------------
alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.activity_logs enable row level security;
alter table public.subscriptions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;

-- Companies
drop policy if exists companies_select_isolated on public.companies;
create policy companies_select_isolated
on public.companies
for select
using (
  id = public.current_user_company_id()
  or public.current_user_is_global_admin()
);

drop policy if exists companies_update_owner_admin on public.companies;
create policy companies_update_owner_admin
on public.companies
for update
using (
  id = public.current_user_company_id()
  or public.current_user_is_global_admin()
)
with check (
  id = public.current_user_company_id()
  or public.current_user_is_global_admin()
);

-- Users
drop policy if exists users_select_isolated on public.users;
create policy users_select_isolated
on public.users
for select
using (
  company_id = public.current_user_company_id()
  or public.current_user_is_global_admin()
);

drop policy if exists users_update_isolated on public.users;
create policy users_update_isolated
on public.users
for update
using (
  company_id = public.current_user_company_id()
  or public.current_user_is_global_admin()
)
with check (
  company_id = public.current_user_company_id()
  or public.current_user_is_global_admin()
);

-- Activity logs
drop policy if exists activity_logs_select_isolated on public.activity_logs;
create policy activity_logs_select_isolated
on public.activity_logs
for select
using (
  company_id = public.current_user_company_id()
  or public.current_user_is_global_admin()
);

drop policy if exists activity_logs_insert_isolated on public.activity_logs;
create policy activity_logs_insert_isolated
on public.activity_logs
for insert
with check (
  company_id = public.current_user_company_id()
  or public.current_user_is_global_admin()
);

-- Subscriptions
drop policy if exists subscriptions_select_isolated on public.subscriptions;
create policy subscriptions_select_isolated
on public.subscriptions
for select
using (
  company_id = public.current_user_company_id()
  or public.current_user_is_global_admin()
);

drop policy if exists subscriptions_update_isolated on public.subscriptions;
create policy subscriptions_update_isolated
on public.subscriptions
for update
using (
  company_id = public.current_user_company_id()
  or public.current_user_is_global_admin()
)
with check (
  company_id = public.current_user_company_id()
  or public.current_user_is_global_admin()
);

-- Role catalog read access
drop policy if exists roles_select_authenticated on public.roles;
create policy roles_select_authenticated
on public.roles
for select
using (auth.role() = 'authenticated');

drop policy if exists role_permissions_select_authenticated on public.role_permissions;
create policy role_permissions_select_authenticated
on public.role_permissions
for select
using (auth.role() = 'authenticated');
