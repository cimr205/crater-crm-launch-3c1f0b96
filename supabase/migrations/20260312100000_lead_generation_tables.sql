-- ============================================================
-- Lead Generation: search sessions + results
-- ============================================================

-- Search sessions (one per user search click)
create table if not exists lead_gen_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete set null,

  -- Search parameters stored as JSON
  query text,
  filters jsonb default '{}',

  -- Status lifecycle
  status text not null default 'pending'
    check (status in ('pending','running','done','failed','cancelled')),
  progress int not null default 0,          -- 0-100
  progress_label text,
  results_count int not null default 0,
  error_message text,

  -- Timestamps
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Results from a lead gen session
create table if not exists lead_gen_results (
  id uuid primary key default gen_random_uuid(),
  search_session_id uuid references lead_gen_sessions(id) on delete cascade not null,
  company_id uuid references companies(id) on delete cascade not null,

  -- Core company info
  company_name text not null,
  website text,
  domain text,

  -- Contact
  business_email text,
  email_status text default 'missing'
    check (email_status in ('verified','likely_valid','unverified','missing')),
  phone text,

  -- Location
  country text,
  city text,
  region text,

  -- Industry
  industry text,
  sub_industry text,
  description text,
  employee_estimate text,

  -- Activity scoring
  active_status text default 'uncertain'
    check (active_status in ('active_likely','uncertain','inactive_likely')),
  lead_score int not null default 0 check (lead_score >= 0 and lead_score <= 100),

  -- Sources
  source_url text,
  contact_page_url text,
  linkedin_url text,
  facebook_url text,
  instagram_url text,

  -- Decision maker
  owner_name text,
  decision_maker_name text,
  decision_maker_role text,

  -- Meta
  notes text,
  imported boolean not null default false,
  imported_lead_id uuid,       -- FK to leads table after import

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Saved searches (user can name and replay searches)
create table if not exists lead_gen_saved_searches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete set null,
  name text not null,
  query text,
  filters jsonb default '{}',
  created_at timestamptz default now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists idx_lead_gen_sessions_company
  on lead_gen_sessions(company_id, created_at desc);

create index if not exists idx_lead_gen_results_session
  on lead_gen_results(search_session_id);

create index if not exists idx_lead_gen_results_company
  on lead_gen_results(company_id, created_at desc);

create index if not exists idx_lead_gen_results_score
  on lead_gen_results(company_id, lead_score desc);

create index if not exists idx_lead_gen_results_domain
  on lead_gen_results(company_id, domain);

-- ── Row Level Security ───────────────────────────────────────────────────────

alter table lead_gen_sessions enable row level security;
alter table lead_gen_results enable row level security;
alter table lead_gen_saved_searches enable row level security;

-- Sessions: users see only their company's sessions
create policy "lead_gen_sessions_select" on lead_gen_sessions for select
  using (company_id in (select company_id from profiles where id = auth.uid()));

create policy "lead_gen_sessions_insert" on lead_gen_sessions for insert
  with check (company_id in (select company_id from profiles where id = auth.uid()));

create policy "lead_gen_sessions_update" on lead_gen_sessions for update
  using (company_id in (select company_id from profiles where id = auth.uid()));

-- Results: same isolation
create policy "lead_gen_results_select" on lead_gen_results for select
  using (company_id in (select company_id from profiles where id = auth.uid()));

create policy "lead_gen_results_insert" on lead_gen_results for insert
  with check (company_id in (select company_id from profiles where id = auth.uid()));

create policy "lead_gen_results_update" on lead_gen_results for update
  using (company_id in (select company_id from profiles where id = auth.uid()));

create policy "lead_gen_results_delete" on lead_gen_results for delete
  using (company_id in (select company_id from profiles where id = auth.uid()));

-- Saved searches
create policy "lead_gen_saved_select" on lead_gen_saved_searches for select
  using (company_id in (select company_id from profiles where id = auth.uid()));

create policy "lead_gen_saved_insert" on lead_gen_saved_searches for insert
  with check (company_id in (select company_id from profiles where id = auth.uid()));

create policy "lead_gen_saved_delete" on lead_gen_saved_searches for delete
  using (company_id in (select company_id from profiles where id = auth.uid()));

-- Global admin sees everything
create policy "lead_gen_sessions_admin" on lead_gen_sessions for all
  using (exists (select 1 from profiles where id = auth.uid() and is_global_admin = true));

create policy "lead_gen_results_admin" on lead_gen_results for all
  using (exists (select 1 from profiles where id = auth.uid() and is_global_admin = true));
