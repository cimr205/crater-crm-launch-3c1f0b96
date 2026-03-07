-- =========================================================
-- Invoices, Payments, and Gmail Tokens
-- =========================================================

-- Invoices
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invoice_number text not null,
  invoice_date date not null default current_date,
  due_date date not null,
  delivery_date date,
  status text not null default 'draft', -- draft, sent, paid, overdue, cancelled

  -- Customer info
  customer_name text not null,
  customer_address text,
  customer_country text not null default 'DK',
  customer_type text not null default 'company', -- company, private
  customer_cvr text,
  customer_vat text,
  customer_email text,

  -- Linked to CRM
  lead_id uuid references public.leads(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,

  -- Financial
  currency text not null default 'DKK',
  vat_rate numeric(5,2) not null default 25.00,
  vat_note text,
  subtotal numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,

  -- Payment
  payment_method text default 'bank_transfer',
  payment_terms_days integer not null default 14,
  bank_account text,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,

  unique (company_id, invoice_number)
);

create index if not exists idx_invoices_company_id on public.invoices (company_id);
create index if not exists idx_invoices_status on public.invoices (company_id, status);
create index if not exists idx_invoices_created_at on public.invoices (company_id, created_at desc);

-- Invoice line items
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  sort_order integer not null default 0
);

create index if not exists idx_invoice_items_invoice_id on public.invoice_items (invoice_id);

-- Payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  amount numeric(14,2) not null,
  currency text not null default 'DKK',
  payment_date date not null default current_date,
  payment_method text not null default 'manual',
  status text not null default 'completed',
  notes text,
  external_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);

create index if not exists idx_payments_company_id on public.payments (company_id);
create index if not exists idx_payments_invoice_id on public.payments (invoice_id);
create index if not exists idx_payments_created_at on public.payments (company_id, created_at desc);

-- Gmail tokens per user (per-user Gmail connection)
create table if not exists public.user_gmail_tokens (
  user_id uuid primary key references public.users(id) on delete cascade,
  gmail_email text not null,
  access_token text not null,
  refresh_token text,
  token_expiry timestamptz,
  todo_sync_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
