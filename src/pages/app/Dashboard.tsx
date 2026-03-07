import { useEffect, useState } from 'react';
import StatCards from '@/components/StatCards';
import AIInboxPanel from '@/components/AIInboxPanel';
import { useI18n, isLocale } from '@/lib/i18n';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

export default function DashboardPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const navigate = useNavigate();
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const [totals, setTotals] = useState<null | { leads: number; leads_today: number; active_clowdbot_jobs: number }>(
    null
  );
  const [recent, setRecent] = useState<
    Array<{ id: string; name: string; email?: string; company?: string; status: string; source?: string; createdAt: string }>
  >([]);
  const [activity, setActivity] = useState<Array<{ id: string; message: string; type: string; createdAt: string }>>([]);
  const [dailyFocus, setDailyFocus] = useState<Array<Record<string, unknown>>>([]);
  const [focusLoading, setFocusLoading] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .getLeadDashboard()
      .then((data) => {
        if (!active) return;
        setTotals(data.totals);
        setRecent(data.recent || []);
      })
      .catch((err: unknown) => {
        if (!active) return;
        toast({ title: err instanceof Error ? err.message : 'Could not load dashboard', variant: 'destructive' });
      });
    api
      .getAiActivity()
      .then((data) => {
        if (!active) return;
        setActivity(data.data || []);
      })
      .catch(() => undefined);
    api
      .getDailyFocus()
      .then((data) => {
        if (!active) return;
        setDailyFocus(data.data?.json || []);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const refreshFocus = async () => {
    setFocusLoading(true);
    try {
      const data = await api.refreshDailyFocus();
      setDailyFocus(data.data?.json || []);
    } finally {
      setFocusLoading(false);
    }
  };

  const handleFocusAction = (item: Record<string, unknown>) => {
    const action = String(item.action || '');
    if (action.includes('lead')) navigate(`/${locale}/app/crm/leads`);
    if (action.includes('workflow')) navigate(`/${locale}/app/workflows`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
      </div>
      <StatCards
        items={[
          { title: t('dashboard.statPipeline'), value: '—' },
          { title: t('dashboard.statLeads'), value: totals ? String(totals.leads) : '—' },
          { title: t('dashboard.statLeadsToday'), value: totals ? String(totals.leads_today) : '—' },
          { title: t('dashboard.statActiveJobs'), value: totals ? String(totals.active_clowdbot_jobs) : '—' },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-3 rounded-2xl border border-border bg-card/70 backdrop-blur p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold">AI Focus Today</div>
            <Button size="sm" variant="outline" onClick={refreshFocus} disabled={focusLoading}>
              Refresh AI focus
            </Button>
          </div>
          {dailyFocus.length === 0 ? (
            <div className="text-sm text-muted-foreground">No AI focus yet.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {dailyFocus.map((item, index) => (
                <div key={index} className="rounded-lg border border-border p-3">
                  <div className="text-sm font-medium">{String(item.title || 'Priority')}</div>
                  <div className="text-xs text-muted-foreground">{String(item.description || '')}</div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleFocusAction(item)}>
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card/70 backdrop-blur p-6">
          <div className="text-sm font-semibold mb-4">{t('aiInbox.title')}</div>
          <AIInboxPanel items={[]} emptyLabel={t('aiInbox.empty')} />
        </div>
        <div className="rounded-2xl border border-border bg-card/70 backdrop-blur p-6">
          <div className="text-sm font-semibold mb-4">Live leads</div>
          {recent.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t('crm.empty')}</div>
          ) : (
            <div className="space-y-3">
              {recent.slice(0, 5).map((lead) => (
                <div key={lead.id} className="rounded-lg border border-border p-3">
                  <div className="text-sm font-medium">{lead.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {lead.company || lead.email || '—'} · {lead.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card/70 backdrop-blur p-6 lg:col-span-3">
          <div className="text-sm font-semibold mb-4">AI activity</div>
          {activity.length === 0 ? (
            <div className="text-sm text-muted-foreground">No AI activity yet.</div>
          ) : (
            <div className="grid gap-2">
              {activity.slice(0, 6).map((item) => (
                <div key={item.id} className="text-sm text-muted-foreground">
                  {item.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}




