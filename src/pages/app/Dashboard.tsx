import StatCards from '@/components/StatCards';
import AIInboxPanel from '@/components/AIInboxPanel';
import { useI18n } from '@/lib/i18n';

export default function DashboardPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
      </div>
      <StatCards
        items={[
          { title: t('dashboard.statPipeline'), value: '—' },
          { title: t('dashboard.statLeads'), value: '—' },
          { title: t('dashboard.statTasks'), value: '—' },
          { title: t('dashboard.statRevenue'), value: '—' },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card/70 backdrop-blur p-6">
          <div className="text-sm font-semibold mb-4">{t('aiInbox.title')}</div>
          <AIInboxPanel items={[]} emptyLabel={t('aiInbox.empty')} />
        </div>
        <div className="rounded-2xl border border-border bg-card/70 backdrop-blur p-6">
          <div className="text-sm font-semibold mb-4">{t('work.historyTitle')}</div>
          <div className="text-sm text-muted-foreground">{t('crm.empty')}</div>
        </div>
      </div>
    </div>
  );
}




