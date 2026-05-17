import { createClient } from 'npm:@supabase/supabase-js@^2';
import { generateText } from 'npm:ai@^4';
import { createLovableAiGatewayProvider, DEFAULT_MODEL } from '../_shared/ai-gateway.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const body = await req.json() as { company_id?: string; scheduled?: boolean };

  let companyIds: string[] = [];

  if (body.company_id) {
    companyIds = [body.company_id];
  } else if (body.scheduled) {
    // Scheduled run: generate for all active companies
    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data } = await db.from('companies').select('id').eq('is_active', true);
    companyIds = (data ?? []).map((c: { id: string }) => c.id);
  } else {
    return Response.json({ ok: false, error: 'Provide company_id or scheduled=true' }, { status: 400 });
  }

  const db      = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const gateway = createLovableAiGatewayProvider();
  const today   = new Date().toISOString().split('T')[0];
  const results: { company_id: string; ok: boolean }[] = [];

  for (const companyId of companyIds) {
    try {
      const yesterday = new Date(Date.now() - 86400000).toISOString();

      const [invoices, deals, tasks, leads] = await Promise.all([
        db.from('invoices').select('invoice_number,customer_name,total,due_date')
          .eq('company_id', companyId)
          .or(`status.eq.overdue,and(status.eq.sent,due_date.lt.${today})`),
        db.from('deals').select('title,value,stage_id,updated_at')
          .eq('company_id', companyId)
          .not('stage_id', 'in', '(won,lost)')
          .lt('updated_at', new Date(Date.now() - 7 * 86400000).toISOString()),
        db.from('tasks').select('title,type,due_at,status')
          .eq('company_id', companyId)
          .eq('status', 'open')
          .lte('due_at', new Date().toISOString()),
        db.from('leads').select('first_name,last_name,company_name,lead_score')
          .eq('company_id', companyId)
          .gt('created_at', yesterday),
      ]);

      const context = `
Forfaldne fakturaer (${invoices.data?.length ?? 0}):
${JSON.stringify(invoices.data?.slice(0, 5) ?? [])}

Deals uden aktivitet 7+ dage (${deals.data?.length ?? 0}):
${JSON.stringify(deals.data?.slice(0, 5) ?? [])}

Forfaldne opgaver i dag (${tasks.data?.length ?? 0}):
${JSON.stringify(tasks.data?.slice(0, 5) ?? [])}

Nye leads sidste 24t (${leads.data?.length ?? 0}):
${JSON.stringify(leads.data?.slice(0, 5) ?? [])}
      `.trim();

      const { text } = await generateText({
        model: gateway(DEFAULT_MODEL),
        system: 'Du er en forretnings-assistent. Skriv en kort, struktureret daglig brief på dansk i markdown. Max 250 ord. Brug ## overskrifter. Fokuser på det vigtigste der kræver opmærksomhed.',
        prompt: `Generer dagens brief baseret på:\n${context}`,
        maxTokens: 600,
      });

      await db.from('daily_briefs').upsert(
        { company_id: companyId, date: today, content: text },
        { onConflict: 'company_id,date' }
      );
      results.push({ company_id: companyId, ok: true });
    } catch (err) {
      console.error(`Brief failed for ${companyId}:`, err);
      results.push({ company_id: companyId, ok: false });
    }
  }

  return Response.json({ ok: true, results }, { headers: corsHeaders });
});
