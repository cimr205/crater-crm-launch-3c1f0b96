/**
 * Email Tracking — overblik over åbninger, klik og svar på tværs af kampagner
 * Henter data direkte fra Listmonk (views, clicks, bounces, sent)
 */
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { isConfigured } from '@/lib/serviceConfig';
import * as lm from '@/lib/listmonk';
import {
  Mail, MousePointerClick, Eye, AlertTriangle,
  RefreshCw, TrendingUp, Users, Send,
  ChevronUp, ChevronDown, Minus,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CampaignStats {
  id: string;
  name: string;
  subject: string;
  status: string;
  sent: number;
  toSend: number;
  opens: number;
  clicks: number;
  bounces: number;
  sentAt: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

function fmt(n: number) {
  return n.toLocaleString('da-DK');
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function RateBadge({ value, thresholds }: { value: number; thresholds: [number, number] }) {
  const [warn, good] = thresholds;
  const color = value >= good
    ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20'
    : value >= warn
    ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20'
    : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
  const Icon = value >= good ? ChevronUp : value >= warn ? Minus : ChevronDown;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
      <Icon className="h-3 w-3" />{value}%
    </span>
  );
}

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-muted text-muted-foreground',
  scheduled: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  running:   'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  paused:    'bg-orange-500/10 text-orange-600 border-orange-500/20',
  finished:  'bg-green-500/10 text-green-600 border-green-500/20',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
};
const STATUS_DA: Record<string, string> = {
  draft: 'Kladde', scheduled: 'Planlagt', running: 'Sender',
  paused: 'Pauset', finished: 'Færdig', cancelled: 'Annulleret',
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 flex items-start gap-4">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EmailTrackingPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const useListmonk = isConfigured('listmonk');

  const [campaigns, setCampaigns] = useState<CampaignStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (useListmonk) {
        const raw = await lm.getCampaigns(1, 100);
        setCampaigns(raw.map(c => ({
          id: String(c.id),
          name: c.name,
          subject: c.subject,
          status: c.status,
          sent: c.sent,
          toSend: c.to_send,
          opens: c.views,
          clicks: c.clicks,
          bounces: c.bounces,
          sentAt: c.started_at,
        })));
      } else {
        setError('Email tracking kræver Listmonk — tilslut under Integrationer.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke hente data');
    } finally {
      setLoading(false);
    }
  }, [useListmonk]);

  useEffect(() => { void load(); }, [load]);

  // ── Aggregates ──────────────────────────────────────────────────────────────

  const sent = campaigns.filter(c => c.status === 'finished' || c.status === 'running');
  const totalSent    = sent.reduce((s, c) => s + c.sent, 0);
  const totalOpens   = sent.reduce((s, c) => s + c.opens, 0);
  const totalClicks  = sent.reduce((s, c) => s + c.clicks, 0);
  const totalBounces = sent.reduce((s, c) => s + c.bounces, 0);
  const avgOpenRate  = pct(totalOpens, totalSent);
  const avgClickRate = pct(totalClicks, totalSent);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{t('emailTracking.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('emailTracking.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Not configured */}
      {!useListmonk && !loading && (
        <div className="rounded-2xl border border-dashed p-10 text-center space-y-3">
          <Mail className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="font-medium">{t('emailTracking.noListmonk')}</p>
          <p className="text-sm text-muted-foreground">{t('emailTracking.noListmonkSub')}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {useListmonk && !error && (
        <>
          {/* Aggregate stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Send} label={t('emailTracking.totalSent')} value={fmt(totalSent)}
              sub={`${sent.length} ${t('emailTracking.campaigns')}`}
              color="bg-blue-500/10 text-blue-600"
            />
            <StatCard
              icon={Eye} label={t('emailTracking.openRate')} value={`${avgOpenRate}%`}
              sub={`${fmt(totalOpens)} ${t('emailTracking.opens')}`}
              color="bg-violet-500/10 text-violet-600"
            />
            <StatCard
              icon={MousePointerClick} label={t('emailTracking.clickRate')} value={`${avgClickRate}%`}
              sub={`${fmt(totalClicks)} ${t('emailTracking.clicks')}`}
              color="bg-emerald-500/10 text-emerald-600"
            />
            <StatCard
              icon={AlertTriangle} label={t('emailTracking.bounces')} value={fmt(totalBounces)}
              sub={`${pct(totalBounces, totalSent)}% ${t('emailTracking.bounceRate')}`}
              color="bg-red-500/10 text-red-600"
            />
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground px-1">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              {t('emailTracking.legendGood')} ≥ 20% åbning / ≥ 3% klik
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
              {t('emailTracking.legendOk')} 10-19% / 1-2%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              {t('emailTracking.legendLow')} &lt; 10% / &lt; 1%
            </span>
          </div>

          {/* Campaign table */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl border bg-card h-20 animate-pulse" />
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center space-y-2">
              <TrendingUp className="h-8 w-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">{t('emailTracking.noCampaigns')}</p>
            </div>
          ) : (
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('emailTracking.col.campaign')}</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                        <Users className="h-3.5 w-3.5 inline mr-1" />{t('emailTracking.col.sent')}
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                        <Eye className="h-3.5 w-3.5 inline mr-1" />{t('emailTracking.col.opens')}
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                        <MousePointerClick className="h-3.5 w-3.5 inline mr-1" />{t('emailTracking.col.clicks')}
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                        <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />{t('emailTracking.col.bounces')}
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t('emailTracking.col.sent_at')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c, i) => {
                      const openRate  = pct(c.opens, c.sent);
                      const clickRate = pct(c.clicks, c.sent);
                      return (
                        <tr key={c.id} className={`border-b last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/10'} hover:bg-muted/20 transition-colors`}>
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <div className="min-w-0">
                                <p className="font-medium truncate max-w-xs">{c.name}</p>
                                <p className="text-xs text-muted-foreground truncate max-w-xs mt-0.5">{c.subject}</p>
                              </div>
                              <Badge variant="outline" className={`text-xs shrink-0 ${STATUS_COLORS[c.status] ?? ''}`}>
                                {STATUS_DA[c.status] ?? c.status}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(c.sent)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="tabular-nums font-medium">{fmt(c.opens)}</span>
                              {c.sent > 0 && <RateBadge value={openRate} thresholds={[10, 20]} />}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="tabular-nums font-medium">{fmt(c.clicks)}</span>
                              {c.sent > 0 && <RateBadge value={clickRate} thresholds={[1, 3]} />}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="tabular-nums font-medium">{fmt(c.bounces)}</span>
                              {c.bounces > 0 && (
                                <span className="text-xs text-red-500">{pct(c.bounces, c.sent)}%</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">{fmtDate(c.sentAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tips */}
          {sent.length > 0 && (
            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                {t('emailTracking.benchmarks')}
              </p>
              <div className="grid sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
                <div className="rounded-xl bg-muted/40 p-3 space-y-1">
                  <p className="font-medium text-foreground">📬 {t('emailTracking.tip.openRate')}</p>
                  <p>Industri-gennemsnit: <strong>20–25%</strong></p>
                  <p>Din gennemsnit: <strong className={avgOpenRate >= 20 ? 'text-green-600' : avgOpenRate >= 10 ? 'text-yellow-600' : 'text-red-500'}>{avgOpenRate}%</strong></p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3 space-y-1">
                  <p className="font-medium text-foreground">🖱️ {t('emailTracking.tip.clickRate')}</p>
                  <p>Industri-gennemsnit: <strong>2–5%</strong></p>
                  <p>Din gennemsnit: <strong className={avgClickRate >= 3 ? 'text-green-600' : avgClickRate >= 1 ? 'text-yellow-600' : 'text-red-500'}>{avgClickRate}%</strong></p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3 space-y-1">
                  <p className="font-medium text-foreground">⚠️ {t('emailTracking.tip.bounceRate')}</p>
                  <p>Acceptabelt: <strong>&lt; 2%</strong></p>
                  <p>Din: <strong className={pct(totalBounces, totalSent) < 2 ? 'text-green-600' : 'text-red-500'}>{pct(totalBounces, totalSent)}%</strong></p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
