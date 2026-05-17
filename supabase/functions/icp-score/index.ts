import { createClient } from 'npm:@supabase/supabase-js@^2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Simple rule-based ICP scoring
function computeScore(lead: Record<string, unknown>): number {
  let score = 0;

  // Has business email (not gmail/hotmail etc.)
  const email = String(lead.email ?? '');
  const freeProviders = ['gmail.', 'hotmail.', 'yahoo.', 'outlook.'];
  if (email && !freeProviders.some(p => email.includes(p))) score += 25;

  // Has company name
  if (lead.company_name) score += 20;

  // Has phone
  if (lead.phone) score += 15;

  // Lead score already computed
  const existing = Number(lead.lead_score ?? 0);
  if (existing > 0) score += Math.min(existing, 40);

  return Math.min(score, 100);
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const { lead_id, company_id } = await req.json();
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: lead, error } = await db
    .from('leads')
    .select('*')
    .eq('id', lead_id)
    .single();

  if (error || !lead) {
    return Response.json({ ok: false, error: 'Lead not found' }, { status: 404, headers: corsHeaders });
  }

  if (company_id && lead.company_id !== company_id) {
    return new Response('Forbidden', { status: 403 });
  }

  const score = computeScore(lead as Record<string, unknown>);

  await db.from('leads').update({ lead_score: score }).eq('id', lead_id);

  return Response.json({ ok: true, lead_id, score }, { headers: corsHeaders });
});
