import { useCallback, useEffect, useState } from 'react';
import { api, WorkflowTrigger, WorkflowAction } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Zap, Plus, Trash2, Play, Pause, TestTube2, ChevronRight,
  Clock, Filter, Mail, Bell, Tag, Webhook, Sparkles, Users,
  ArrowRight, RefreshCw, CheckCircle2, AlertCircle, Wand2,
} from 'lucide-react';

// ── Trigger / Action katalog ──────────────────────────────────────────────────

const TRIGGER_OPTIONS: { value: WorkflowTrigger; label: string; description: string; icon: string }[] = [
  { value: 'new_lead_created',      label: 'Ny lead oprettet',            description: 'Kører når en ny lead registreres i CRM',       icon: '👤' },
  { value: 'lead_status_changed',   label: 'Lead-status skifter',         description: 'Kører når et leads status ændres',              icon: '🔄' },
  { value: 'lead_score_changed',    label: 'Lead-score ændres',           description: 'Kører når et leads score krydser en grænse',    icon: '📊' },
  { value: 'new_employee_created',  label: 'Ny medarbejder oprettet',     description: 'Kører når en medarbejder tilføjes i HR',        icon: '🧑‍💼' },
  { value: 'invoice_overdue',       label: 'Faktura forfalden',           description: 'Kører når en faktura er overskredet betalingsfrist', icon: '📄' },
  { value: 'invoice_paid',          label: 'Faktura betalt',              description: 'Kører når betaling modtages',                  icon: '💳' },
  { value: 'task_completed',        label: 'Opgave afsluttet',            description: 'Kører når en opgave markeres som færdig',       icon: '✅' },
  { value: 'campaign_sent',         label: 'Kampagne udsendt',            description: 'Kører når en email-kampagne sendes',            icon: '📧' },
  { value: 'manual_trigger',        label: 'Manuel udløser',              description: 'Kør workflow manuelt fra en knap',              icon: '▶️' },
];

const ACTION_OPTIONS: { value: WorkflowAction; label: string; icon: React.ElementType }[] = [
  { value: 'create_task',           label: 'Opret opgave',              icon: CheckCircle2 },
  { value: 'send_email',            label: 'Send email',                icon: Mail },
  { value: 'send_notification',     label: 'Send notifikation',         icon: Bell },
  { value: 'update_lead_status',    label: 'Opdater lead-status',       icon: Tag },
  { value: 'send_invitation_email', label: 'Send invitations-email',    icon: Users },
  { value: 'generate_ai_content',   label: 'Generer AI-indhold',        icon: Sparkles },
  { value: 'send_webhook',          label: 'Send webhook',              icon: Webhook },
];

const LEAD_STATUSES = ['cold', 'contacted', 'qualified', 'customer', 'lost'];

// ── Pre-built templates ───────────────────────────────────────────────────────

type WorkflowTemplate = {
  name: string;
  description: string;
  emoji: string;
  triggerType: WorkflowTrigger;
  triggerConfig?: Record<string, unknown>;
  steps: Array<{ type: 'condition' | 'action' | 'delay'; config: Record<string, unknown>; stepOrder: number }>;
};

const TEMPLATES: WorkflowTemplate[] = [
  {
    name: 'Ny lead → Opfølgningsopgave',
    description: 'Opretter automatisk en opgave til sælgeren når en ny lead registreres',
    emoji: '👤',
    triggerType: 'new_lead_created',
    steps: [
      { type: 'action', config: { action: 'create_task', title: 'Følg op på ny lead: {{lead.name}}', assignTo: 'self', dueInDays: 1 }, stepOrder: 0 },
    ],
  },
  {
    name: 'Lead kvalificeret → Notifikation',
    description: 'Sender en notifikation til sælger når et lead opgraderes til "Kvalificeret"',
    emoji: '🎯',
    triggerType: 'lead_status_changed',
    triggerConfig: { to_status: 'qualified' },
    steps: [
      { type: 'action', config: { action: 'send_notification', message: '{{lead.name}} er nu kvalificeret og klar til tilbud' }, stepOrder: 0 },
    ],
  },
  {
    name: 'Lead tabt → Analyse-opgave',
    description: 'Opretter en opgave til at analysere hvorfor et lead gik tabt',
    emoji: '🔍',
    triggerType: 'lead_status_changed',
    triggerConfig: { to_status: 'lost' },
    steps: [
      { type: 'delay', config: { minutes: 60 }, stepOrder: 0 },
      { type: 'action', config: { action: 'create_task', title: 'Analyser tabt lead: {{lead.name}}', dueInDays: 3 }, stepOrder: 1 },
    ],
  },
  {
    name: 'Faktura forfalden → Påmindelsesopgave',
    description: 'Opretter automatisk en opkrævningsopgave ved overskredet betalingsfrist',
    emoji: '📄',
    triggerType: 'invoice_overdue',
    steps: [
      { type: 'action', config: { action: 'create_task', title: 'Opkrævning: {{invoice.customer}} ({{invoice.amount}} kr)', dueInDays: 1 }, stepOrder: 0 },
      { type: 'action', config: { action: 'send_notification', message: 'Faktura {{invoice.number}} er overskredet forfaldsdato' }, stepOrder: 1 },
    ],
  },
  {
    name: 'Ny medarbejder → Send invitation',
    description: 'Sender automatisk login-invitation til nyoprettede medarbejdere',
    emoji: '🧑‍💼',
    triggerType: 'new_employee_created',
    steps: [
      { type: 'action', config: { action: 'send_invitation_email', message: 'Velkommen til teamet, {{employee.name}}! Klik her for at aktivere din konto.' }, stepOrder: 0 },
    ],
  },
  {
    name: 'Faktura betalt → Tak-email',
    description: 'Sender en tak-email til kunden når betaling modtages',
    emoji: '💳',
    triggerType: 'invoice_paid',
    steps: [
      { type: 'action', config: { action: 'send_email', subject: 'Tak for din betaling', body: 'Kære {{customer.name}},\n\nVi bekræfter modtagelse af din betaling på {{invoice.amount}} kr.' }, stepOrder: 0 },
    ],
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type WorkflowStep = {
  type: 'condition' | 'action' | 'delay';
  config: Record<string, unknown>;
  stepOrder: number;
};

type Workflow = {
  id: string;
  name: string;
  status: 'active' | 'paused';
  triggerType: WorkflowTrigger;
  triggerConfig?: Record<string, unknown>;
  steps?: WorkflowStep[];
  runCount?: number;
  lastRunAt?: string;
};

// ── Step editor ───────────────────────────────────────────────────────────────

function StepEditor({
  step, index, onChange, onRemove,
}: {
  step: WorkflowStep;
  index: number;
  onChange: (idx: number, config: Record<string, unknown>) => void;
  onRemove: (idx: number) => void;
}) {
  const typeColors = {
    condition: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800',
    action:    'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
    delay:     'bg-muted border-border',
  };
  const typeIcon = { condition: <Filter className="h-3.5 w-3.5" />, action: <Zap className="h-3.5 w-3.5" />, delay: <Clock className="h-3.5 w-3.5" /> };
  const typeLabel = { condition: 'Betingelse', action: 'Handling', delay: 'Pause' };

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${typeColors[step.type]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold">
          {typeIcon[step.type]}
          Trin {index + 1}: {typeLabel[step.type]}
        </div>
        <button onClick={() => onRemove(index)} className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Condition step */}
      {step.type === 'condition' && (
        <div className="grid grid-cols-3 gap-2">
          <Select value={String(step.config.field || 'status')} onValueChange={(v) => onChange(index, { ...step.config, field: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Felt" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="source">Kilde</SelectItem>
              <SelectItem value="lead_score">Lead score</SelectItem>
              <SelectItem value="country">Land</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(step.config.operator || 'equals')} onValueChange={(v) => onChange(index, { ...step.config, operator: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Operator" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="equals">Er lig med</SelectItem>
              <SelectItem value="not_equals">Er ikke lig med</SelectItem>
              <SelectItem value="greater_than">Større end</SelectItem>
              <SelectItem value="contains">Indeholder</SelectItem>
            </SelectContent>
          </Select>
          <Input
            className="h-8 text-xs"
            placeholder="Værdi"
            value={String(step.config.value || '')}
            onChange={(e) => onChange(index, { ...step.config, value: e.target.value })}
          />
        </div>
      )}

      {/* Delay step */}
      {step.type === 'delay' && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            className="h-8 text-xs w-24"
            value={String(step.config.minutes || 5)}
            onChange={(e) => onChange(index, { ...step.config, minutes: Number(e.target.value) })}
          />
          <Select value={String(step.config.unit || 'minutes')} onValueChange={(v) => onChange(index, { ...step.config, unit: v })}>
            <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">Minutter</SelectItem>
              <SelectItem value="hours">Timer</SelectItem>
              <SelectItem value="days">Dage</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Action step */}
      {step.type === 'action' && (
        <div className="space-y-2">
          <Select
            value={String(step.config.action || 'create_task')}
            onValueChange={(v) => onChange(index, { action: v })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Vælg handling" /></SelectTrigger>
            <SelectContent>
              {ACTION_OPTIONS.map((a) => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Dynamic fields per action */}
          {(step.config.action === 'create_task') && (
            <Input
              className="h-8 text-xs"
              placeholder="Opgavetitel — brug {{lead.name}}, {{invoice.number}} osv."
              value={String(step.config.title || '')}
              onChange={(e) => onChange(index, { ...step.config, title: e.target.value })}
            />
          )}
          {(step.config.action === 'send_notification' || step.config.action === 'send_invitation_email') && (
            <Input
              className="h-8 text-xs"
              placeholder="Besked"
              value={String(step.config.message || '')}
              onChange={(e) => onChange(index, { ...step.config, message: e.target.value })}
            />
          )}
          {step.config.action === 'send_email' && (
            <>
              <Input className="h-8 text-xs" placeholder="Emne" value={String(step.config.subject || '')} onChange={(e) => onChange(index, { ...step.config, subject: e.target.value })} />
              <Input className="h-8 text-xs" placeholder="Indhold (brug {{kunde.navn}} osv.)" value={String(step.config.body || '')} onChange={(e) => onChange(index, { ...step.config, body: e.target.value })} />
            </>
          )}
          {step.config.action === 'update_lead_status' && (
            <Select value={String(step.config.status || 'contacted')} onValueChange={(v) => onChange(index, { ...step.config, status: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Ny status" /></SelectTrigger>
              <SelectContent>
                {LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {step.config.action === 'send_webhook' && (
            <Input className="h-8 text-xs" placeholder="https://webhook.site/..." value={String(step.config.url || '')} onChange={(e) => onChange(index, { ...step.config, url: e.target.value })} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Workflow card ─────────────────────────────────────────────────────────────

function WorkflowCard({
  workflow, onToggle, onTest, testLeadId, busy,
}: {
  workflow: Workflow;
  onToggle: (wf: Workflow) => void;
  onTest: (id: string) => void;
  testLeadId: string;
  busy: boolean;
}) {
  const trigger = TRIGGER_OPTIONS.find((t) => t.value === workflow.triggerType);
  const isActive = workflow.status === 'active';

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
      <div className="text-2xl shrink-0">{trigger?.icon ?? '⚡'}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">{workflow.name}</span>
          <Badge variant={isActive ? 'default' : 'secondary'} className="text-xs shrink-0">
            {isActive ? 'Aktiv' : 'Pauseret'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{trigger?.label}</p>
        {(workflow.runCount ?? 0) > 0 && (
          <p className="text-xs text-muted-foreground">Kørt {workflow.runCount} gang{workflow.runCount !== 1 ? 'e' : ''}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
          onClick={() => onTest(workflow.id)}
          disabled={busy}
        >
          <TestTube2 className="h-3.5 w-3.5" />
          Test
        </button>
        <button
          className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
            isActive
              ? 'border-border hover:bg-muted text-muted-foreground'
              : 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20'
          }`}
          onClick={() => onToggle(workflow)}
          disabled={busy}
        >
          {isActive ? <><Pause className="h-3.5 w-3.5" />Pause</> : <><Play className="h-3.5 w-3.5" />Aktivér</>}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type View = 'list' | 'builder' | 'templates';

export default function WorkflowsPage() {
  const { toast } = useToast();
  const [view, setView] = useState<View>('list');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [suggestions, setSuggestions] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testLeadId, setTestLeadId] = useState('');

  // Builder state
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<WorkflowTrigger>('new_lead_created');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({});
  const [steps, setSteps] = useState<WorkflowStep[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listWorkflows();
      setWorkflows(res.data as unknown as Workflow[]);
      setSuggestions(res.suggestions ?? []);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Kunne ikke hente workflows', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const resetBuilder = () => {
    setName('');
    setTriggerType('new_lead_created');
    setTriggerConfig({});
    setSteps([]);
  };

  const loadTemplate = (tpl: WorkflowTemplate) => {
    setName(tpl.name);
    setTriggerType(tpl.triggerType);
    setTriggerConfig(tpl.triggerConfig ?? {});
    setSteps(tpl.steps);
    setView('builder');
  };

  const addStep = (type: WorkflowStep['type']) => {
    const defaultConfig: Record<string, string | number> =
      type === 'condition' ? { field: 'status', operator: 'equals', value: '' }
      : type === 'delay' ? { minutes: 60, unit: 'minutes' }
      : { action: 'create_task', title: '' };
    setSteps((prev) => [...prev, { type, config: defaultConfig, stepOrder: prev.length }]);
  };

  const updateStep = (idx: number, config: Record<string, unknown>) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, config } : s)));
  };

  const removeStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stepOrder: i })));
  };

  const saveWorkflow = async () => {
    if (!name.trim()) { toast({ title: 'Giv workflowet et navn', variant: 'destructive' }); return; }
    if (steps.length === 0) { toast({ title: 'Tilføj mindst ét trin', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      await api.createWorkflow({ name, triggerType, triggerConfig, steps });
      toast({ title: 'Workflow gemt og aktiveret' });
      resetBuilder();
      setView('list');
      await load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Kunne ikke gemme workflow', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const toggleWorkflow = async (wf: Workflow) => {
    setBusy(true);
    try {
      if (wf.status === 'active') {
        await api.pauseWorkflow(wf.id);
        toast({ title: `"${wf.name}" er sat på pause` });
      } else {
        await api.activateWorkflow(wf.id);
        toast({ title: `"${wf.name}" er aktiveret` });
      }
      await load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Fejl', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const runTest = async (workflowId: string) => {
    setBusy(true);
    try {
      await api.runWorkflowTest(workflowId, testLeadId || undefined);
      toast({ title: 'Testkørsel startet', description: 'Tjek aktivitetsloggen for resultatet' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Test fejlede', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const approveOrReject = async (id: string, approve: boolean) => {
    setBusy(true);
    try {
      if (approve) await api.approveAiSuggestion(id);
      else await api.rejectAiSuggestion(id);
      toast({ title: approve ? 'Forslag godkendt og aktiveret' : 'Forslag afvist' });
      await load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Fejl', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const activeCount = workflows.filter((w) => w.status === 'active').length;

  const selectedTrigger = TRIGGER_OPTIONS.find((t) => t.value === triggerType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-500" />
            Automatisering
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Byg automatiske flows der forbinder CRM, HR, fakturaer og emails — uden kode
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Opdater
          </Button>
          {view !== 'builder' && (
            <Button size="sm" onClick={() => { resetBuilder(); setView('builder'); }}>
              <Plus className="h-3.5 w-3.5 mr-1" />Nyt workflow
            </Button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Aktive workflows', value: activeCount, color: 'text-green-600 dark:text-green-400' },
          { label: 'I alt', value: workflows.length, color: 'text-foreground' },
          { label: 'AI-forslag', value: suggestions.length, color: 'text-purple-600 dark:text-purple-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-border gap-0">
        {([
          { id: 'list'      as View, label: 'Mine workflows' },
          { id: 'templates' as View, label: 'Skabeloner' },
          { id: 'builder'   as View, label: 'Byg nyt' },
        ]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => { if (id === 'builder') { resetBuilder(); } setView(id); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              view === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <div className="space-y-4">
          {/* AI suggestions */}
          {suggestions.length > 0 && (
            <div className="rounded-2xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-purple-200 dark:border-purple-800">
                <Wand2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">AI-forslag</span>
                <Badge className="bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-200 text-xs">{suggestions.length}</Badge>
              </div>
              <div className="divide-y divide-purple-200 dark:divide-purple-800">
                {suggestions.map((s) => (
                  <div key={String(s.id)} className="flex items-center gap-4 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-purple-800 dark:text-purple-200">{String(s.title || 'AI-forslag')}</p>
                      <p className="text-xs text-purple-600 dark:text-purple-400 truncate">{String(s.description || '')}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white h-7 text-xs" onClick={() => void approveOrReject(String(s.id), true)} disabled={busy}>
                        Godkend
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-purple-600 hover:text-purple-800" onClick={() => void approveOrReject(String(s.id), false)} disabled={busy}>
                        Afvis
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workflow list */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-sm">Workflows</h3>
              {workflows.length > 0 && (
                <div className="flex items-center gap-2">
                  <Input
                    className="h-7 text-xs w-48"
                    placeholder="Lead-ID til testkørsel (valgfrit)"
                    value={testLeadId}
                    onChange={(e) => setTestLeadId(e.target.value)}
                  />
                </div>
              )}
            </div>
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Indlæser…</div>
            ) : workflows.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="flex justify-center">
                  <div className="rounded-2xl bg-muted p-5">
                    <Zap className="h-8 w-8 text-muted-foreground" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Ingen workflows endnu</p>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" variant="outline" onClick={() => setView('templates')}>
                    <Wand2 className="h-3.5 w-3.5 mr-1" />Se skabeloner
                  </Button>
                  <Button size="sm" onClick={() => { resetBuilder(); setView('builder'); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Byg fra bunden
                  </Button>
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {workflows.map((wf) => (
                  <WorkflowCard
                    key={wf.id}
                    workflow={wf}
                    onToggle={(w) => void toggleWorkflow(w)}
                    onTest={(id) => void runTest(id)}
                    testLeadId={testLeadId}
                    busy={busy}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TEMPLATES VIEW ── */}
      {view === 'templates' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Klik på en skabelon for at åbne den i workflowbuilderen — du kan tilpasse den inden du gemmer.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.name}
                onClick={() => loadTemplate(tpl)}
                className="rounded-2xl border bg-card p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{tpl.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{tpl.description}</p>
                    <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                      <span>{TRIGGER_OPTIONS.find((t) => t.value === tpl.triggerType)?.label}</span>
                      {tpl.steps.map((_, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <ChevronRight className="h-3 w-3" />
                          <span>{tpl.steps[i].type === 'action' ? ACTION_OPTIONS.find((a) => a.value === tpl.steps[i].config.action)?.label : tpl.steps[i].type === 'delay' ? 'Pause' : 'Betingelse'}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── BUILDER VIEW ── */}
      {view === 'builder' && (
        <div className="space-y-5">
          {/* Navn */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <div className="text-sm font-semibold">Workflow navn</div>
            <Input
              placeholder="Fx: Ny lead → opfølgningsopgave"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Trigger */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <div className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Udløser — hvornår starter workflowet?
            </div>
            <Select value={triggerType} onValueChange={(v) => { setTriggerType(v as WorkflowTrigger); setTriggerConfig({}); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center gap-2">
                      <span>{t.icon}</span>
                      <span>{t.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTrigger && (
              <p className="text-xs text-muted-foreground">{selectedTrigger.description}</p>
            )}

            {/* Trigger config — lead status */}
            {triggerType === 'lead_status_changed' && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Status skifter til</span>
                <Select value={String(triggerConfig.to_status || 'qualified')} onValueChange={(v) => setTriggerConfig({ to_status: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {triggerType === 'lead_score_changed' && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Score overstiger</span>
                <Input
                  type="number"
                  className="h-8 text-xs w-24"
                  value={String(triggerConfig.threshold || 50)}
                  onChange={(e) => setTriggerConfig({ threshold: Number(e.target.value) })}
                />
              </div>
            )}
          </div>

          {/* Steps */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <div className="text-sm font-semibold flex items-center gap-2">
              <Filter className="h-4 w-4 text-blue-500" />
              Trin — hvad sker der?
            </div>

            {steps.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed border-border rounded-xl">
                Tilføj mindst ét trin nedenfor
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <StepEditor
                    key={i}
                    step={step}
                    index={i}
                    onChange={updateStep}
                    onRemove={removeStep}
                  />
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => addStep('action')}>
                <Zap className="h-3.5 w-3.5 mr-1 text-blue-500" />Tilføj handling
              </Button>
              <Button size="sm" variant="outline" onClick={() => addStep('condition')}>
                <Filter className="h-3.5 w-3.5 mr-1 text-amber-500" />Tilføj betingelse
              </Button>
              <Button size="sm" variant="outline" onClick={() => addStep('delay')}>
                <Clock className="h-3.5 w-3.5 mr-1 text-muted-foreground" />Tilføj pause
              </Button>
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <Button onClick={() => void saveWorkflow()} disabled={busy || !name.trim() || steps.length === 0} size="lg" className="flex-1">
              {busy ? 'Gemmer…' : <><CheckCircle2 className="h-4 w-4 mr-2" />Gem og aktivér workflow</>}
            </Button>
            <Button variant="outline" onClick={() => { resetBuilder(); setView('list'); }}>
              Annuller
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
