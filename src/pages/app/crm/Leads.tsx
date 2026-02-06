import DataTable from '@/components/DataTable';
import { useI18n } from '@/lib/i18n';

type LeadRow = {
  name: string;
  status: string;
  score: string;
};

export default function LeadsPage() {
  const { t } = useI18n();
  const rows: LeadRow[] = [];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('crm.leadsTitle')}</h1>
      <DataTable
        columns={[
          { key: 'name', label: t('crm.leadsTitle') },
          { key: 'status', label: t('crm.status') },
          { key: 'score', label: t('crm.score') },
        ]}
        rows={rows}
        emptyLabel={t('crm.empty')}
      />
    </div>
  );
}

