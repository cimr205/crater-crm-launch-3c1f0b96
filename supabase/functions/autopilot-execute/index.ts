import { createClient } from 'npm:@supabase/supabase-js@^2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  // Resolve company_id from JWT
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: profile } = await userClient
    .from('users')
    .select('company_id')
    .eq('id', user.id)
    .single();
  if (!profile?.company_id) return new Response('No company', { status: 403 });

  const { action_id } = await req.json();
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: action, error } = await supabase
    .from('autopilot_actions')
    .select('*')
    .eq('id', action_id)
    .eq('company_id', profile.company_id)
    .eq('status', 'approved')
    .single();

  if (error || !action) {
    return Response.json({ ok: false, error: 'Action not found or not approved' }, { status: 404, headers: corsHeaders });
  }

  const functionsBase = SUPABASE_URL.replace('.supabase.co', '.supabase.co') + '/functions/v1';
  let result: unknown = null;

  try {
    if (action.action_type === 'propose_email') {
      const { to, subject, body } = action.payload as Record<string, string>;
      const res = await fetch(`${functionsBase}/gmail-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, company_id: profile.company_id, to, subject, body }),
      });
      result = await res.json();
    } else if (action.action_type === 'create_task') {
      const p = action.payload as Record<string, unknown>;
      const { data } = await supabase.from('tasks').insert({
        company_id: profile.company_id,
        title: p.title,
        type: p.type ?? 'Følg op',
        status: 'open',
        due_at: p.due_at,
        owner_user_id: p.assignee_user_id,
        related_lead_id: p.related_lead_id,
        related_deal_id: p.related_deal_id,
        created_by: user.id,
      }).select('id').single();
      result = data;
    }

    await supabase
      .from('autopilot_actions')
      .update({ status: 'executed', executed_at: new Date().toISOString(), result })
      .eq('id', action_id);

    return Response.json({ ok: true, result }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500, headers: corsHeaders });
  }
});
