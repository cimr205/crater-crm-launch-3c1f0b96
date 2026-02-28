-- =========================================================
-- CRM data tables — multi-tenant with full RLS isolation
-- =========================================================

-- Leads
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  first_name text,
  last_name text,
  company_name text,
  email text,
  phone text,
  status text not null default 'new', -- new, contacted, qualified, disqualified
  source text not null default 'manual', -- email, call, import, manual, meta_ads
  lead_score integer not null default 0,
  notes text,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);

create index if not exists idx_leads_company_id on public.leads (company_id);
create index if not exists idx_leads_status on public.leads (company_id, status);
create index if not exists idx_leads_created_at on public.leads (company_id, created_at desc);

-- Deals / Pipeline
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  value numeric(14,2) not null default 0,
  stage_id text not null default 'new_lead', -- new_lead, contacted, meeting_booked, proposal_sent, negotiation, won, lost
  stage_entered_at timestamptz not null default now(),
  lead_id uuid references public.leads(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);

create index if not exists idx_deals_company_id on public.deals (company_id);
create index if not exists idx_deals_stage on public.deals (company_id, stage_id);
create index if not exists idx_deals_created_at on public.deals (company_id, created_at desc);

-- Tasks
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  type text not null default 'Følg op', -- Svar på tilbud, Følg op, Ring tilbage, Send kontrakt
  title text not null,
  status text not null default 'open', -- open, done, overdue
  due_at timestamptz not null,
  owner_user_id uuid references public.users(id) on delete set null,
  related_lead_id uuid references public.leads(id) on delete set null,
  related_deal_id uuid references public.deals(id) on delete set null,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);

create index if not exists idx_tasks_company_id on public.tasks (company_id);
create index if not exists idx_tasks_status on public.tasks (company_id, status);
create index if not exists idx_tasks_owner on public.tasks (company_id, owner_user_id);
create index if not exists idx_tasks_due_at on public.tasks (company_id, due_at);

-- Email accounts (connected inboxes per company)
create table if not exists public.email_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  address text not null,
  display_name text not null,
  connection_type text not null default 'IMAP_SMTP', -- OAuth, IMAP_SMTP
  status text not null default 'connected', -- connected, needs_reauth, error
  last_sync_at timestamptz,
  credentials jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);

create index if not exists idx_email_accounts_company_id on public.email_accounts (company_id);

-- Files (metadata + Supabase storage path)
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  size integer not null default 0,
  mime_type text not null default 'application/octet-stream',
  storage_path text not null,
  related_lead_id uuid references public.leads(id) on delete set null,
  related_deal_id uuid references public.deals(id) on delete set null,
  created_at timestamptz not null default now(),
  uploaded_by uuid references public.users(id) on delete set null
);

create index if not exists idx_files_company_id on public.files (company_id);
create index if not exists idx_files_lead on public.files (related_lead_id);

-- Meta Ads connection (one per company)
create table if not exists public.meta_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  access_token text not null,
  token_expires_at timestamptz,
  ad_account_id text,
  business_id text,
  pixel_id text,
  capi_token text,
  website_domains text[] not null default '{}',
  website_tracking_key text not null default gen_random_uuid()::text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Campaigns
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  type text not null default 'meta', -- meta, email, sms
  status text not null default 'draft', -- draft, active, paused, completed
  budget numeric(14,2),
  start_date date,
  end_date date,
  meta_campaign_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);

create index if not exists idx_campaigns_company_id on public.campaigns (company_id);
create index if not exists idx_campaigns_status on public.campaigns (company_id, status);

-- Workflows / automations
create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  trigger_type text not null default 'manual_trigger', -- new_lead_created, integration_connected, manual_trigger
  status text not null default 'draft', -- draft, active, paused
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);

create index if not exists idx_workflows_company_id on public.workflows (company_id);

-- Calendar events
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  type text not null default 'meeting', -- meeting, task, reminder, call
  related_lead_id uuid references public.leads(id) on delete set null,
  related_deal_id uuid references public.deals(id) on delete set null,
  owner_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);

create index if not exists idx_calendar_events_company_id on public.calendar_events (company_id);
create index if not exists idx_calendar_events_start on public.calendar_events (company_id, start_at);

-- =========================================================
-- RLS — Enable on all new tables
-- =========================================================
alter table public.leads enable row level security;
alter table public.deals enable row level security;
alter table public.tasks enable row level security;
alter table public.email_accounts enable row level security;
alter table public.files enable row level security;
alter table public.meta_connections enable row level security;
alter table public.campaigns enable row level security;
alter table public.workflows enable row level security;
alter table public.calendar_events enable row level security;

-- =========================================================
-- RLS Policies (company_id isolation on all tables)
-- =========================================================

-- LEADS
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads for select
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads for insert
  with check (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads for update
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin())
  with check (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads for delete
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

-- DEALS
drop policy if exists deals_select on public.deals;
create policy deals_select on public.deals for select
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists deals_insert on public.deals;
create policy deals_insert on public.deals for insert
  with check (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists deals_update on public.deals;
create policy deals_update on public.deals for update
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin())
  with check (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists deals_delete on public.deals;
create policy deals_delete on public.deals for delete
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

-- TASKS
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert
  with check (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin())
  with check (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

-- EMAIL ACCOUNTS
drop policy if exists email_accounts_select on public.email_accounts;
create policy email_accounts_select on public.email_accounts for select
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists email_accounts_insert on public.email_accounts;
create policy email_accounts_insert on public.email_accounts for insert
  with check (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists email_accounts_update on public.email_accounts;
create policy email_accounts_update on public.email_accounts for update
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin())
  with check (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists email_accounts_delete on public.email_accounts;
create policy email_accounts_delete on public.email_accounts for delete
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

-- FILES
drop policy if exists files_select on public.files;
create policy files_select on public.files for select
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists files_insert on public.files;
create policy files_insert on public.files for insert
  with check (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists files_delete on public.files;
create policy files_delete on public.files for delete
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

-- META CONNECTIONS
drop policy if exists meta_connections_select on public.meta_connections;
create policy meta_connections_select on public.meta_connections for select
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists meta_connections_insert on public.meta_connections;
create policy meta_connections_insert on public.meta_connections for insert
  with check (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists meta_connections_update on public.meta_connections;
create policy meta_connections_update on public.meta_connections for update
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin())
  with check (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists meta_connections_delete on public.meta_connections;
create policy meta_connections_delete on public.meta_connections for delete
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

-- CAMPAIGNS
drop policy if exists campaigns_select on public.campaigns;
create policy campaigns_select on public.campaigns for select
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists campaigns_insert on public.campaigns;
create policy campaigns_insert on public.campaigns for insert
  with check (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists campaigns_update on public.campaigns;
create policy campaigns_update on public.campaigns for update
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin())
  with check (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists campaigns_delete on public.campaigns;
create policy campaigns_delete on public.campaigns for delete
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

-- WORKFLOWS
drop policy if exists workflows_select on public.workflows;
create policy workflows_select on public.workflows for select
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists workflows_insert on public.workflows;
create policy workflows_insert on public.workflows for insert
  with check (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists workflows_update on public.workflows;
create policy workflows_update on public.workflows for update
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin())
  with check (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists workflows_delete on public.workflows;
create policy workflows_delete on public.workflows for delete
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

-- CALENDAR EVENTS
drop policy if exists calendar_events_select on public.calendar_events;
create policy calendar_events_select on public.calendar_events for select
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists calendar_events_insert on public.calendar_events;
create policy calendar_events_insert on public.calendar_events for insert
  with check (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists calendar_events_update on public.calendar_events;
create policy calendar_events_update on public.calendar_events for update
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin())
  with check (company_id = public.current_user_company_id() or public.current_user_is_global_admin());

drop policy if exists calendar_events_delete on public.calendar_events;
create policy calendar_events_delete on public.calendar_events for delete
  using (company_id = public.current_user_company_id() or public.current_user_is_global_admin());
