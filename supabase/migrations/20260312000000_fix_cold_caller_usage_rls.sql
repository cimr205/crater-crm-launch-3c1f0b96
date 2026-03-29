-- Fix cold_caller_usage RLS: all policies were RESTRICTIVE, meaning a user
-- must match ALL policies simultaneously -- impossible since a user cannot be
-- both company_admin AND system_admin at the same time.
-- Solution: drop and recreate as PERMISSIVE policies (the default).
-- This migration is a no-op if the table does not yet exist.

do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'cold_caller_usage') then

    -- Drop all existing policies on the table
    declare
      pol record;
    begin
      for pol in select policyname from pg_policies where tablename = 'cold_caller_usage' loop
        execute format('drop policy if exists %I on cold_caller_usage', pol.policyname);
      end loop;
    end;

    -- Users can read their own company's usage
    execute $p$
      create policy "select_own_company"
        on cold_caller_usage for select
        using (
          company_id in (select company_id from profiles where id = auth.uid())
        )
    $p$;

    -- Company admins can read all usage for their company
    execute $p$
      create policy "select_company_admin"
        on cold_caller_usage for select
        using (
          exists (
            select 1 from profiles
            where id = auth.uid()
              and company_id = cold_caller_usage.company_id
              and role in ('company_admin', 'admin', 'owner')
          )
        )
    $p$;

    -- System admins can read everything
    execute $p$
      create policy "select_system_admin"
        on cold_caller_usage for select
        using (
          exists (select 1 from profiles where id = auth.uid() and is_global_admin = true)
        )
    $p$;

    -- Users can insert usage for their own company
    execute $p$
      create policy "insert_own_company"
        on cold_caller_usage for insert
        with check (
          company_id in (select company_id from profiles where id = auth.uid())
        )
    $p$;

    -- Company admins and system admins can update
    execute $p$
      create policy "update_admin"
        on cold_caller_usage for update
        using (
          exists (
            select 1 from profiles
            where id = auth.uid()
              and (
                (company_id = cold_caller_usage.company_id and role in ('company_admin', 'admin', 'owner'))
                or is_global_admin = true
              )
          )
        )
    $p$;

  end if;
end $$;
