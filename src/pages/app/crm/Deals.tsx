import { useCallback, useEffect, useMemo, useState } from 'react';
import KanbanPipeline, { type KanbanColumn } from '@/components/KanbanPipeline';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw } from 'lucide-react';

type Lead = {
  id: string;
  name: string;
  company?: string;
  email?: string;
  status: string;
  leadScore: number;
  source?: string;
};

const STAGES = [
  {
    statusKey: 'cold',
    color: 'bg-blue-500',
    lightColor: 'bg-blue-50 dark:bg-blue-950/30',
    textColor: 'text-blue-700 dark:text-blue-300',
    ringColor: 'ring-blue-400/50',
    borderDash: 'border-blue-400/40',
  },
  {
    statusKey: 'contacted',
    color: 'bg-amber-500',
    lightColor: 'bg-amber-50 dark:bg-amber-950/30',
    textColor: 'text-amber-700 dark:text-amber-300',
    ringColor: 'ring-amber-400/50',
    borderDash: 'border-amber-400/40',
  },
  {
    statusKey: 'qualified',
    color: 'bg-green-500',
    lightColor: 'bg-green-50 dark:bg-green-950/30',
    textColor: 'text-green-700 dark:text-green-300',
    ringColor: 'ring-green-400/50',
    borderDash: 'border-green-400/40',
  },
  {
    statusKey: 'customer',
    color: 'bg-purple-500',
    lightColor: 'bg-purple-50 dark:bg-purple-950/30',
    textColor: 'text-purple-700 dark:text-purple-300',
    ringColor: 'ring-purple-400/50',
    borderDash: 'border-purple-400/40',
  },
] as const;

export default function DealsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listLeads();
      setLeads(result.data as Lead[]);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Kunne ikke hente pipeline', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void loadLeads(); }, [loadLeads]);

  const handleMove = async (itemId: string, fromStatus: string, toStatus: string) => {
    // Optimistic: update locally immediately
    setLeads(prev => prev.map(l => l.id === itemId ? { ...l, status: toStatus } : l));
    try {
      await api.updateLead(itemId, { status: toStatus });
    } catch (err) {
      // Revert on failure
      setLeads(prev => prev.map(l => l.id === itemId ? { ...l, status: fromStatus } : l));
      toast({ title: err instanceof Error ? err.message : 'Kunne ikke flytte lead', variant: 'destructive' });
    }
  };

  const stageTitles = [
    t('crm.pipelineNew'),
    t('crm.pipelineContacted'),
    t('crm.pipelineProposal'),
    t('crm.pipelineNegotiation'),
  ];

  const pipelineLeads = leads.filter(l => l.status !== 'lost');
  const pipelineValue = pipelineLeads.reduce((s, l) => s + l.leadScore * 1000, 0);

  const columns: KanbanColumn[] = useMemo(() => {
    return STAGES.map((stage, i) => ({
      ...stage,
      title: stageTitles[i],
      items: leads
        .filter(l => l.status === stage.statusKey)
        .map(l => ({
          id: l.id,
          title: l.name,
          subtitle: l.company || l.email,
          score: l.leadScore,
          tag: l.source || undefined,
        })),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('crm.dealsTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pipelineLeads.length} aktive leads ·{' '}
            <span className="font-medium text-foreground">
              {pipelineValue.toLocaleString('da-DK')} kr
            </span>{' '}
            estimeret pipeline
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadLeads()} disabled={loading} className="gap-2 shrink-0">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {t('crm.refresh')}
        </Button>
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-1.5 -mb-2">
        <span>Træk et lead til en anden kolonne for at ændre status</span>
      </div>

      <KanbanPipeline columns={columns} onMove={handleMove} />
    </div>
  );
}
