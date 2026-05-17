import { createClient } from 'npm:@supabase/supabase-js@^2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const { workflow_id, input } = await req.json();
  if (!workflow_id) return new Response('Missing workflow_id', { status: 400 });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: workflow, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', workflow_id)
    .single();

  if (error || !workflow) {
    return Response.json({ ok: false, error: 'Workflow not found' }, { status: 404, headers: corsHeaders });
  }

  // Record execution attempt in workspace_events
  await supabase.from('workspace_events').insert({
    company_id:    workflow.company_id,
    type:          'workflow.triggered',
    source_module: 'automation',
    entity_type:   'workflow',
    entity_id:     workflow_id,
    payload:       { workflow_name: workflow.name, input },
  });

  return Response.json({ ok: true, workflow_id, status: 'triggered' }, { headers: corsHeaders });
});
