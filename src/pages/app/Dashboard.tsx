import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api, type InvoiceStats } from '@/lib/api';
import { isLocale } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, Users, FileText, CreditCard, AlertCircle,
  Plus, ArrowRight, Flame, RefreshCw, Zap, CheckSquare, Mail
} from 'lucide-react';

function fmt(n: number) { return n.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
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
      const ease = 1 - (1 - p) ** 3; // cubic ease-out
      setVal(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return val;
}
function greet(name?: string | null) {
  const h = new Date().getHours();
  const g = h < 12 ? 'God morgen' : h < 18 ? 'God eftermiddag' : 'God aften';
  return name ? `${g}, ${name.split(' ')[0]}` : g;
}
const S_COLOR: Record<string, string> = { cold: 'bg-blue-500', contacted: 'bg-yellow-400', qualified: 'bg-green-500', customer: 'bg-purple-500', lost: 'bg-red-400' };
const S_LABEL: Record<string, string> = { cold: 'Kold', contacted: 'Kontaktet', qualified: 'Kvalificeret', customer: 'Kunde', lost: 'Tabt' };

interface LeadRow { id: string; name: string; email?: string; company?: string; status: string; leadScore: number; source?: string; createdAt: string; }

function PipelineBar({ leads }: { leads: LeadRow[] }) {
  const stages = ['cold', 'contacted', 'qualified', 'customer'];
  const counts = stages.map(s => leads.filter(l => l.status === s).length);
  const max = Math.max(...counts, 1);
  const colors = ['bg-blue-400', 'bg-yellow-400', 'bg-green-400', 'bg-purple-500'];
  const labels = ['Kold', 'Kontaktet', 'Kvalif.', 'Kunde'];
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

export default function DashboardPage() {
  const navigate = useNavigate();
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const { user } = useAuth();

  const [totals, setTotals] = useState<{ leads: number; leads_today: number; active_clowdbot_jobs: number } | null>(null);
  const [recent, setRecent] = useState<LeadRow[]>([]);
  const [invoiceStats, setInvoiceStats] = useState<InvoiceStats | null>(null);
  const [paymentTotal, setPaymentTotal] = useState<number | null>(null);
  const [dailyFocus, setDailyFocus] = useState<Array<Record<string, unknown>>>([]);
  const [focusLoading, setFocusLoading] = useState(false);

  const go = (path: string) => navigate(`/${locale}${path}`);

  useEffect(() => {
    let active = true;
    api.getLeadDashboard().then(d => { if (active) { setTotals(d.totals); setRecent(d.recent || []); } }).catch(() => undefined);
    api.getDailyFocus().then(d => { if (active) setDailyFocus(d.data?.json || []); }).catch(() => undefined);
    api.getInvoiceStats().then(d => { if (active) setInvoiceStats(d); }).catch(() => undefined);
    api.getPaymentStats().then(d => { if (active) setPaymentTotal(d.total); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const refreshFocus = async () => {
    setFocusLoading(true);
    try { const d = await api.refreshDailyFocus(); setDailyFocus(d.data?.json || []); }
    finally { setFocusLoading(false); }
  };

  const hotLeads = recent.filter(l => l.leadScore >= 50).sort((a, b) => b.leadScore - a.leadScore).slice(0, 4);
  const hasOverdue = (invoiceStats?.overdue ?? 0) > 0;
  const pipelineLeads = recent.filter(l => l.status !== 'lost');
  const pipelineValue = pipelineLeads.reduce((s, l) => s + l.leadScore * 1000, 0);
  const today = new Date().toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-6">
      {hasOverdue && (
        <button onClick={() => go('/app/finance/invoices')} className="w-full flex items-center gap-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-left hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <span className="flex-1 font-semibold text-red-700 dark:text-red-300">{invoiceStats!.overdue} forfaldne {invoiceStats!.overdue === 1 ? 'faktura' : 'fakturaer'}</span>
          <ArrowRight className="h-4 w-4 text-red-400 shrink-0" />
        </button>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{greet(user?.full_name)}</h1>
          <p className="text-sm text-muted-foreground capitalize mt-0.5">{today}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => go('/app/crm/leads')}><Plus className="h-3.5 w-3.5 mr-1" />Lead</Button>
          <Button size="sm" variant="outline" onClick={() => go('/app/finance/invoices')}><Plus className="h-3.5 w-3.5 mr-1" />Faktura</Button>
          <Button size="sm" onClick={() => go('/app/productivity/todos')}><Plus className="h-3.5 w-3.5 mr-1" />To-do</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users className="h-5 w-5 text-white" />} color="bg-blue-500" label="Leads i alt" value={totals ? fmt(totals.leads) : '—'} rawValue={totals?.leads} sub={totals ? `+${totals.leads_today} i dag` : undefined} onClick={() => go('/app/crm/leads')} />
        <StatCard icon={<TrendingUp className="h-5 w-5 text-white" />} color="bg-violet-500" label="Pipeline" value={`${fmtAmount(pipelineValue)} kr`} rawValue={pipelineValue} suffix=" kr" sub={`${pipelineLeads.length} aktive leads`} onClick={() => go('/app/crm/deals')} />
        <StatCard icon={<FileText className="h-5 w-5 text-white" />} color="bg-amber-500" label="Sendte fakturaer" value={invoiceStats ? fmt(invoiceStats.sent) : '—'} rawValue={invoiceStats?.sent} sub={invoiceStats ? `${fmtAmount(invoiceStats.total_sent_amount)} kr udestående` : undefined} onClick={() => go('/app/finance/invoices')} />
        <StatCard icon={<CreditCard className="h-5 w-5 text-white" />} color="bg-green-500" label="Betaling modtaget" value={paymentTotal !== null ? `${fmtAmount(paymentTotal)} kr` : '—'} rawValue={paymentTotal ?? undefined} suffix=" kr" sub={invoiceStats ? `${invoiceStats.paid} betalte fakturaer` : undefined} onClick={() => go('/app/finance/payments')} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><Flame className="h-4 w-4 text-orange-500" /><h3 className="font-semibold text-sm">Varme leads</h3></div>
            <button onClick={() => go('/app/crm/leads')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">Se alle <ArrowRight className="h-3 w-3" /></button>
          </div>
          {hotLeads.length > 0 ? (
            <div className="space-y-1">
              {hotLeads.map(lead => (
                <div key={lead.id} className="flex items-center gap-3 rounded-lg hover:bg-muted/50 px-3 py-2.5 -mx-3 transition-colors cursor-pointer" onClick={() => go('/app/crm/leads')}>
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${S_COLOR[lead.status] || 'bg-muted'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lead.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{lead.company || lead.email || '—'}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className={`h-1.5 w-3.5 rounded-full ${i <= Math.ceil(lead.leadScore / 20) ? 'bg-orange-400' : 'bg-muted'}`} />
                    ))}
                    <span className="text-xs font-bold tabular-nums w-5 text-right">{lead.leadScore}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-20 gap-2 text-muted-foreground">
              <p className="text-sm">Ingen varme leads endnu</p>
              <Button size="sm" variant="outline" onClick={() => go('/app/crm/leads')}><Plus className="h-3 w-3 mr-1" />Tilføj lead</Button>
            </div>
          )}
          {recent.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">Pipeline fordeling</p>
              <PipelineBar leads={recent} />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-500" /><h3 className="font-semibold text-sm">AI Fokus i dag</h3></div>
              <button className={`text-muted-foreground hover:text-foreground transition-colors ${focusLoading ? 'animate-spin' : ''}`} onClick={refreshFocus} disabled={focusLoading}><RefreshCw className="h-3.5 w-3.5" /></button>
            </div>
            {dailyFocus.length === 0 ? (
              <p className="text-xs text-muted-foreground">Klik på opdater for AI-fokus</p>
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
          <div className="rounded-2xl border bg-card p-5">
            <h3 className="font-semibold text-sm mb-3">Genveje</h3>
            <div className="space-y-0.5">
              {[
                { icon: <Mail className="h-4 w-4" />, label: 'Indbakke', path: '/app/communication/inbox' },
                { icon: <CheckSquare className="h-4 w-4" />, label: 'To-dos', path: '/app/productivity/todos' },
                { icon: <FileText className="h-4 w-4" />, label: 'Fakturaer', path: '/app/finance/invoices' },
                { icon: <Zap className="h-4 w-4" />, label: 'Workflows', path: '/app/workflows' },
              ].map(link => (
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

      {recent.length > 0 && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h3 className="font-semibold text-sm">Seneste leads</h3>
            <button onClick={() => go('/app/crm/leads')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">Alle leads <ArrowRight className="h-3 w-3" /></button>
          </div>
          <div className="divide-y">
            {recent.slice(0, 5).map(lead => (
              <div key={lead.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => go('/app/crm/leads')}>
                <div className={`h-2 w-2 rounded-full shrink-0 ${S_COLOR[lead.status] || 'bg-muted'}`} />
                <span className="flex-1 text-sm font-medium truncate">{lead.name}</span>
                <span className="text-sm text-muted-foreground hidden md:block truncate max-w-[150px]">{lead.company || lead.email || '—'}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{S_LABEL[lead.status] || lead.status}</span>
                <span className="text-xs font-bold tabular-nums w-6 text-right shrink-0">{lead.leadScore}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}




