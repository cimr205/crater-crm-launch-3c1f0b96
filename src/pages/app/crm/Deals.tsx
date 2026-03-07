import { useCallback, useEffect, useMemo, useState } from 'react';
import KanbanPipeline from '@/components/KanbanPipeline';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

type Lead = {
  id: string;
  name: string;
  company?: string;
  status: string;
  leadScore: number;
};

const COLUMN_STATUSES = ['cold', 'contacted', 'qualified', 'customer'];

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
      toast({ title: err instanceof Error ? err.message : 'Could not load pipeline', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const columns = useMemo(() => {
    const titles = [
      t('crm.pipelineNew'),
      t('crm.pipelineContacted'),
      t('crm.pipelineProposal'),
      t('crm.pipelineNegotiation'),
    ];
    return COLUMN_STATUSES.map((status, i) => ({
      title: titles[i],
      items: leads
        .filter((lead) => lead.status === status)
        .map((lead) => ({
          id: lead.id,
          title: lead.name,
          value: lead.company ? `${lead.company} · Score: ${lead.leadScore}` : `Score: ${lead.leadScore}`,
        })),
    }));
  }, [leads, t]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('crm.dealsTitle')}</h1>
        <Button variant="outline" size="sm" onClick={() => loadLeads()} disabled={loading}>
          {t('crm.refresh')}
        </Button>
      </div>
      <KanbanPipeline columns={columns} />
    </div>
  );
}
