-- =========================================================
-- Auth trigger fixes
-- =========================================================

-- 1. handle_new_user: create a public.users row when a Supabase auth
--    user is created (e.g. via Railway admin API or direct signup).
--    Reads full_name from raw_user_meta_data so it is never lost.
--    company_id is nullable (set during onboarding), role defaults to 'employee'.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only insert if the row doesn't already exist (Railway may have inserted it)
  insert into public.users (id, email, full_name, role, company_id)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    'employee',
    null
  )
  on conflict (id) do update
    set full_name = coalesce(
      excluded.full_name,
      public.users.full_name
    )
  where public.users.full_name is null;

  return new;
end;
$$;

-- Attach trigger if not already present
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================
-- 2. Make company_id nullable if the onboarding migration
--    hasn't run yet (idempotent).
-- =========================================================
alter table public.users
  alter column company_id drop not null;

-- =========================================================
-- 3. Seed missing roles that activation / invite flows need.
--    The first migration only seeds owner / admin / employee.
-- =========================================================
insert into public.roles (slug, label, description, is_system)
values
  ('company_admin', 'Virksomhedsadmin', 'Tenant admin (alias for admin)', true),
  ('global_admin',  'Global admin',     'System-wide superuser',           true)
on conflict (slug) do nothing;
