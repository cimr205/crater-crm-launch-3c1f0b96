-- Phone provisioning per tenant
-- Each company can have at most one active phone number.
-- minutes_used is reset monthly (by a cron job or manual reset).
-- Twilio SID is stored for releasing the number via the Twilio API.

create table if not exists phone_provisions (
  id            uuid        primary key default gen_random_uuid(),
  company_id    uuid        not null references companies(id) on delete cascade,
  phone_number  text,
  plan          text        not null default 'standard',
  minutes_used  integer     not null default 0,
  minutes_limit integer     not null default 500,
  active        boolean     not null default false,
  twilio_sid    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id)
);

-- Row-level security: each tenant can only see its own row.
alter table phone_provisions enable row level security;

create policy "tenant_isolation" on phone_provisions
  using (company_id = (
    select company_id from users where id = auth.uid()
  ));

-- Trigger to keep updated_at fresh.
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger phone_provisions_updated_at
  before update on phone_provisions
  for each row execute procedure touch_updated_at();
