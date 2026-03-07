import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

type WorkflowStep = {
  type: 'condition' | 'action' | 'delay';
  config: Record<string, unknown>;
  stepOrder: number;
};

type Workflow = {
  id: string;
  name: string;
  status: 'active' | 'paused';
  triggerType: string;
  steps?: WorkflowStep[];
};

export default function WorkflowsPage() {
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [suggestions, setSuggestions] = useState<Array<Record<string, unknown>>>([]);
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<'new_lead_created' | 'integration_connected' | 'manual_trigger'>(
    'new_lead_created'
  );
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [testLeadId, setTestLeadId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadWorkflows = async () => {
    setLoadError(null);
    try {
      const result = await api.listWorkflows();
      setWorkflows(result.data as Workflow[]);
      setSuggestions((result.suggestions || []) as Array<Record<string, unknown>>);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load workflows');
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, []);

  const addStep = (type: WorkflowStep['type']) => {
    const stepOrder = steps.length;
    const config: Record<string, unknown> = {};
    if (type === 'condition') {
      config.type = 'field_equals';
      config.field = 'country';
      config.value = 'USA';
    }
    if (type === 'action') {
      config.action = 'send_webhook';
      config.url = '';
    }
    if (type === 'delay') {
      config.minutes = 5;
    }
    setSteps([...steps, { type, config, stepOrder }]);
  };

  const updateStepConfig = (index: number, key: string, value: string) => {
    setSteps((prev) =>
      prev.map((step, idx) => (idx === index ? { ...step, config: { ...step.config, [key]: value } } : step))
    );
  };

  const createWorkflow = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await api.createWorkflow({ name, triggerType, steps });
      setName('');
      setSteps([]);
      await loadWorkflows();
      toast({ title: 'Workflow created' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not create workflow', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkflow = async (workflow: Workflow) => {
    setLoading(true);
    try {
      if (workflow.status === 'active') {
        await api.pauseWorkflow(workflow.id);
        toast({ title: 'Workflow paused' });
      } else {
        await api.activateWorkflow(workflow.id);
        toast({ title: 'Workflow activated' });
      }
      await loadWorkflows();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not update workflow', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const runTest = async (workflowId: string) => {
    setLoading(true);
    try {
      await api.runWorkflowTest(workflowId, testLeadId || undefined);
      toast({ title: 'Test run started' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Test run failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const approveSuggestion = async (id: string) => {
    setLoading(true);
    try {
      await api.approveAiSuggestion(id);
      await loadWorkflows();
      toast({ title: 'Suggestion approved' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not approve suggestion', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const rejectSuggestion = async (id: string) => {
    setLoading(true);
    try {
      await api.rejectAiSuggestion(id);
      await loadWorkflows();
      toast({ title: 'Suggestion rejected' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not reject suggestion', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Workflows</h1>
        <p className="text-sm text-muted-foreground">Automate lead actions with triggers and steps.</p>
      </div>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      <Card className="p-6 space-y-4 bg-card/70 backdrop-blur border-border">
        <div className="text-sm font-semibold">Create workflow</div>
        <Input placeholder="Workflow name" value={name} onChange={(event) => setName(event.target.value)} />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={triggerType}
          onChange={(event) => setTriggerType(event.target.value as Workflow['triggerType'])}
        >
          <option value="new_lead_created">New lead created</option>
          <option value="integration_connected">Integration connected</option>
          <option value="manual_trigger">Manual trigger</option>
        </select>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => addStep('condition')}>
            Add condition
          </Button>
          <Button size="sm" variant="outline" onClick={() => addStep('delay')}>
            Add delay
          </Button>
          <Button size="sm" variant="outline" onClick={() => addStep('action')}>
            Add action
          </Button>
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={index} className="rounded-md border border-border p-3 space-y-2">
              <div className="text-xs text-muted-foreground">Step {index + 1}: {step.type}</div>
              {step.type === 'condition' && (
                <div className="grid gap-2 md:grid-cols-3">
                  <Input
                    placeholder="Condition type"
                    value={String(step.config.type || '')}
                    onChange={(event) => updateStepConfig(index, 'type', event.target.value)}
                  />
                  <Input
                    placeholder="Field"
                    value={String(step.config.field || '')}
                    onChange={(event) => updateStepConfig(index, 'field', event.target.value)}
                  />
                  <Input
                    placeholder="Value"
                    value={String(step.config.value || '')}
                    onChange={(event) => updateStepConfig(index, 'value', event.target.value)}
                  />
                </div>
              )}
              {step.type === 'delay' && (
                <Input
                  placeholder="Minutes"
                  value={String(step.config.minutes || '')}
                  onChange={(event) => updateStepConfig(index, 'minutes', event.target.value)}
                />
              )}
              {step.type === 'action' && (
                <div className="grid gap-2 md:grid-cols-2">
                  <Input
                    placeholder="Action"
                    value={String(step.config.action || '')}
                    onChange={(event) => updateStepConfig(index, 'action', event.target.value)}
                  />
                  <Input
                    placeholder="Webhook URL / Status / Tag"
                    value={String(step.config.url || step.config.status || step.config.tag || '')}
                    onChange={(event) => updateStepConfig(index, 'url', event.target.value)}
                  />
                  <Textarea
                    placeholder="Optional JSON config"
                    value={JSON.stringify(step.config, null, 2)}
                    onChange={(event) => {
                      try {
                        const parsed = JSON.parse(event.target.value);
                        setSteps((prev) =>
                          prev.map((item, idx) => (idx === index ? { ...item, config: parsed } : item))
                        );
                      } catch {
                        // ignore invalid JSON
                      }
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <Button onClick={createWorkflow} disabled={loading}>
          Save workflow
        </Button>
      </Card>

      <Card className="p-6 space-y-3 bg-card/70 backdrop-blur border-border">
        <div className="text-sm font-semibold">Existing workflows</div>
        <Input
          placeholder="Lead ID for test run (optional)"
          value={testLeadId}
          onChange={(event) => setTestLeadId(event.target.value)}
        />
        {workflows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No workflows yet.</div>
        ) : (
          <div className="space-y-3">
            {workflows.map((workflow) => (
              <div key={workflow.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                <div>
                  <div className="text-sm font-medium">{workflow.name}</div>
                  <div className="text-xs text-muted-foreground">{workflow.triggerType} · {workflow.status}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => runTest(workflow.id)} disabled={loading}>
                    Run test
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleWorkflow(workflow)} disabled={loading}>
                    {workflow.status === 'active' ? 'Pause' : 'Activate'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-3 bg-card/70 backdrop-blur border-border">
        <div className="text-sm font-semibold">AI Suggestions</div>
        {suggestions.length === 0 ? (
          <div className="text-sm text-muted-foreground">No AI suggestions.</div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <div key={String(suggestion.id)} className="rounded-md border border-border p-3">
                <div className="text-sm font-medium">{String(suggestion.title || 'AI suggestion')}</div>
                <div className="text-xs text-muted-foreground">{String(suggestion.description || '')}</div>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => approveSuggestion(String(suggestion.id))} disabled={loading}>
                    Approve
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => rejectSuggestion(String(suggestion.id))} disabled={loading}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

