import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DataTable from '@/components/DataTable';
import StatCards from '@/components/StatCards';
import { useI18n } from '@/lib/i18n';
import { api, WorkHistoryItem, WorkHistorySummary } from '@/lib/api';

type HistoryResponse = {
  month: string;
  data: WorkHistoryItem[];
};

export default function HistoryPage() {
  const { t } = useI18n();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [summary, setSummary] = useState<WorkHistorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([api.getCompanyHistory(month), api.getCompanyHistorySummary(month)])
      .then(([history, totals]) => {
        if (!active) return;
        setData(history);
        setSummary(totals.totals);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : t('work.loadError'));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [month, t]);

  const stats = useMemo(() => {
    const totals = summary || {};
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const cards = [
      { title: t('work.stats.total'), value: String(data?.data.length ?? 0) },
      ...entries.slice(0, 3).map(([key, value]) => ({ title: key, value: String(value) })),
    ];
    return cards;
  }, [data, summary, t]);

  const rows = useMemo(
    () =>
      (data?.data ?? []).map((item) => ({
        type: item.type,
        title: item.title,
        category: item.category || '—',
        source: item.source || '—',
        status: item.status,
        completed: item.completedAt ? new Date(item.completedAt).toLocaleDateString() : '—',
      })),
    [data]
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await api.downloadCompanyHistoryCsv(month);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `company-history-${month}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('work.exportError'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('work.companyHistoryTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('work.companyHistorySubtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground" htmlFor="history-month">
              {t('work.monthLabel')}
            </label>
            <Input
              id="history-month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="w-40"
            />
          </div>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? t('common.loading') : t('work.exportCta')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : (
        <>
          <StatCards items={stats} />
          <DataTable
            columns={[
              { key: 'type', label: t('work.columns.type') },
              { key: 'title', label: t('work.columns.title') },
              { key: 'category', label: t('work.columns.category') },
              { key: 'source', label: t('work.columns.source') },
              { key: 'status', label: t('work.columns.status') },
              { key: 'completed', label: t('work.columns.completed') },
            ]}
            rows={rows}
            emptyLabel={t('work.empty')}
          />
        </>
      )}
    </div>
  );
}

