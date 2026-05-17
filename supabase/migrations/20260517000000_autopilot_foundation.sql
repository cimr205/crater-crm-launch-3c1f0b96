-- ─────────────────────────────────────────────────────────────────────────────
-- Autopilot Foundation: event bus, subscriptions, MCP tokens, daily briefs
-- ─────────────────────────────────────────────────────────────────────────────

-- Extensions
create extension if not exists "pg_net" schema extensions;
create extension if not exists "pg_cron" schema extensions;

-- App settings table (stores supabase functions URL for pg_net dispatch)
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);
comment on table public.app_settings is 'Internal config. Set supabase_functions_url after deploy.';

-- ─── workspace_events ────────────────────────────────────────────────────────
create table if not exists public.workspace_events (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  type           text not null,
  source_module  text,
  entity_type    text,
  entity_id      uuid,
  payload        jsonb not null default '{}',
  actor_user_id  uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_workspace_events_company_at
  on public.workspace_events (company_id, created_at desc);
create index if not exists idx_workspace_events_type
  on public.workspace_events (company_id, type);

alter table public.workspace_events enable row level security;
create policy "tenant_select" on public.workspace_events for select
  using (company_id = public.current_user_company_id());
create policy "tenant_insert" on public.workspace_events for insert
  with check (company_id = public.current_user_company_id());

alter publication supabase_realtime add table public.workspace_events;

-- ─── event_subscriptions ─────────────────────────────────────────────────────
create table if not exists public.event_subscriptions (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  event_pattern  text not null,
  action_type    text not null check (action_type in ('workflow', 'webhook', 'autopilot')),
  action_ref     text not null,
  is_active      boolean not null default true,
  conditions     jsonb not null default '[]',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_event_subscriptions_company
  on public.event_subscriptions (company_id, is_active);

alter table public.event_subscriptions enable row level security;
create policy "tenant_all" on public.event_subscriptions for all
  using (company_id = public.current_user_company_id())
  with check (company_id = public.current_user_company_id());

-- ─── autopilot_actions ───────────────────────────────────────────────────────
create table if not exists public.autopilot_actions (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  suggested_by  text,
  action_type   text not null,
  payload       jsonb not null default '{}',
  status        text not null default 'proposed'
                check (status in ('proposed', 'approved', 'executed', 'dismissed')),
  executed_at   timestamptz,
  result        jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_autopilot_actions_company_status
  on public.autopilot_actions (company_id, status, created_at desc);

alter table public.autopilot_actions enable row level security;
create policy "tenant_all" on public.autopilot_actions for all
  using (company_id = public.current_user_company_id())
  with check (company_id = public.current_user_company_id());

-- ─── mcp_tokens ──────────────────────────────────────────────────────────────
create table if not exists public.mcp_tokens (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  name         text not null,
  token        uuid not null default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  unique (token)
);

alter table public.mcp_tokens enable row level security;
create policy "tenant_all" on public.mcp_tokens for all
  using (company_id = public.current_user_company_id())
  with check (company_id = public.current_user_company_id());

create or replace function public.issue_mcp_token(token_name text)
returns uuid
language plpgsql security definer
as $$
declare
  v_company_id uuid;
  v_token      uuid;
begin
  select company_id into v_company_id from public.users where id = auth.uid();
  if v_company_id is null then
    raise exception 'No company found for current user';
  end if;
  insert into public.mcp_tokens (company_id, name)
  values (v_company_id, token_name)
  returning token into v_token;
  return v_token;
end;
$$;

-- ─── daily_briefs ─────────────────────────────────────────────────────────────
create table if not exists public.daily_briefs (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  date       date not null,
  content    text not null,
  created_at timestamptz not null default now(),
  unique (company_id, date)
);

alter table public.daily_briefs enable row level security;
create policy "tenant_all" on public.daily_briefs for all
  using (company_id = public.current_user_company_id())
  with check (company_id = public.current_user_company_id());

-- ─── Trigger helpers: emit workspace events ───────────────────────────────────

create or replace function public.emit_lead_event()
returns trigger language plpgsql security definer as $$
begin
  insert into public.workspace_events
    (company_id, type, source_module, entity_type, entity_id, payload, actor_user_id)
  values (
    NEW.company_id,
    case TG_OP when 'INSERT' then 'lead.created' else 'lead.updated' end,
    'crm', 'lead', NEW.id,
    jsonb_build_object(
      'status', NEW.status,
      'lead_score', NEW.lead_score,
      'email', NEW.email,
      'first_name', NEW.first_name,
      'last_name', NEW.last_name,
      'company_name', NEW.company_name
    ),
    NEW.created_by
  );
  return NEW;
end;
$$;

drop trigger if exists trg_lead_events on public.leads;
create trigger trg_lead_events
  after insert or update on public.leads
  for each row execute function public.emit_lead_event();

-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.emit_deal_event()
returns trigger language plpgsql security definer as $$
declare v_type text;
begin
  if TG_OP = 'INSERT' then
    v_type := 'deal.created';
  elsif OLD.stage_id is distinct from NEW.stage_id then
    v_type := case NEW.stage_id
      when 'won'  then 'deal.won'
      when 'lost' then 'deal.lost'
      else 'deal.stage_changed'
    end;
  else
    v_type := 'deal.updated';
  end if;

  insert into public.workspace_events
    (company_id, type, source_module, entity_type, entity_id, payload, actor_user_id)
  values (
    NEW.company_id, v_type, 'crm', 'deal', NEW.id,
    jsonb_build_object(
      'title', NEW.title,
      'value', NEW.value,
      'stage_id', NEW.stage_id,
      'prev_stage_id', OLD.stage_id
    ),
    NEW.created_by
  );
  return NEW;
end;
$$;

drop trigger if exists trg_deal_events on public.deals;
create trigger trg_deal_events
  after insert or update on public.deals
  for each row execute function public.emit_deal_event();

-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.emit_invoice_event()
returns trigger language plpgsql security definer as $$
declare v_type text;
begin
  if TG_OP = 'INSERT' then
    v_type := 'invoice.created';
  elsif OLD.status is distinct from NEW.status then
    v_type := case NEW.status
      when 'paid'    then 'invoice.paid'
      when 'overdue' then 'invoice.overdue'
      else 'invoice.updated'
    end;
  else
    v_type := 'invoice.updated';
  end if;

  insert into public.workspace_events
    (company_id, type, source_module, entity_type, entity_id, payload, actor_user_id)
  values (
    NEW.company_id, v_type, 'finance', 'invoice', NEW.id,
    jsonb_build_object(
      'invoice_number', NEW.invoice_number,
      'status', NEW.status,
      'total', NEW.total,
      'customer_name', NEW.customer_name,
      'due_date', NEW.due_date
    ),
    NEW.created_by
  );
  return NEW;
end;
$$;

drop trigger if exists trg_invoice_events on public.invoices;
create trigger trg_invoice_events
  after insert or update on public.invoices
  for each row execute function public.emit_invoice_event();

-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.emit_task_event()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status and NEW.status = 'done' then
    insert into public.workspace_events
      (company_id, type, source_module, entity_type, entity_id, payload, actor_user_id)
    values (
      NEW.company_id, 'task.completed', 'tasks', 'task', NEW.id,
      jsonb_build_object('title', NEW.title, 'type', NEW.type),
      NEW.created_by
    );
  elsif TG_OP = 'INSERT' then
    insert into public.workspace_events
      (company_id, type, source_module, entity_type, entity_id, payload, actor_user_id)
    values (
      NEW.company_id, 'task.created', 'tasks', 'task', NEW.id,
      jsonb_build_object('title', NEW.title, 'type', NEW.type, 'due_at', NEW.due_at),
      NEW.created_by
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_task_events on public.tasks;
create trigger trg_task_events
  after insert or update on public.tasks
  for each row execute function public.emit_task_event();

-- ─── Dispatch trigger: workspace_events → event-dispatcher edge fn ────────────
-- Reads supabase_functions_url from app_settings.
-- After deploy, run:
--   INSERT INTO app_settings VALUES
--     ('supabase_functions_url', 'https://<ref>.supabase.co/functions/v1'),
--     ('event_dispatcher_secret', '<random_secret>');

create or replace function public.dispatch_workspace_event()
returns trigger language plpgsql security definer as $$
declare
  v_url    text;
  v_secret text;
begin
  select value into v_url    from public.app_settings where key = 'supabase_functions_url';
  select value into v_secret from public.app_settings where key = 'event_dispatcher_secret';

  if v_url is null then
    return NEW; -- Not configured yet; skip dispatch silently
  end if;

  perform extensions.net.http_post(
    url     := v_url || '/event-dispatcher',
    headers := jsonb_build_object(
      'Content-Type',        'application/json',
      'X-Internal-Secret',   coalesce(v_secret, ''),
      'X-Supabase-Functions-Url', v_url
    ),
    body    := row_to_json(NEW)::text::jsonb
  );
  return NEW;
end;
$$;

drop trigger if exists trg_dispatch_events on public.workspace_events;
create trigger trg_dispatch_events
  after insert on public.workspace_events
  for each row execute function public.dispatch_workspace_event();
