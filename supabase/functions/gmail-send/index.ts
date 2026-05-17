import { createClient } from 'npm:@supabase/supabase-js@^2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function sendViaGmail(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  threadId?: string,
) {
  const raw = btoa(
    `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
  ).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const payload: Record<string, string> = { raw };
  if (threadId) payload.threadId = threadId;

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Gmail API error: ${res.status} ${await res.text()}`);
  return res.json();
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const { user_id, company_id, to, subject, body, thread_id } = await req.json();

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Get user's Gmail token
  const { data: tokenRow } = await supabase
    .from('user_gmail_tokens')
    .select('access_token, refresh_token')
    .eq('user_id', user_id)
    .single();

  if (!tokenRow?.access_token) {
    return Response.json(
      { ok: false, error: 'No Gmail token found for user' },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const result = await sendViaGmail(tokenRow.access_token, to, subject, body, thread_id);

    // Emit event
    await supabase.from('workspace_events').insert({
      company_id,
      type: 'email.sent',
      source_module: 'gmail',
      entity_type: 'email',
      payload: { to, subject, message_id: result.id },
    });

    return Response.json({ ok: true, message_id: result.id }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500, headers: corsHeaders });
  }
});
