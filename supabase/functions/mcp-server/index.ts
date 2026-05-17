import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@^2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ToolResult { content: [{ type: 'text'; text: string }] }
type ToolHandler = (input: Record<string, unknown>, db: SupabaseClient, companyId: string) => Promise<ToolResult>;

function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

async function resolveCompany(token: string, db: SupabaseClient): Promise<string | null> {
  const { data } = await db.from('mcp_tokens').select('company_id')
    .eq('token', token).single();
  if (data?.company_id) {
    await db.from('mcp_tokens').update({ last_used_at: new Date().toISOString() }).eq('token', token);
    return data.company_id;
  }
  return null;
}

const TOOLS: Record<string, { description: string; handler: ToolHandler }> = {

  // ── CRM ──────────────────────────────────────────────────────────────────────

  update_lead_status: {
    description: 'Opdater status på et CRM lead',
    handler: async ({ lead_id, status }, db, cid) => {
      await db.from('leads').update({ status }).eq('id', lead_id).eq('company_id', cid);
      return ok({ updated: true });
    },
  },

  move_deal_stage: {
    description: 'Flyt et deal til nyt stadie i pipeline',
    handler: async ({ deal_id, stage_id }, db, cid) => {
      await db.from('deals').update({ stage_id, stage_entered_at: new Date().toISOString() })
        .eq('id', deal_id).eq('company_id', cid);
      return ok({ updated: true });
    },
  },

  score_lead: {
    description: 'Beregn ICP-score for et lead',
    handler: async ({ lead_id }, _db, cid) => {
      const fnUrl = SUPABASE_URL + '/functions/v1/icp-score';
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id, company_id: cid }),
      });
      return ok(await res.json());
    },
  },

  link_lead_to_deal: {
    description: 'Knyt et lead til et deal',
    handler: async ({ lead_id, deal_id }, db, cid) => {
      await db.from('deals').update({ lead_id }).eq('id', deal_id).eq('company_id', cid);
      return ok({ updated: true });
    },
  },

  create_deal: {
    description: 'Opret et nyt deal i CRM',
    handler: async ({ title, value, expected_close_date, stage_id = 'new_lead' }, db, cid) => {
      const { data } = await db.from('deals')
        .insert({ company_id: cid, title, value, stage_id, stage_entered_at: new Date().toISOString() })
        .select('id').single();
      return ok(data);
    },
  },

  // ── Kommunikation ─────────────────────────────────────────────────────────────

  send_email_via_gmail: {
    description: 'Send en email via Gmail integration',
    handler: async ({ to, subject, body, thread_id, user_id }, _db, cid) => {
      const res = await fetch(SUPABASE_URL + '/functions/v1/gmail-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body, thread_id, user_id, company_id: cid }),
      });
      return ok(await res.json());
    },
  },

  draft_email: {
    description: 'Opret et email-udkast til godkendelse',
    handler: async ({ to, subject, body }, db, cid) => {
      const { data } = await db.from('autopilot_actions').insert({
        company_id: cid,
        suggested_by: 'mcp',
        action_type: 'propose_email',
        payload: { to, subject, body },
        status: 'proposed',
      }).select('id').single();
      return ok({ proposed: true, action_id: data?.id });
    },
  },

  summarize_thread: {
    description: 'Opsummer en email-tråd',
    handler: async ({ thread_id }, db, cid) => {
      const { data } = await db.from('workspace_events')
        .select('payload').eq('company_id', cid)
        .contains('payload', { thread_id }).limit(20);
      return ok({ thread_id, messages: data?.length ?? 0, summary: 'Thread summary unavailable without LLM context' });
    },
  },

  // ── Finance ───────────────────────────────────────────────────────────────────

  create_invoice: {
    description: 'Opret en ny faktura',
    handler: async ({ customer_name, customer_email, due_date }, db, cid) => {
      const { data: last } = await db.from('invoices').select('invoice_number')
        .eq('company_id', cid).order('created_at', { ascending: false }).limit(1).single();
      const nextNum = String((parseInt(String(last?.invoice_number ?? '0').replace(/\D/g, '') || '0') + 1)).padStart(4, '0');
      const { data } = await db.from('invoices').insert({
        company_id: cid,
        invoice_number: nextNum,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date,
        customer_name,
        customer_email,
        status: 'draft',
        currency: 'DKK',
        vat_rate: 25,
        subtotal: 0, vat_amount: 0, total: 0,
      }).select('id,invoice_number').single();
      return ok(data);
    },
  },

  mark_invoice_paid: {
    description: 'Marker en faktura som betalt',
    handler: async ({ invoice_id, paid_at }, db, cid) => {
      await db.from('invoices').update({ status: 'paid' })
        .eq('id', invoice_id).eq('company_id', cid);
      await db.from('payments').insert({
        company_id: cid,
        invoice_id,
        paid_at: paid_at ?? new Date().toISOString(),
        method: 'manual',
      }).catch(() => null);
      return ok({ updated: true });
    },
  },

  list_overdue_invoices: {
    description: 'Hent forfaldne fakturaer',
    handler: async ({ days_overdue = 0 }, db, cid) => {
      const cutoff = new Date(Date.now() - Number(days_overdue) * 86400000).toISOString().split('T')[0];
      const { data } = await db.from('invoices').select('id,invoice_number,customer_name,total,due_date,status')
        .eq('company_id', cid)
        .or(`status.eq.overdue,and(status.eq.sent,due_date.lte.${cutoff})`);
      return ok(data ?? []);
    },
  },

  // ── HR / Tasks ────────────────────────────────────────────────────────────────

  list_employees: {
    description: 'Hent liste over medarbejdere',
    handler: async (_input, db, cid) => {
      const { data } = await db.from('users').select('id,full_name,email,role')
        .eq('company_id', cid).neq('role', 'global_admin');
      return ok(data ?? []);
    },
  },

  create_task_for: {
    description: 'Opret en opgave og tildel til en medarbejder',
    handler: async ({ assignee_user_id, title, due_at, related_lead_id, related_deal_id }, db, cid) => {
      const { data } = await db.from('tasks').insert({
        company_id: cid,
        title,
        type: 'Følg op',
        status: 'open',
        due_at,
        owner_user_id: assignee_user_id,
        related_lead_id: related_lead_id ?? null,
        related_deal_id: related_deal_id ?? null,
      }).select('id').single();
      return ok(data);
    },
  },

  // ── Workflow / Events ─────────────────────────────────────────────────────────

  run_workflow: {
    description: 'Kør et workflow',
    handler: async ({ workflow_id, input }, _db, _cid) => {
      const res = await fetch(SUPABASE_URL + '/functions/v1/workflow-runner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow_id, input }),
      });
      return ok(await res.json());
    },
  },

  list_workflows: {
    description: 'Hent liste over tilgængelige workflows',
    handler: async (_input, db, cid) => {
      const { data } = await db.from('workflows').select('id,name,status').eq('company_id', cid);
      return ok(data ?? []);
    },
  },

  emit_event: {
    description: 'Emit en custom hændelse til workspace event bus',
    handler: async ({ type, entity_type, entity_id, payload }, db, cid) => {
      const { data } = await db.from('workspace_events').insert({
        company_id: cid, type, entity_type, entity_id, payload: payload ?? {},
        source_module: 'mcp',
      }).select('id').single();
      return ok({ emitted: true, event_id: data?.id });
    },
  },

  // ── Intelligens ───────────────────────────────────────────────────────────────

  daily_brief: {
    description: 'Hent eller generer dagens daglige brief',
    handler: async (_input, db, cid) => {
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await db.from('daily_briefs')
        .select('*').eq('company_id', cid).eq('date', today).single();
      if (existing) return ok(existing);

      // Generate fresh
      const res = await fetch(SUPABASE_URL + '/functions/v1/autopilot-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: cid }),
      });
      const json = await res.json();
      const { data: fresh } = await db.from('daily_briefs')
        .select('*').eq('company_id', cid).eq('date', today).single();
      return ok(fresh ?? json);
    },
  },

  find_at_risk_deals: {
    description: 'Find deals der er i risiko (ingen aktivitet 7+ dage eller overskredet close date)',
    handler: async (_input, db, cid) => {
      const stale = new Date(Date.now() - 7 * 86400000).toISOString();
      const today = new Date().toISOString().split('T')[0];
      const { data } = await db.from('deals')
        .select('id,title,value,stage_id,updated_at')
        .eq('company_id', cid)
        .not('stage_id', 'in', '(won,lost)')
        .or(`updated_at.lt.${stale}`);
      return ok(data ?? []);
    },
  },

  suggest_next_actions: {
    description: 'Bed Autopilot om at foreslå næste handlinger (read-only)',
    handler: async ({ context }, _db, cid) => {
      const res = await fetch(SUPABASE_URL + '/functions/v1/autopilot-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: cid, chat_message: context ?? 'Hvad bør vi fokusere på nu?', read_only: true }),
      });
      return ok(await res.json());
    },
  },
};

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  // Auth via Bearer token → mcp_tokens
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return new Response('Missing token', { status: 401 });

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const companyId = await resolveCompany(token, db);
  if (!companyId) return new Response('Invalid token', { status: 403 });

  // MCP Streamable HTTP protocol
  // List tools
  if (req.method === 'GET') {
    const toolList = Object.entries(TOOLS).map(([name, { description }]) => ({ name, description }));
    return Response.json({ tools: toolList }, { headers: corsHeaders });
  }

  const body = await req.json() as { tool: string; input?: Record<string, unknown> };
  const def = TOOLS[body.tool];
  if (!def) {
    return Response.json({ error: `Unknown tool: ${body.tool}` }, { status: 404, headers: corsHeaders });
  }

  try {
    const result = await def.handler(body.input ?? {}, db, companyId);
    return Response.json(result, { headers: corsHeaders });
  } catch (err) {
    return Response.json(
      { content: [{ type: 'text', text: JSON.stringify({ error: String(err) }) }] },
      { status: 500, headers: corsHeaders }
    );
  }
});
