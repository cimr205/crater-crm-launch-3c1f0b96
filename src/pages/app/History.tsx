import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import DataTable from '@/components/DataTable';
import StatCards from '@/components/StatCards';
import { useI18n } from '@/lib/i18n';
import { api, WorkHistoryItem, WorkHistoryMonth, WorkHistorySummary, WorkHistoryUser } from '@/lib/api';
import {
  UserPlus, FileText, CreditCard, Users, CheckCircle, Zap, Mail,
  Clock, TrendingUp, Activity, ChevronDown, ChevronUp,
} from 'lucide-react';

type HistoryResponse = {
  month: string;
  data: WorkHistoryItem[];
};

// ── Activity type → icon + colour ────────────────────────────────────────────

type ActivityStyle = { icon: React.ElementType; bg: string; text: string };

const ACTIVITY_STYLES: Record<string, ActivityStyle> = {
  lead:      { icon: UserPlus,     bg: 'bg-purple-500/15', text: 'text-purple-600' },
  invoice:   { icon: FileText,     bg: 'bg-green-500/15',  text: 'text-green-600' },
  payment:   { icon: CreditCard,   bg: 'bg-blue-500/15',   text: 'text-blue-600' },
  employee:  { icon: Users,        bg: 'bg-purple-500/15', text: 'text-purple-600' },
  task:      { icon: CheckCircle,  bg: 'bg-green-500/15',  text: 'text-green-600' },
  deal:      { icon: Zap,          bg: 'bg-yellow-500/15', text: 'text-yellow-600' },
  campaign:  { icon: Mail,         bg: 'bg-blue-500/15',   text: 'text-blue-600' },
  todo:      { icon: CheckCircle,  bg: 'bg-green-500/15',  text: 'text-green-600' },
};

function getStyle(type: string): ActivityStyle {
  const key = type?.toLowerCase();
  for (const k of Object.keys(ACTIVITY_STYLES)) {
    if (key?.includes(k)) return ACTIVITY_STYLES[k];
  }
  return { icon: Clock, bg: 'bg-muted', text: 'text-muted-foreground' };
}

function relativeTime(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 2) return 'Lige nu';
  if (min < 60) return `${min}m siden`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}t siden`;
  const d = Math.floor(h / 24);
  return `${d}d siden`;
}

// ── Activity timeline component ───────────────────────────────────────────────

function ActivityTimeline({ items, emptyLabel }: { items: WorkHistoryItem[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{emptyLabel}</p>;
  }
  return (
    <div className="divide-y divide-border">
      {items.map((item, idx) => {
        const style = getStyle(item.type);
        const Icon = style.icon;
        return (
          <div key={idx} className="flex items-center gap-4 py-4">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.bg}`}>
              <Icon className={`h-4 w-4 ${style.text}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium leading-tight">{item.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {[item.category, item.source].filter(Boolean).join(' — ') || item.type}
              </div>
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
              {relativeTime(item.completedAt)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Per-employee expandable card ──────────────────────────────────────────────

function EmployeeCard({ user }: { user: WorkHistoryUser }) {
  const [open, setOpen] = useState(false);

  const allEntries = Object.entries(user.totals).sort((a, b) => b[1] - a[1]);
  const topEntries = allEntries.slice(0, 3);
  const maxVal = allEntries[0]?.[1] ?? 1;

  return (
    <Card className="bg-card/70 border-border overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">{user.name || user.email}</div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {topEntries.map(([key, val]) => (
              <Badge key={key} variant="outline" className="text-xs">
                {key} <span className="ml-1 font-semibold">{val}</span>
              </Badge>
            ))}
          </div>
          <Badge variant="secondary" className="text-xs font-semibold">{user.total}</Badge>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
          <div className="text-xs text-muted-foreground font-medium mb-3">Fordeling per kategori</div>
          {allEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground">Ingen aktivitet i perioden</p>
          ) : (
            allEntries.map(([key, val]) => (
              <div key={key} className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground w-28 truncate shrink-0">{key}</div>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/60 transition-all duration-500"
                    style={{ width: `${(val / maxVal) * 100}%` }}
                  />
                </div>
                <div className="text-xs font-semibold w-6 text-right shrink-0">{val}</div>
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const { t } = useI18n();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [year, setYear] = useState(() => new Date().getFullYear().toString());
  const [tab, setTab] = useState('activitylog');
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [summary, setSummary] = useState<WorkHistorySummary | null>(null);
  const [users, setUsers] = useState<WorkHistoryUser[] | null>(null);
  const [yearData, setYearData] = useState<WorkHistoryMonth[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<string>('all');

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
    return () => { active = false; };
  }, [month, year, t]);

  // Auto-refresh every 60s when on activitylog tab
  useEffect(() => {
    if (tab !== 'activitylog') return;
    const interval = setInterval(() => {
      api.getCompanyHistory(month)
        .then((h) => setData(h))
        .catch(() => undefined);
    }, 60_000);
    return () => clearInterval(interval);
  }, [tab, month]);

  // Sorted activity items (newest first)
  const sortedItems = useMemo(() => {
    return [...(data?.data ?? [])].sort((a, b) => {
      const da = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const db = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return db - da;
    });
  }, [data]);

  // Unique types for filter dropdown
  const activityTypes = useMemo(() => {
    const set = new Set(sortedItems.map((i) => i.type).filter(Boolean));
    return Array.from(set);
  }, [sortedItems]);

  const filteredItems = useMemo(() => {
    if (activityFilter === 'all') return sortedItems;
    return sortedItems.filter((i) => i.type === activityFilter);
  }, [sortedItems, activityFilter]);

  const stats = useMemo(() => {
    const totals = summary || {};
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    return [
      { title: t('work.stats.total'), value: String(data?.data.length ?? 0) },
      ...entries.slice(0, 3).map(([key, value]) => ({ title: key, value: String(value) })),
    ];
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
      {/* Header */}
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
              onChange={(e) => setMonth(e.target.value)}
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
              onChange={(e) => setYear(e.target.value)}
              className="w-28"
            />
          </div>
          <Button onClick={handleExport} disabled={exporting} className="self-end">
            {exporting ? t('common.loading') : t('work.exportCta')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="activitylog" className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Aktivitetslog
            </TabsTrigger>
            <TabsTrigger value="employees" className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {t('work.tabs.users')}
            </TabsTrigger>
            <TabsTrigger value="company">{t('work.tabs.company')}</TabsTrigger>
            <TabsTrigger value="year">{t('work.tabs.year')}</TabsTrigger>
          </TabsList>

          {/* ── Activity Log tab ── */}
          <TabsContent value="activitylog" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Aktivitetslog</span>
                <Badge variant="secondary">{filteredItems.length}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Select value={activityFilter} onValueChange={setActivityFilter}>
                  <SelectTrigger className="w-44 text-xs h-8">
                    <SelectValue placeholder="Alle aktiviteter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle aktiviteter</SelectItem>
                    {activityTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card className="bg-card/70 border-border px-5">
              <ActivityTimeline
                items={filteredItems}
                emptyLabel={t('work.empty')}
              />
            </Card>
          </TabsContent>

          {/* ── Employees tab ── */}
          <TabsContent value="employees" className="space-y-4 mt-4">
            <StatCards
              items={[
                { title: t('work.stats.users'), value: String(users?.length ?? 0) },
                { title: t('work.stats.total'), value: String(data?.data.length ?? 0) },
              ]}
            />
            {(users ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('work.emptyUsers')}</p>
            ) : (
              <div className="space-y-3">
                {(users ?? []).map((u) => (
                  <EmployeeCard key={u.email} user={u} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Company tab ── */}
          <TabsContent value="company" className="space-y-6 mt-4">
            <StatCards items={stats} />
            <DataTable
              columns={[
                { key: 'type',      label: t('work.columns.type') },
                { key: 'title',     label: t('work.columns.title') },
                { key: 'category',  label: t('work.columns.category') },
                { key: 'source',    label: t('work.columns.source') },
                { key: 'status',    label: t('work.columns.status') },
                { key: 'completed', label: t('work.columns.completed') },
              ]}
              rows={rows}
              emptyLabel={t('work.empty')}
            />
          </TabsContent>

          {/* ── Year tab ── */}
          <TabsContent value="year" className="space-y-6 mt-4">
            <StatCards
              items={[
                {
                  title: t('work.stats.yearTotal'),
                  value: String(yearRows.reduce((sum, row) => sum + Number(row.total), 0)),
                },
              ]}
            />
            <DataTable
              columns={[
                { key: 'month',       label: t('work.columns.month') },
                { key: 'total',       label: t('work.columns.total') },
                { key: 'topCategory', label: t('work.columns.topCategory') },
              ]}
              rows={yearRows}
              emptyLabel={t('work.emptyYear')}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
