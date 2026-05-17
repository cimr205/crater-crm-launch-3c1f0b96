import { createClient } from 'npm:@supabase/supabase-js@^2';
import { generateText, tool } from 'npm:ai@^4';
import { z } from 'npm:zod@^3';
import { createLovableAiGatewayProvider, DEFAULT_MODEL } from '../_shared/ai-gateway.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function resolveCompanyId(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth) return null;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(SUPABASE_URL, anonKey, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;
  const { data } = await userClient.from('users').select('company_id').eq('id', user.id).single();
  return data?.company_id ?? null;
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const body = await req.json() as {
    event?: Record<string, unknown>;
    system_context?: string;
    chat_message?: string;
    read_only?: boolean;
    company_id?: string;
  };

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Resolve company_id: from body, or from JWT
  const companyId = body.company_id ?? await resolveCompanyId(req);
  if (!companyId) {
    return Response.json({ ok: false, error: 'Cannot resolve company' }, { status: 400, headers: corsHeaders });
  }

  const systemPrompt = [
    'Du er en proaktiv business-assistent for en dansk virksomhed.',
    'Du har adgang til CRM-data, fakturaer og opgaver.',
    'Svar altid på dansk. Vær kortfattet og handlingsorienteret.',
    body.system_context ? `Kontekst: ${body.system_context}` : '',
    body.event ? `Udløst af hændelse: ${JSON.stringify(body.event)}` : '',
  ].filter(Boolean).join('\n');

  const userMessage = body.chat_message
    ?? (body.event ? `Analyser denne hændelse og foreslå relevante handlinger: ${JSON.stringify(body.event)}` : 'Hvad bør vi fokusere på nu?');

  const gateway = createLovableAiGatewayProvider();

  const tools = {
    list_recent_signals: tool({
      description: 'Hent de seneste hændelser fra event bus',
      inputSchema: z.object({ limit: z.number().optional() }),
      execute: async ({ limit = 20 }) => {
        const { data } = await db.from('workspace_events')
          .select('*').eq('company_id', companyId)
          .order('created_at', { ascending: false }).limit(limit);
        return data ?? [];
      },
    }),
    list_overdue_invoices: tool({
      description: 'Hent forfaldne fakturaer',
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await db.from('invoices')
          .select('id,invoice_number,customer_name,total,due_date,status')
          .eq('company_id', companyId)
          .or('status.eq.overdue,and(status.eq.sent,due_date.lt.' + new Date().toISOString().split('T')[0] + ')');
        return data ?? [];
      },
    }),
    list_leads: tool({
      description: 'Hent leads fra CRM',
      inputSchema: z.object({ status: z.string().optional() }),
      execute: async ({ status }) => {
        let q = db.from('leads').select('id,first_name,last_name,company_name,email,status,lead_score')
          .eq('company_id', companyId).order('created_at', { ascending: false }).limit(25);
        if (status) q = q.eq('status', status);
        const { data } = await q;
        return data ?? [];
      },
    }),
    create_task: tool({
      description: 'Opret en ny opgave',
      inputSchema: z.object({
        title: z.string(),
        type: z.string().optional(),
        due_at: z.string().optional(),
        related_lead_id: z.string().optional(),
        related_deal_id: z.string().optional(),
      }),
      execute: async (input) => {
        if (body.read_only) return { skipped: 'read-only mode' };
        await db.from('autopilot_actions').insert({
          company_id: companyId,
          suggested_by: 'autopilot-agent',
          action_type: 'create_task',
          payload: input,
          status: 'proposed',
        });
        return { proposed: true };
      },
    }),
    update_lead_status: tool({
      description: 'Opdater status på et lead',
      inputSchema: z.object({ lead_id: z.string(), status: z.string() }),
      execute: async ({ lead_id, status }) => {
        if (body.read_only) return { skipped: 'read-only mode' };
        await db.from('leads').update({ status }).eq('id', lead_id).eq('company_id', companyId);
        return { updated: true };
      },
    }),
    move_deal_stage: tool({
      description: 'Flyt et deal til et nyt stadie',
      inputSchema: z.object({ deal_id: z.string(), stage_id: z.string(), reason: z.string().optional() }),
      execute: async ({ deal_id, stage_id }) => {
        if (body.read_only) return { skipped: 'read-only mode' };
        await db.from('deals').update({ stage_id, stage_entered_at: new Date().toISOString() })
          .eq('id', deal_id).eq('company_id', companyId);
        return { updated: true };
      },
    }),
    propose_email: tool({
      description: 'Foreslå at sende en email (til godkendelse)',
      inputSchema: z.object({ to: z.string(), subject: z.string(), body: z.string() }),
      execute: async (input) => {
        await db.from('autopilot_actions').insert({
          company_id: companyId,
          suggested_by: 'autopilot-agent',
          action_type: 'propose_email',
          payload: input,
          status: 'proposed',
        });
        return { proposed: true };
      },
    }),
  };

  try {
    const result = await generateText({
      model: gateway(DEFAULT_MODEL),
      system: systemPrompt,
      prompt: userMessage,
      tools,
      maxSteps: 50,
    });

    return Response.json({ ok: true, reply: result.text }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500, headers: corsHeaders });
  }
});
