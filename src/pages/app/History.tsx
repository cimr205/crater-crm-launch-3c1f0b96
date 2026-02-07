import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DataTable from '@/components/DataTable';
import StatCards from '@/components/StatCards';
import { useI18n } from '@/lib/i18n';
import { api, WorkHistoryItem, WorkHistoryMonth, WorkHistorySummary, WorkHistoryUser } from '@/lib/api';

type HistoryResponse = {
  month: string;
  data: WorkHistoryItem[];
};

export default function HistoryPage() {
  const { t } = useI18n();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [year, setYear] = useState(() => new Date().getFullYear().toString());
  const [tab, setTab] = useState('company');
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [summary, setSummary] = useState<WorkHistorySummary | null>(null);
  const [users, setUsers] = useState<WorkHistoryUser[] | null>(null);
  const [yearData, setYearData] = useState<WorkHistoryMonth[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      api.getCompanyHistory(month),
      api.getCompanyHistorySummary(month),
      api.getCompanyHistoryByUser(month),
      api.getCompanyHistoryYear(year),
    ])
      .then(([history, totals, byUser, yearResponse]) => {
        if (!active) return;
        setData(history);
        setSummary(totals.totals);
        setUsers(byUser.users);
        setYearData(yearResponse.months);
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
  }, [month, year, t]);

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

  const userRows = useMemo(() => {
    const pickTop = (totals: WorkHistorySummary) => {
      const entry = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
      return entry ? `${entry[0]} (${entry[1]})` : '—';
    };
    return (users ?? []).map((item) => ({
      name: item.name || '—',
      email: item.email,
      total: String(item.total),
      topCategory: pickTop(item.totals),
    }));
  }, [users]);

  const yearRows = useMemo(() => {
    const pickTop = (totals: WorkHistorySummary) => {
      const entry = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
      return entry ? `${entry[0]} (${entry[1]})` : '—';
    };
    return (yearData ?? []).map((item) => ({
      month: item.month,
      total: String(item.total),
      topCategory: pickTop(item.totals),
    }));
  }, [yearData]);

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
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground" htmlFor="history-year">
              {t('work.yearLabel')}
            </label>
            <Input
              id="history-year"
              type="number"
              min="2000"
              max="2100"
              value={year}
              onChange={(event) => setYear(event.target.value)}
              className="w-28"
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
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="company">{t('work.tabs.company')}</TabsTrigger>
              <TabsTrigger value="users">{t('work.tabs.users')}</TabsTrigger>
              <TabsTrigger value="year">{t('work.tabs.year')}</TabsTrigger>
            </TabsList>

            <TabsContent value="company" className="space-y-6">
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
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <StatCards
                items={[
                  { title: t('work.stats.users'), value: String(users?.length ?? 0) },
                  { title: t('work.stats.total'), value: String(data?.data.length ?? 0) },
                ]}
              />
              <DataTable
                columns={[
                  { key: 'name', label: t('work.columns.userName') },
                  { key: 'email', label: t('work.columns.email') },
                  { key: 'total', label: t('work.columns.total') },
                  { key: 'topCategory', label: t('work.columns.topCategory') },
                ]}
                rows={userRows}
                emptyLabel={t('work.emptyUsers')}
              />
            </TabsContent>

            <TabsContent value="year" className="space-y-6">
              <StatCards
                items={[
                  { title: t('work.stats.yearTotal'), value: String(yearRows.reduce((sum, row) => sum + Number(row.total), 0)) },
                ]}
              />
              <DataTable
                columns={[
                  { key: 'month', label: t('work.columns.month') },
                  { key: 'total', label: t('work.columns.total') },
                  { key: 'topCategory', label: t('work.columns.topCategory') },
                ]}
                rows={yearRows}
                emptyLabel={t('work.emptyYear')}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

