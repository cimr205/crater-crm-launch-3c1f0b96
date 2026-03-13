import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api, type InvoiceStats } from '@/lib/api';
import { isLocale, useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp, Users, FileText, CreditCard, AlertCircle,
  Plus, ArrowRight, Flame, RefreshCw, Zap, CheckSquare, Mail,
  BarChart2, ListTodo, Clock, Target, AlertTriangle, ChevronRight,
  Bell, Edit2, Check, X,
} from 'lucide-react';

function fmt(n: number) { return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fmtAmount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return fmt(n);
}

function useCountUp(target: number, duration = 950): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return;
    let startTs: number | null = null;
    const tick = (ts: number) => {
      if (!startTs) startTs = ts;
      const p = Math.min((ts - startTs) / duration, 1);
      const ease = 1 - (1 - p) ** 3;
      setVal(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return val;
}

const S_COLOR: Record<string, string> = {
  cold: 'bg-blue-500', contacted: 'bg-yellow-400', qualified: 'bg-green-500',
  customer: 'bg-purple-500', lost: 'bg-red-400',
};

interface LeadRow { id: string; name: string; email?: string; company?: string; status: string; leadScore: number; source?: string; createdAt: string; }

function PipelineBar({ leads }: { leads: LeadRow[] }) {
  const { t } = useI18n();
  const stages = ['cold', 'contacted', 'qualified', 'customer'];
  const counts = stages.map(s => leads.filter(l => l.status === s).length);
  const max = Math.max(...counts, 1);
  const colors = ['bg-blue-400', 'bg-yellow-400', 'bg-green-400', 'bg-purple-500'];
  const labels = [
    t('dashboard.statusCold'),
    t('dashboard.statusContacted'),
    t('dashboard.statusQualifiedShort'),
    t('dashboard.statusCustomer'),
  ];
  return (
    <div className="flex gap-2 items-end h-14">
      {stages.map((_, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs font-bold">{counts[i]}</span>
          <div className={`w-full rounded-sm ${colors[i]} transition-all duration-500`} style={{ height: `${Math.max(4, (counts[i] / max) * 32)}px` }} />
          <span className="text-xs text-muted-foreground truncate w-full text-center">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ icon, label, value, sub, color, onClick, rawValue, suffix }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  color: string; onClick?: () => void; rawValue?: number; suffix?: string;
}) {
  const animated = useCountUp(rawValue ?? 0);
  const display = rawValue !== undefined
    ? fmtAmount(animated) + (suffix ?? '')
    : value;
  return (
    <button className="rounded-2xl border bg-card p-5 text-left w-full transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 cursor-pointer" onClick={onClick}>
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${color} mb-3`}>{icon}</div>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold mt-0.5 tabular-nums">{display}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </button>
  );
}

function MonthlyGoalCard({ paymentTotal, onClick }: { paymentTotal: number | null; onClick: () => void }) {
  const { t } = useI18n();
  const [goal, setGoal] = useState<number>(() => {
    const s = localStorage.getItem('monthly_goal');
    return s ? parseInt(s, 10) : 0;
  });
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setInput(goal > 0 ? String(goal) : '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const save = () => {
    const val = parseInt(input.replace(/\D/g, ''), 10);
    if (!isNaN(val) && val > 0) {
      localStorage.setItem('monthly_goal', String(val));
      setGoal(val);
    }
    setEditing(false);
  };

  const current = paymentTotal ?? 0;
  const progress = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  const progressColor = progress >= 100 ? 'bg-green-500' : progress >= 70 ? 'bg-blue-500' : progress >= 40 ? 'bg-yellow-500' : 'bg-orange-500';

  return (
    <button
      className="rounded-2xl border bg-card p-5 text-left w-full transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 cursor-pointer relative group"
      onClick={goal === 0 ? startEdit : onClick}
    >
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 mb-3">
        <Target className="h-5 w-5 text-white" />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t('dashboard.monthlyGoal')}</p>
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
          onClick={e => { e.stopPropagation(); startEdit(); }}
        >
          <Edit2 className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
      {editing ? (
        <div className="flex items-center gap-2 mt-1" onClick={e => e.stopPropagation()}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            placeholder="50000"
            className="flex-1 text-xl font-bold bg-transparent border-b border-primary outline-none tabular-nums w-24"
          />
          <span className="text-sm text-muted-foreground">kr</span>
          <button onClick={save} className="p-1 rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></button>
          <button onClick={() => setEditing(false)} className="p-1 rounded-full bg-muted"><X className="h-3 w-3" /></button>
        </div>
      ) : (
        <p className="text-3xl font-bold mt-0.5 tabular-nums">
          {goal > 0 ? `${fmtAmount(current)} kr` : <span className="text-lg text-muted-foreground">{t('dashboard.setGoal')}</span>}
        </p>
      )}
      {goal > 0 && !editing && (
        <>
          <p className="text-xs text-muted-foreground mt-1">{t('dashboard.goalOf')} {fmtAmount(goal)} kr {t('dashboard.goalKrTarget')}</p>
          <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${progressColor}`} style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs font-semibold mt-1.5" style={{ color: progress >= 100 ? 'rgb(34 197 94)' : undefined }}>
            {progress >= 100 ? t('dashboard.goalReached') : `${Math.round(progress)}${t('dashboard.goalPercent')}`}
          </p>
        </>
      )}
    </button>
  );
}

interface OverblikItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
  color: string;
  bg: string;
  border: string;
  action: () => void;
}

function DagensOverblik({ items }: { items: OverblikItem[] }) {
  const { t } = useI18n();
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
          <Bell className="h-4 w-4 text-primary-foreground" />
        </div>
        <h3 className="font-semibold text-sm">{t('dashboard.todayOverview')}</h3>
        <Badge variant="secondary" className="ml-auto">{items.length} {t('dashboard.actions')}</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(item => (
          <button
            key={item.key}
            onClick={item.action}
            className={`flex items-center gap-3 rounded-xl ${item.bg} border ${item.border} px-4 py-3 text-left hover:opacity-90 transition-opacity`}
          >
            <div className={`shrink-0 ${item.color}`}>{item.icon}</div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${item.color}`}>{item.label}</p>
              <p className={`text-xs opacity-70 ${item.color}`}>{item.sub}</p>
            </div>
            <ChevronRight className={`h-4 w-4 shrink-0 ${item.color} opacity-60`} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const { user } = useAuth();
  const { t } = useI18n();

  const [totals, setTotals] = useState<{ leads: number; leads_today: number; active_clowdbot_jobs: number } | null>(null);
  const [recent, setRecent] = useState<LeadRow[]>([]);
  const [invoiceStats, setInvoiceStats] = useState<InvoiceStats | null>(null);
  const [paymentTotal, setPaymentTotal] = useState<number | null>(null);
  const [dailyFocus, setDailyFocus] = useState<Array<Record<string, unknown>>>([]);
  const [focusLoading, setFocusLoading] = useState(false);
  const [openTasks, setOpenTasks] = useState<Array<Record<string, unknown>>>([]);
  const [pendingTodos, setPendingTodos] = useState<Array<Record<string, unknown>>>([]);
  const [metaConnected, setMetaConnected] = useState(false);
  const [metaCampaigns, setMetaCampaigns] = useState<Array<{ spend: number; leads: number; ctr: number }>>([]);
  const [staleLeads, setStaleLeads] = useState<LeadRow[]>([]);

  const go = (path: string) => navigate(`/${locale}${path}`);

  const loadAll = useCallback(() => {
    let active = true;
    api.getLeadDashboard().then(d => { if (active) { setTotals(d.totals); setRecent(d.recent || []); } }).catch(() => undefined);
    api.getDailyFocus().then(d => { if (active) setDailyFocus(d.data?.json || []); }).catch(() => undefined);
    api.getInvoiceStats().then(d => { if (active) setInvoiceStats(d); }).catch(() => undefined);
    api.getPaymentStats().then(d => { if (active) setPaymentTotal(d.total); }).catch(() => undefined);
    api.listTasks({ status: 'open' })
      .then(d => { if (active) setOpenTasks((d as { data?: unknown[]; tasks?: unknown[] }).data ?? (d as { tasks?: unknown[] }).tasks ?? []); })
      .catch(() => undefined);
    api.listTodos({ status: 'pending' })
      .then(d => { if (active) setPendingTodos((d as { data?: unknown[]; todos?: unknown[] }).data ?? (d as { todos?: unknown[] }).todos ?? []); })
      .catch(() => undefined);
    api.listLeads().then(d => {
      if (!active) return;
      const now = Date.now();
      const stale = (d.data as LeadRow[]).filter(l => {
        if (!['cold', 'contacted'].includes(l.status)) return false;
        const daysSince = (now - new Date(l.createdAt).getTime()) / 86400000;
        return daysSince >= 5;
      });
      setStaleLeads(stale);
    }).catch(() => undefined);
    api.getMetaStatus()
      .then(d => {
        if (!active) return;
        setMetaConnected(d.connected);
        if (d.connected) {
          api.getMetaCampaigns()
            .then(c => { if (active) setMetaCampaigns((c as { data?: Array<{ spend: number; leads: number; ctr: number }> }).data ?? []); })
            .catch(() => undefined);
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const cleanup = loadAll();
    const interval = setInterval(() => loadAll(), 30_000);
    return () => { cleanup?.(); clearInterval(interval); };
  }, [loadAll]);

  const refreshFocus = async () => {
    setFocusLoading(true);
    try { const d = await api.refreshDailyFocus(); setDailyFocus(d.data?.json || []); }
    finally { setFocusLoading(false); }
  };

  const metaTotalSpend = metaCampaigns.reduce((s, c) => s + c.spend, 0);
  const metaTotalLeads = metaCampaigns.reduce((s, c) => s + c.leads, 0);
  const metaAvgCtr = metaCampaigns.length
    ? metaCampaigns.reduce((s, c) => s + c.ctr, 0) / metaCampaigns.length
    : 0;

  const hotLeads = recent.filter(l => l.leadScore >= 50).sort((a, b) => b.leadScore - a.leadScore).slice(0, 4);
  const hasOverdue = (invoiceStats?.overdue ?? 0) > 0;
  const pipelineLeads = recent.filter(l => l.status !== 'lost');
  const pipelineValue = pipelineLeads.reduce((s, l) => s + l.leadScore * 1000, 0);

  const dateLocale = locale === 'da' ? 'da-DK' : locale === 'de' ? 'de-DE' : 'en-GB';
  const today = new Date().toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' });

  const h = new Date().getHours();
  const greeting = h < 12 ? t('dashboard.greetMorning') : h < 18 ? t('dashboard.greetAfternoon') : t('dashboard.greetEvening');
  const greetName = user?.full_name ? `${greeting}, ${user.full_name.split(' ')[0]}` : greeting;

  const sLabel: Record<string, string> = {
    cold: t('dashboard.statusCold'),
    contacted: t('dashboard.statusContacted'),
    qualified: t('dashboard.statusQualified'),
    customer: t('dashboard.statusCustomer'),
    lost: t('dashboard.statusLost'),
  };

  const overblikItems: OverblikItem[] = [
    ...(hasOverdue ? [{
      key: 'overdue',
      icon: <AlertCircle className="h-5 w-5" />,
      label: `${invoiceStats!.overdue} ${t('dashboard.overdueInvoicesSuffix')}`,
      sub: t('dashboard.requiresAction'),
      color: 'text-red-700 dark:text-red-300',
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      action: () => go('/app/finance/invoices'),
    }] : []),
    ...(staleLeads.length > 0 ? [{
      key: 'stale',
      icon: <AlertTriangle className="h-5 w-5" />,
      label: `${staleLeads.length} ${t('dashboard.leadFollowupSuffix')}`,
      sub: t('dashboard.notContactedDays'),
      color: 'text-orange-700 dark:text-orange-300',
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      border: 'border-orange-200 dark:border-orange-800',
      action: () => go('/app/crm/leads'),
    }] : []),
    ...(openTasks.length > 0 ? [{
      key: 'tasks',
      icon: <CheckSquare className="h-5 w-5" />,
      label: `${openTasks.length} ${t('dashboard.openTasksSuffix')}`,
      sub: t('dashboard.awaitingCompletion'),
      color: 'text-blue-700 dark:text-blue-300',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      action: () => go('/app/tasks'),
    }] : []),
    ...(pendingTodos.length > 0 ? [{
      key: 'todos',
      icon: <ListTodo className="h-5 w-5" />,
      label: `${pendingTodos.length} ${t('dashboard.pendingTodosSuffix')}`,
      sub: t('dashboard.onYourList'),
      color: 'text-violet-700 dark:text-violet-300',
      bg: 'bg-violet-50 dark:bg-violet-900/20',
      border: 'border-violet-200 dark:border-violet-800',
      action: () => go('/app/todos'),
    }] : []),
  ];

  const quickLinks = [
    { icon: <Mail className="h-4 w-4" />, label: t('nav.inbox'), path: '/app/inbox' },
    { icon: <FileText className="h-4 w-4" />, label: t('nav.invoices'), path: '/app/finance/invoices' },
    { icon: <Zap className="h-4 w-4" />, label: t('nav.workflows'), path: '/app/workflows' },
    { icon: <BarChart2 className="h-4 w-4" />, label: t('nav.metaAds'), path: '/app/meta/ads' },
  ];

  return (
    <div className="space-y-6">
      {/* Today's overview */}
      <DagensOverblik items={overblikItems} />

      {/* Greeting */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{greetName}</h1>
          <p className="text-sm text-muted-foreground capitalize mt-0.5">{today}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => go('/app/crm/leads')}><Plus className="h-3.5 w-3.5 mr-1" />Lead</Button>
          <Button size="sm" variant="outline" onClick={() => go('/app/finance/invoices')}><Plus className="h-3.5 w-3.5 mr-1" />{t('dashboard.btnAddInvoice')}</Button>
          <Button size="sm" onClick={() => go('/app/todos')}><Plus className="h-3.5 w-3.5 mr-1" />{t('dashboard.btnAddTodo')}</Button>
        </div>
      </div>

      {/* Stat cards + Monthly Goal */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<Users className="h-5 w-5 text-white" />} color="bg-blue-500"
          label={t('dashboard.statLeadsTotal')} value={totals ? fmt(totals.leads) : '—'} rawValue={totals?.leads}
          sub={totals ? `+${totals.leads_today} ${t('dashboard.statLeadsTodaySuffix')}` : undefined}
          onClick={() => go('/app/crm/leads')}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-white" />} color="bg-violet-500"
          label={t('dashboard.statPipeline')} value={`${fmtAmount(pipelineValue)} kr`} rawValue={pipelineValue} suffix=" kr"
          sub={`${pipelineLeads.length} ${t('dashboard.statPipelineActiveSuffix')}`}
          onClick={() => go('/app/crm/deals')}
        />
        <StatCard
          icon={<FileText className="h-5 w-5 text-white" />} color="bg-amber-500"
          label={t('dashboard.statInvoicesSent')} value={invoiceStats ? fmt(invoiceStats.sent) : '—'} rawValue={invoiceStats?.sent}
          sub={invoiceStats ? `${fmtAmount(invoiceStats.total_sent_amount)} ${t('dashboard.statInvoicesOutstandingSuffix')}` : undefined}
          onClick={() => go('/app/finance/invoices')}
        />
        <StatCard
          icon={<CreditCard className="h-5 w-5 text-white" />} color="bg-green-500"
          label={t('dashboard.statPaymentReceived')} value={paymentTotal !== null ? `${fmtAmount(paymentTotal)} kr` : '—'} rawValue={paymentTotal ?? undefined} suffix=" kr"
          sub={invoiceStats ? `${invoiceStats.paid} ${t('dashboard.statInvoicesPaidSuffix')}` : undefined}
          onClick={() => go('/app/finance/payments')}
        />
        <div className="col-span-2 lg:col-span-1">
          <MonthlyGoalCard paymentTotal={paymentTotal} onClick={() => go('/app/finance/payments')} />
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Hot leads + pipeline */}
        <div className="lg:col-span-2 rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <h3 className="font-semibold text-sm">{t('dashboard.hotLeads')}</h3>
              {staleLeads.length > 0 && (
                <Badge variant="destructive" className="text-xs ml-1">
                  {staleLeads.length} {t('dashboard.hotLeadsNeedFollowup')}
                </Badge>
              )}
            </div>
            <button onClick={() => go('/app/crm/leads')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              {t('dashboard.seeAll')} <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {hotLeads.length > 0 ? (
            <div className="space-y-1">
              {hotLeads.map(lead => {
                const isStale = staleLeads.some(s => s.id === lead.id);
                return (
                  <div key={lead.id} className={`flex items-center gap-3 rounded-lg hover:bg-muted/50 px-3 py-2.5 -mx-3 transition-colors cursor-pointer ${isStale ? 'border-l-2 border-orange-400 pl-2' : ''}`} onClick={() => go('/app/crm/leads')}>
                    <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${S_COLOR[lead.status] || 'bg-muted'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{lead.name}</p>
                        {isStale && <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{lead.company || lead.email || '—'}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className={`h-1.5 w-3.5 rounded-full ${i <= Math.ceil(lead.leadScore / 20) ? 'bg-orange-400' : 'bg-muted'}`} />
                      ))}
                      <span className="text-xs font-bold tabular-nums w-5 text-right">{lead.leadScore}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-20 gap-2 text-muted-foreground">
              <p className="text-sm">{t('dashboard.noHotLeads')}</p>
              <Button size="sm" variant="outline" onClick={() => go('/app/crm/leads')}><Plus className="h-3 w-3 mr-1" />{t('crm.addLead')}</Button>
            </div>
          )}
          {recent.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">{t('dashboard.pipelineDistribution')}</p>
              <PipelineBar leads={recent} />
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* AI Focus */}
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <h3 className="font-semibold text-sm">{t('dashboard.aiFocusTitle')}</h3>
              </div>
              <button className={`text-muted-foreground hover:text-foreground transition-colors ${focusLoading ? 'animate-spin' : ''}`} onClick={refreshFocus} disabled={focusLoading}>
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            {dailyFocus.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('dashboard.aiFocusEmpty')}</p>
            ) : (
              <div className="space-y-2">
                {dailyFocus.slice(0, 3).map((item, i) => (
                  <div key={i} className="rounded-lg bg-muted/50 p-3">
                    <p className="text-sm font-medium leading-tight">{String(item.title || '')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{String(item.description || '')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Open tasks */}
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-blue-500" />
                <h3 className="font-semibold text-sm">{t('dashboard.openTasksTitle')}</h3>
              </div>
              <button onClick={() => go('/app/tasks')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                {t('dashboard.seeAll')} <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {openTasks.length === 0 ? (
              <div className="text-center py-3 space-y-2">
                <p className="text-xs text-muted-foreground">{t('dashboard.noOpenTasks')}</p>
                <Button size="sm" variant="outline" onClick={() => go('/app/tasks')}>
                  <Plus className="h-3 w-3 mr-1" />{t('dashboard.createTaskBtn')}
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {openTasks.slice(0, 4).map((task, i) => (
                  <button
                    key={i}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors text-left"
                    onClick={() => go('/app/tasks')}
                  >
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs truncate flex-1">{String((task as Record<string, unknown>).title ?? (task as Record<string, unknown>).name ?? t('dashboard.taskFallback'))}</span>
                    {(task as Record<string, unknown>).status && (
                      <Badge variant="outline" className="text-xs shrink-0">{String((task as Record<string, unknown>).status)}</Badge>
                    )}
                  </button>
                ))}
                {openTasks.length > 4 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">+{openTasks.length - 4} {t('dashboard.moreItems')}</p>
                )}
              </div>
            )}
          </div>

          {/* Pending todos */}
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-purple-500" />
                <h3 className="font-semibold text-sm">{t('dashboard.todosTitle')}</h3>
                {pendingTodos.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{pendingTodos.length}</Badge>
                )}
              </div>
              <button onClick={() => go('/app/todos')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                {t('dashboard.seeAll')} <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {pendingTodos.length === 0 ? (
              <div className="text-center py-3 space-y-2">
                <p className="text-xs text-muted-foreground">{t('dashboard.noPendingTodos')}</p>
                <Button size="sm" variant="outline" onClick={() => go('/app/todos')}>
                  <Plus className="h-3 w-3 mr-1" />{t('dashboard.addTodoBtn')}
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {pendingTodos.slice(0, 4).map((todo, i) => (
                  <button
                    key={i}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors text-left"
                    onClick={() => go('/app/todos')}
                  >
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/40 shrink-0" />
                    <span className="text-xs truncate">{String((todo as Record<string, unknown>).title ?? (todo as Record<string, unknown>).name ?? 'To-do')}</span>
                  </button>
                ))}
                {pendingTodos.length > 4 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">+{pendingTodos.length - 4} {t('dashboard.moreItems')}</p>
                )}
              </div>
            )}
          </div>

          {/* Meta Ads quick snapshot */}
          {metaConnected && (
            <div className="rounded-2xl border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-blue-500" />
                  <h3 className="font-semibold text-sm">{t('dashboard.metaAdsTitle')}</h3>
                </div>
                <button onClick={() => go('/app/meta/ads')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  {t('dashboard.metaAdsDetails')} <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 p-2">
                  <div className="text-lg font-bold">DKK {metaTotalSpend >= 1000 ? `${(metaTotalSpend/1000).toFixed(0)}k` : metaTotalSpend.toFixed(0)}</div>
                  <div className="text-xs text-muted-foreground">Spend</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <div className="text-lg font-bold">{metaTotalLeads}</div>
                  <div className="text-xs text-muted-foreground">Leads</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <div className="text-lg font-bold">{metaAvgCtr.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">CTR</div>
                </div>
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="rounded-2xl border bg-card p-5">
            <h3 className="font-semibold text-sm mb-3">{t('dashboard.shortcuts')}</h3>
            <div className="space-y-0.5">
              {quickLinks.map(link => (
                <button key={link.path} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left text-sm" onClick={() => go(link.path)}>
                  <span className="text-muted-foreground">{link.icon}</span>
                  {link.label}
                  <ArrowRight className="h-3 w-3 text-muted-foreground ml-auto" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent leads table */}
      {recent.length > 0 && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h3 className="font-semibold text-sm">{t('dashboard.recentLeads')}</h3>
            <button onClick={() => go('/app/crm/leads')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              {t('dashboard.allLeads')} <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y">
            {recent.slice(0, 5).map(lead => {
              const isStale = staleLeads.some(s => s.id === lead.id);
              return (
                <div key={lead.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => go('/app/crm/leads')}>
                  <div className={`h-2 w-2 rounded-full shrink-0 ${S_COLOR[lead.status] || 'bg-muted'}`} />
                  <span className="flex-1 text-sm font-medium truncate">{lead.name}</span>
                  <span className="text-sm text-muted-foreground hidden md:block truncate max-w-[150px]">{lead.company || lead.email || '—'}</span>
                  {isStale && <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" title={t('dashboard.hotLeadsNeedFollowup')} />}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{sLabel[lead.status] || lead.status}</span>
                  <span className="text-xs font-bold tabular-nums w-6 text-right shrink-0">{lead.leadScore}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
