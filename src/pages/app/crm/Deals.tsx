import KanbanPipeline from '@/components/KanbanPipeline';
import { useI18n } from '@/lib/i18n';

export default function DealsPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('crm.dealsTitle')}</h1>
      <KanbanPipeline
        columns={[
          { title: t('crm.pipelineNew'), items: [] },
          { title: t('crm.pipelineContacted'), items: [] },
          { title: t('crm.pipelineProposal'), items: [] },
          { title: t('crm.pipelineNegotiation'), items: [] },
        ]}
      />
    </div>
  );
}

