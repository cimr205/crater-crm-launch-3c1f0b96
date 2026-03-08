import { useCallback, useEffect, useState } from 'react';
import { api, AdminAiCompanyUsage } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Sparkles, RefreshCw, Loader2, ImageIcon, Video,
  Building2, Server, AlertCircle, CheckCircle2, Minus,
  TrendingUp, XCircle,
} from 'lucide-react';

type ServerStatus = 'online' | 'offline' | 'degraded';

function ServerStatusBadge({ status }: { status: ServerStatus | null }) {
  if (!status) return null;
  const cfg = {
    online:   { label: 'Online',    icon: CheckCircle2, cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
    degraded: { label: 'Degraderet', icon: AlertCircle,  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
    offline:  { label: 'Offline',   icon: XCircle,      cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  }[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full font-medium ${cfg.cls}`}>
      <Icon className="h-4 w-4" />
      AI Server: {cfg.label}
    </span>
  );
}

export default function AdminAiUsagePage() {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<AdminAiCompanyUsage[]>([]);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [totalToday, setTotalToday] = useState(0);
  const [failedToday, setFailedToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'total' | 'failed' | 'name'>('total');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminAiUsage();
      setCompanies(res.companies ?? []);
      setServerStatus(res.serverStatus ?? 'offline');
      setTotalToday(res.totalToday ?? 0);
      setFailedToday(res.failedToday ?? 0);
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : 'Kunne ikke hente AI-data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const sorted = [...companies].sort((a, b) => {
    if (sortBy === 'total') return (b.totalImages + b.totalVideos) - (a.totalImages + a.totalVideos);
    if (sortBy === 'failed') return b.failedCount - a.failedCount;
    return a.companyName.localeCompare(b.companyName);
  });

  const totalImages = companies.reduce((s, c) => s + c.totalImages, 0);
  const totalVideos = companies.reduce((s, c) => s + c.totalVideos, 0);
  const totalFailed = companies.reduce((s, c) => s + c.failedCount, 0);
  const activeCompanies = companies.filter((c) => c.totalImages + c.totalVideos > 0).length;

  const maxTotal = Math.max(...companies.map((c) => c.totalImages + c.totalVideos), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-500" />
            AI Generering — Admin
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overvåg AI-brug på tværs af alle virksomheder, server-status og fejl
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ServerStatusBadge status={serverStatus} />
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Opdater
          </Button>
        </div>
      </div>

      {/* Platform-wide stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: <ImageIcon className="h-5 w-5 text-white" />,
            bg: 'bg-purple-500',
            label: 'Billeder i alt',
            value: totalImages,
          },
          {
            icon: <Video className="h-5 w-5 text-white" />,
            bg: 'bg-blue-500',
            label: 'Videoer i alt',
            value: totalVideos,
          },
          {
            icon: <Building2 className="h-5 w-5 text-white" />,
            bg: 'bg-green-500',
            label: 'Aktive virksomheder',
            value: activeCompanies,
          },
          {
            icon: <AlertCircle className="h-5 w-5 text-white" />,
            bg: totalFailed > 0 ? 'bg-red-500' : 'bg-muted',
            label: 'Fejlede jobs',
            value: totalFailed,
          },
        ].map((card) => (
          <Card key={card.label} className="p-5">
            <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${card.bg} mb-3`}>
              {card.icon}
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{card.label}</p>
            <p className="text-3xl font-bold mt-0.5">{card.value.toLocaleString('da-DK')}</p>
          </Card>
        ))}
      </div>

      {/* Today's stats */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">I dag</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-muted/50 p-4 text-center">
            <div className="text-3xl font-bold">{totalToday}</div>
            <div className="text-xs text-muted-foreground mt-1">Genereringer i dag</div>
          </div>
          <div className={`rounded-xl p-4 text-center ${failedToday > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-muted/50'}`}>
            <div className={`text-3xl font-bold ${failedToday > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
              {failedToday}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Fejlede i dag</div>
          </div>
        </div>
      </div>

      {/* Server info */}
      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">AI Server information</h3>
          </div>
          <ServerStatusBadge status={serverStatus} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {[
            { label: 'Image model',  value: 'Stable Diffusion XL' },
            { label: 'Video model',  value: 'Wan2.2 / Open-Sora' },
            { label: 'Isolation',    value: 'Per virksomhed (tenant ID)' },
            { label: 'Storage',      value: 'Server + cloud backup' },
          ].map((row) => (
            <div key={row.label} className="rounded-lg bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">{row.label}</div>
              <div className="text-xs font-medium mt-0.5">{row.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-company table */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-sm">Brug per virksomhed</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            Sorter:
            {(['total', 'failed', 'name'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-2.5 py-1 rounded-md transition-colors ${sortBy === s ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                {s === 'total' ? 'Mest brug' : s === 'failed' ? 'Flest fejl' : 'Navn'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <Minus className="h-6 w-6 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Ingen AI-aktivitet endnu</p>
          </div>
        ) : (
          <div className="divide-y">
            {sorted.map((co) => {
              const total = co.totalImages + co.totalVideos;
              const pct = (total / maxTotal) * 100;
              return (
                <div key={co.companyId} className="px-5 py-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-4">
                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{co.companyName}</span>
                        {co.failedCount > 0 && (
                          <Badge variant="destructive" className="text-xs shrink-0">
                            {co.failedCount} fejl
                          </Badge>
                        )}
                      </div>
                      {/* Usage bar */}
                      <div className="mt-1.5 h-1.5 w-full max-w-xs bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-5 shrink-0 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span className="font-medium text-foreground">{co.totalImages}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Video className="h-3.5 w-3.5" />
                        <span className="font-medium text-foreground">{co.totalVideos}</span>
                      </div>
                      <div className="text-xs text-muted-foreground hidden md:block">
                        {co.lastActivityAt
                          ? new Date(co.lastActivityAt).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
                          : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
