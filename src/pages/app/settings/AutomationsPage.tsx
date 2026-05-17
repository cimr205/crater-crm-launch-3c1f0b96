import { useState, useCallback } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, Zap, Webhook, Bot, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/i18n';
import { scheduleDelete } from '@/lib/undoDelete';
import {
  useEventSubscriptions,
  useCreateSubscription,
  useUpdateSubscription,
  useDeleteSubscription,
  type EventSubscription,
  type Condition,
  type CreateSubscriptionInput,
} from '@/hooks/api/useEventSubscriptions';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

const KNOWN_EVENTS = [
  'lead.created', 'lead.updated',
  'deal.created', 'deal.stage_changed', 'deal.won', 'deal.lost',
  'invoice.created', 'invoice.paid', 'invoice.overdue',
  'task.completed', 'email.received',
];

const OPS = ['>', '>=', '<', '<=', '==', '!=', 'contains'];

function ActionTypeIcon({ type }: { type: string }) {
  if (type === 'webhook') return <Webhook className="h-3.5 w-3.5" />;
  if (type === 'workflow') return <GitBranch className="h-3.5 w-3.5" />;
  return <Bot className="h-3.5 w-3.5" />;
}

function ConditionRow({
  cond, index, onChange, onRemove,
}: {
  cond: Condition;
  index: number;
  onChange: (i: number, c: Condition) => void;
  onRemove: (i: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex gap-2 items-center">
      <Input
        placeholder={t('automations.field')}
        value={cond.field}
        onChange={e => onChange(index, { ...cond, field: e.target.value })}
        className="flex-1 h-8 text-sm"
      />
      <Select value={cond.op} onValueChange={v => onChange(index, { ...cond, op: v })}>
        <SelectTrigger className="w-24 h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPS.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input
        placeholder={t('automations.value')}
        value={cond.value}
        onChange={e => onChange(index, { ...cond, value: e.target.value })}
        className="flex-1 h-8 text-sm"
      />
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onRemove(index)}>
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}

const emptyForm = (): CreateSubscriptionInput => ({
  event_pattern: 'lead.created',
  action_type: 'autopilot',
  action_ref: '',
  conditions: [],
});

export default function AutomationsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { data: subscriptions = [], isLoading } = useEventSubscriptions();
  const createMutation  = useCreateSubscription();
  const updateMutation  = useUpdateSubscription();
  const deleteMutation  = useDeleteSubscription();

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows-list'],
    queryFn: () => api.listWorkflows().then(r => r.data ?? []),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm]             = useState<CreateSubscriptionInput>(emptyForm());
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());

  const handleSave = async () => {
    if (!form.action_ref.trim()) {
      toast({ title: t('automations.actionRefRequired'), variant: 'destructive' });
      return;
    }
    try {
      await createMutation.mutateAsync(form);
      setDialogOpen(false);
      setForm(emptyForm());
      toast({ title: t('automations.created') });
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleToggle = async (sub: EventSubscription) => {
    try {
      await updateMutation.mutateAsync({ id: sub.id, is_active: !sub.is_active });
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleDelete = useCallback((sub: EventSubscription) => {
    setPendingDeletes(s => new Set(s).add(sub.id));
    const handle = scheduleDelete(
      async () => {
        await deleteMutation.mutateAsync(sub.id);
        setPendingDeletes(s => { const n = new Set(s); n.delete(sub.id); return n; });
      },
      () => {
        setPendingDeletes(s => { const n = new Set(s); n.delete(sub.id); return n; });
      },
    );
    toast({
      title: t('automations.deleted'),
      action: (
        <Button size="sm" variant="ghost" onClick={() => handle.cancel()}>
          {t('automations.undo')}
        </Button>
      ),
    });
  }, [deleteMutation, t, toast]);

  const setCondition = (i: number, c: Condition) => {
    setForm(f => {
      const conditions = [...(f.conditions ?? [])];
      conditions[i] = c;
      return { ...f, conditions };
    });
  };
  const removeCondition = (i: number) => {
    setForm(f => ({ ...f, conditions: (f.conditions ?? []).filter((_, idx) => idx !== i) }));
  };
  const addCondition = () => {
    setForm(f => ({ ...f, conditions: [...(f.conditions ?? []), { field: 'payload.', op: '>', value: '' }] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('automations.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('automations.subtitle')}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('automations.newRule')}
        </Button>
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
      )}

      {!isLoading && subscriptions.length === 0 && (
        <div className="rounded-xl border border-border bg-card/70 p-12 text-center">
          <Zap className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('automations.empty')}</p>
        </div>
      )}

      <div className="space-y-2">
        {subscriptions
          .filter(s => !pendingDeletes.has(s.id))
          .map(sub => (
            <div
              key={sub.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card/70 backdrop-blur px-4 py-3"
            >
              <ActionTypeIcon type={sub.action_type} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                    {sub.event_pattern}
                  </span>
                  <span className="text-muted-foreground text-xs">→</span>
                  <Badge variant="secondary" className="text-xs capitalize">{sub.action_type}</Badge>
                  {sub.conditions && sub.conditions.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      + {sub.conditions.length} {t('automations.conditions').toLowerCase()}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub.action_ref}</p>
              </div>
              <button
                onClick={() => handleToggle(sub)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title={sub.is_active ? t('automations.active') : 'Inaktiv'}
              >
                {sub.is_active
                  ? <ToggleRight className="h-5 w-5 text-primary" />
                  : <ToggleLeft className="h-5 w-5" />
                }
              </button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(sub)}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('automations.newRule')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Event pattern */}
            <div className="space-y-1.5">
              <Label>{t('automations.eventPattern')}</Label>
              <Select value={form.event_pattern} onValueChange={v => setForm(f => ({ ...f, event_pattern: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KNOWN_EVENTS.map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                  <SelectItem value="*">* (alle hændelser)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action type */}
            <div className="space-y-1.5">
              <Label>{t('automations.actionType')}</Label>
              <RadioGroup
                value={form.action_type}
                onValueChange={v => setForm(f => ({ ...f, action_type: v as CreateSubscriptionInput['action_type'], action_ref: '' }))}
                className="flex gap-4"
              >
                {(['webhook', 'workflow', 'autopilot'] as const).map(at => (
                  <div key={at} className="flex items-center gap-2">
                    <RadioGroupItem value={at} id={`at-${at}`} />
                    <Label htmlFor={`at-${at}`} className="capitalize cursor-pointer">
                      {t(`automations.${at}`)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Action ref — conditional */}
            <div className="space-y-1.5">
              <Label>{t('automations.actionRef')}</Label>
              {form.action_type === 'webhook' && (
                <Input
                  placeholder="https://hooks.zapier.com/..."
                  value={form.action_ref}
                  onChange={e => setForm(f => ({ ...f, action_ref: e.target.value }))}
                />
              )}
              {form.action_type === 'workflow' && (
                <Select value={form.action_ref} onValueChange={v => setForm(f => ({ ...f, action_ref: v }))}>
                  <SelectTrigger><SelectValue placeholder="Vælg workflow..." /></SelectTrigger>
                  <SelectContent>
                    {(workflows as Array<{ id: string; name: string }>).map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {form.action_type === 'autopilot' && (
                <Textarea
                  placeholder="Beskriv hvad Autopilot skal gøre når denne hændelse sker..."
                  value={form.action_ref}
                  onChange={e => setForm(f => ({ ...f, action_ref: e.target.value }))}
                  rows={3}
                />
              )}
            </div>

            {/* Conditions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('automations.conditions')}</Label>
                <Button variant="ghost" size="sm" onClick={addCondition} className="h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" />
                  {t('automations.addCondition')}
                </Button>
              </div>
              {(form.conditions ?? []).map((c, i) => (
                <ConditionRow key={i} cond={c} index={i} onChange={setCondition} onRemove={removeCondition} />
              ))}
              {(form.conditions ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Ingen betingelser — reglen aktiveres på alle matchende hændelser.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending}>
              {createMutation.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
