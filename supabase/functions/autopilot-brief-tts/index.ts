import { createClient } from 'npm:@supabase/supabase-js@^2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const authHeader = req.headers.get('Authorization') ?? '';
  const anonKey    = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(SUPABASE_URL, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: profile } = await userClient
    .from('users').select('company_id').eq('id', user.id).single();
  const companyId = profile?.company_id;
  if (!companyId) return new Response('No company', { status: 403 });

  const db    = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const today = new Date().toISOString().split('T')[0];

  const { data: brief } = await db.from('daily_briefs')
    .select('content').eq('company_id', companyId).eq('date', today).single();

  if (!brief?.content) {
    return Response.json({ ok: false, error: 'No brief for today' }, { status: 404, headers: corsHeaders });
  }

  // Signal frontend to use browser SpeechSynthesis (TTS via AI gateway not always available)
  const text = brief.content.replace(/#{1,6}\s/g, '').replace(/[*_`]/g, '');
  return Response.json({ ok: true, use_speech_synthesis: true, text }, { headers: corsHeaders });
});
