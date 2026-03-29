import { useMemo, useState } from 'react';
import KanbanPipeline, { type KanbanColumn } from '@/components/KanbanPipeline';
import { useI18n } from '@/lib/i18n';
import { useDeals, useCreateDeal, useUpdateDeal } from '@/hooks/api/useDeals';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, Plus, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useQueryClient } from '@tanstack/react-query';

type Deal = {
  id: string;
  title: string;
  value: number;
  stage_id: string;
  notes: string | null;
  created_at: string;
};

const STAGES = [
  {
    statusKey: 'new_lead',
    label: 'Nyt lead',
    color: 'bg-blue-500',
    lightColor: 'bg-blue-50 dark:bg-blue-950/30',
    textColor: 'text-blue-700 dark:text-blue-300',
    ringColor: 'ring-blue-400/50',
    borderDash: 'border-blue-400/40',
  },
  {
    statusKey: 'contacted',
    label: 'Kontaktet',
    color: 'bg-amber-500',
    lightColor: 'bg-amber-50 dark:bg-amber-950/30',
    textColor: 'text-amber-700 dark:text-amber-300',
    ringColor: 'ring-amber-400/50',
    borderDash: 'border-amber-400/40',
  },
  {
    statusKey: 'meeting_booked',
    label: 'Møde booket',
    color: 'bg-orange-500',
    lightColor: 'bg-orange-50 dark:bg-orange-950/30',
    textColor: 'text-orange-700 dark:text-orange-300',
    ringColor: 'ring-orange-400/50',
    borderDash: 'border-orange-400/40',
  },
  {
    statusKey: 'proposal_sent',
    label: 'Tilbud sendt',
    color: 'bg-violet-500',
    lightColor: 'bg-violet-50 dark:bg-violet-950/30',
    textColor: 'text-violet-700 dark:text-violet-300',
    ringColor: 'ring-violet-400/50',
    borderDash: 'border-violet-400/40',
  },
  {
    statusKey: 'negotiation',
    label: 'Forhandling',
    color: 'bg-green-500',
    lightColor: 'bg-green-50 dark:bg-green-950/30',
    textColor: 'text-green-700 dark:text-green-300',
    ringColor: 'ring-green-400/50',
    borderDash: 'border-green-400/40',
  },
] as const;

export default function DealsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: dealsData, isLoading } = useDeals();
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();

  const deals: Deal[] = useMemo(() => {
    const raw = (dealsData as { data?: unknown[] } | undefined)?.data ?? [];
    return raw.map((d) => {
      const deal = d as Record<string, unknown>;
      return {
        id: String(deal.id ?? ''),
        title: String(deal.title ?? ''),
        value: Number(deal.value ?? 0),
        stage_id: String(deal.stage_id ?? 'new_lead'),
        notes: deal.notes != null ? String(deal.notes) : null,
        created_at: String(deal.created_at ?? ''),
      };
    }).filter(d => !['won', 'lost'].includes(d.stage_id));
  }, [dealsData]);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newStage, setNewStage] = useState<string>('new_lead');

  const handleMove = (itemId: string, _fromStage: string, toStage: string) => {
    updateDeal.mutate(
      { id: itemId, stage_id: toStage },
      {
        onError: () => toast({ title: 'Kunne ikke flytte deal', variant: 'destructive' }),
      },
    );
  };

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createDeal.mutate(
      {
        title: newTitle.trim(),
        value: parseFloat(newValue) || 0,
        stage_id: newStage,
      },
      {
        onSuccess: () => {
          toast({ title: 'Deal oprettet' });
          setShowCreate(false);
          setNewTitle('');
          setNewValue('');
          setNewStage('new_lead');
        },
        onError: (err) => {
          toast({ title: err instanceof Error ? err.message : 'Kunne ikke oprette deal', variant: 'destructive' });
        },
      },
    );
  };

  const totalValue = deals.reduce((s, d) => s + (d.value ?? 0), 0);

  const columns: KanbanColumn[] = useMemo(() => {
    return STAGES.map(stage => ({
      ...stage,
      title: stage.label,
      items: deals
        .filter(d => d.stage_id === stage.statusKey)
        .map(d => ({
          id: d.id,
          title: d.title,
          subtitle: d.value > 0 ? `${d.value.toLocaleString('da-DK')} kr` : undefined,
        })),
    }));
  }, [deals]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('crm.dealsTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {deals.length} aktive deals ·{' '}
            <span className="font-medium text-foreground">
              {totalValue.toLocaleString('da-DK')} kr
            </span>{' '}
            estimeret pipeline
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Ny deal
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ['deals'] })}
            disabled={isLoading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            {t('crm.refresh')}
          </Button>
        </div>
      </div>

      {showCreate && (
        <Card className="p-5 bg-card/70 border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Opret ny deal</div>
            <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <div className="text-xs text-muted-foreground mb-1">Titel *</div>
              <Input
                placeholder="f.eks. Nyt website til Acme"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Værdi (kr)</div>
              <Input
                type="number"
                placeholder="0"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
              />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Stage</div>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={newStage}
                onChange={e => setNewStage(e.target.value)}
              >
                {STAGES.map(s => (
                  <option key={s.statusKey} value={s.statusKey}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={createDeal.isPending || !newTitle.trim()}>
              {createDeal.isPending ? 'Opretter…' : 'Opret deal'}
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Annuller</Button>
          </div>
        </Card>
      )}

      <div className="text-xs text-muted-foreground flex items-center gap-1.5 -mb-2">
        <span>Træk et deal til en anden kolonne for at ændre stage</span>
      </div>

      <KanbanPipeline columns={columns} onMove={handleMove} />
    </div>
  );
}
