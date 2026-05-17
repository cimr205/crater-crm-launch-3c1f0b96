import { createClient } from 'npm:@supabase/supabase-js@^2';
import { retryWithBackoff } from '../_shared/retry.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const INTERNAL_SECRET      = Deno.env.get('EVENT_DISPATCHER_SECRET') ?? '';

// Glob match: 'lead.*' matches 'lead.created', '*' matches everything
function matchesGlob(pattern: string, eventType: string): boolean {
  if (pattern === '*') return true;
  if (pattern === eventType) return true;
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return eventType.startsWith(prefix + '.');
  }
  return false;
}

// JSONLogic-style condition evaluation
// conditions: [{field, op, value}, ...] — all must pass (AND)
function evaluateConditions(conditions: unknown[], event: Record<string, unknown>): boolean {
  if (!Array.isArray(conditions) || conditions.length === 0) return true;

  return conditions.every((c: unknown) => {
    const cond = c as { field: string; op: string; value: unknown };
    const parts = cond.field.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let actual: any = event;
    for (const p of parts) actual = actual?.[p];

    switch (cond.op) {
      case '>':   return Number(actual) >  Number(cond.value);
      case '>=':  return Number(actual) >= Number(cond.value);
      case '<':   return Number(actual) <  Number(cond.value);
      case '<=':  return Number(actual) <= Number(cond.value);
      case '==':
      case '=':   return String(actual) === String(cond.value);
      case '!=':  return String(actual) !== String(cond.value);
      case 'contains': return String(actual).includes(String(cond.value));
      default:    return true;
    }
  });
}

async function fanOut(
  sub: { action_type: string; action_ref: string; id: string },
  event: Record<string, unknown>,
  functionsUrl: string,
) {
  const headers = { 'Content-Type': 'application/json', 'X-Internal-Secret': INTERNAL_SECRET };

  if (sub.action_type === 'webhook') {
    await retryWithBackoff(() =>
      fetch(sub.action_ref, { method: 'POST', headers, body: JSON.stringify(event) })
    );
  } else if (sub.action_type === 'workflow') {
    await retryWithBackoff(() =>
      fetch(`${functionsUrl}/workflow-runner`, {
        method: 'POST', headers,
        body: JSON.stringify({ workflow_id: sub.action_ref, input: event }),
      })
    );
  } else if (sub.action_type === 'autopilot') {
    await retryWithBackoff(() =>
      fetch(`${functionsUrl}/autopilot-agent`, {
        method: 'POST', headers,
        body: JSON.stringify({ system_context: sub.action_ref, event }),
      })
    );
  }
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  // Health check
  if (req.method === 'GET') {
    return Response.json({ ok: true, service: 'event-dispatcher' }, { headers: corsHeaders });
  }

  // Verify internal secret
  const secret = req.headers.get('X-Internal-Secret');
  if (INTERNAL_SECRET && secret !== INTERNAL_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const companyId = event.company_id as string;
  const eventType = event.type as string;

  if (!companyId || !eventType) {
    return new Response('Missing company_id or type', { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Resolve functions URL (stored in app_settings or from header)
  const functionsUrl =
    (req.headers.get('X-Supabase-Functions-Url')) ??
    SUPABASE_URL.replace('.supabase.co', '.supabase.co') + '/functions/v1';

  const { data: subs, error } = await supabase
    .from('event_subscriptions')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (error) {
    console.error('Failed to fetch subscriptions:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const matching = (subs ?? []).filter(
    (s) => matchesGlob(s.event_pattern, eventType) && evaluateConditions(s.conditions ?? [], event)
  );

  await Promise.allSettled(matching.map((sub) => fanOut(sub, event, functionsUrl)));

  return Response.json(
    { ok: true, dispatched: matching.length, event_type: eventType },
    { headers: corsHeaders }
  );
});
