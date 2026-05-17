import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { retryWithBackoff } from '../_shared/retry.ts';

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const { url, payload, headers: extraHeaders = {} } = await req.json();
  if (!url) return new Response('Missing url', { status: 400 });

  try {
    const res = await retryWithBackoff(() =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify(payload),
      })
    );
    return Response.json({ ok: true, status: res.status }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 502, headers: corsHeaders });
  }
});
