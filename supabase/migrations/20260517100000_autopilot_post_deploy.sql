-- Post-deploy configuration for Autopilot / Event Dispatcher
-- Run this AFTER deploying edge functions to Supabase.
-- Replace <YOUR_PROJECT_REF> with your actual project reference (e.g. inyrwsygghdjhmqejgwk).

-- ── 1. App settings ──────────────────────────────────────────────────────────
-- The event-dispatcher secret must match the value you set in the edge function
-- env variable EVENT_DISPATCHER_SECRET.

INSERT INTO public.app_settings (key, value) VALUES
  ('supabase_functions_url', 'https://inyrwsygghdjhmqejgwk.supabase.co/functions/v1'),
  ('event_dispatcher_secret', 'a00d0ebe3a3e31118d676daeb273110675be5f91cf9dd9fc6fe206ef057c51f0')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ── 2. Daily brief pg_cron job (runs at 07:00 UTC every day) ─────────────────
-- Requires the pg_cron extension to be enabled in Supabase (Database → Extensions).
-- The scheduled call hits autopilot-brief with scheduled=true, which generates
-- a brief for every active company that has had activity in the last 30 days.

SELECT cron.schedule(
  'daily-brief-0700',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url    := 'https://inyrwsygghdjhmqejgwk.supabase.co/functions/v1/autopilot-brief',
    headers := '{"Content-Type":"application/json","X-Internal-Secret":"a00d0ebe3a3e31118d676daeb273110675be5f91cf9dd9fc6fe206ef057c51f0"}'::jsonb,
    body   := '{"scheduled":true}'::text
  );
  $$
);
