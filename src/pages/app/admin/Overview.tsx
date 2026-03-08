import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StatCards from '@/components/StatCards';
import DataTable from '@/components/DataTable';
import { useI18n } from '@/lib/i18n';
import { api, AdminCompany, AdminUser } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import {
  Building2, Users, TrendingUp, AlertCircle, RefreshCw,
  CreditCard, Activity, ChevronRight, CheckCircle2, XCircle,
} from 'lucide-react';

// ── Plan badge ─────────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string }) {
  const styles: Record<string, string> = {
    free:       'bg-muted text-muted-foreground',
    starter:    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    pro:        'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    enterprise: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[plan?.toLowerCase()] ?? styles.free}`}>
      {plan || 'free'}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const ok = status === 'paid' || status === 'active';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {status || '—'}
    </span>
  );
}

export default function AdminOverviewPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCompanyUsers, setSelectedCompanyUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyCompanyId, setBusyCompanyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getAdminOverview();
      setCompanies(response.companies || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadOverview().catch(() => undefined);
  }, [loadOverview]);

  const loadCompanyUsers = async (companyId: string) => {
    setSelectedCompanyId(companyId);
    try {
      const users = await api.getAdminCompanyUsers(companyId);
      setSelectedCompanyUsers(users);
    } catch (err) {
      setSelectedCompanyUsers([]);
      toast({ title: err instanceof Error ? err.message : 'Could not load company users', variant: 'destructive' });
    }
  };

  const toggleCompanyStatus = async (company: AdminCompany) => {
    setBusyCompanyId(company.id);
    try {
      await api.setCompanyStatus(company.id, !company.is_active);
      await loadOverview();
      if (selectedCompanyId === company.id) {
        await loadCompanyUsers(company.id);
      }
      toast({ title: company.is_active ? t('admin.companyDeactivated') : t('admin.companyActivated') });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not update company status', variant: 'destructive' });
    } finally {
      setBusyCompanyId(null);
    }
  };

  const stats = useMemo(() => {
    const totalUsers = companies.reduce((sum, c) => sum + Number(c.user_count || 0), 0);
    const active = companies.filter((c) => c.is_active).length;
    const paidCount = companies.filter((c) => c.payment_status === 'paid' || c.payment_status === 'active').length;
    const proOrEnterprise = companies.filter((c) => c.plan === 'pro' || c.plan === 'enterprise').length;

    return [
      { title: 'Virksomheder i alt', value: String(companies.length), icon: Building2 },
      { title: 'Aktive brugere', value: String(totalUsers), icon: Users },
      { title: 'Aktive virksomheder', value: `${active} / ${companies.length}`, icon: Activity },
      { title: 'Betalende virksomheder', value: String(paidCount), icon: CreditCard },
      { title: 'Pro / Enterprise', value: String(proOrEnterprise), icon: TrendingUp },
      { title: 'Inaktive', value: String(companies.length - active), icon: XCircle },
    ];
  }, [companies]);

  const plans = useMemo(() => {
    const set = new Set(companies.map((c) => c.plan).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
      const matchPlan = planFilter === 'all' || c.plan === planFilter;
      return matchSearch && matchPlan;
    });
  }, [companies, search, planFilter]);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId),
    [companies, selectedCompanyId],
  );

  const userRows = useMemo(
    () =>
      selectedCompanyUsers.map((user) => ({
        name: user.full_name || '—',
        email: user.email,
        role: user.role,
        created: user.created_at ? new Date(user.created_at).toLocaleDateString('da-DK') : '—',
      })),
    [selectedCompanyUsers],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            {t('admin.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('admin.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadOverview()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Opdater
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground animate-pulse">Indlæser platformsoversigt…</div>
      ) : error ? (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {stats.map((s) => (
              <div key={s.title} className="rounded-xl border bg-card p-4 text-center space-y-1">
                <s.icon className="h-4 w-4 mx-auto text-muted-foreground" />
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground leading-tight">{s.title}</div>
              </div>
            ))}
          </div>

          {/* Virksomheder */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b flex-wrap">
              <h3 className="font-semibold text-sm">{t('admin.tables.companiesTitle')}</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  className="h-8 rounded-lg border border-input bg-background px-3 text-xs w-48"
                  placeholder="Søg virksomhed…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                >
                  {plans.map((p) => (
                    <option key={p} value={p}>{p === 'all' ? 'Alle planer' : p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="divide-y">
              {filteredCompanies.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Ingen virksomheder matcher søgningen</div>
              ) : (
                filteredCompanies.map((company) => (
                  <div
                    key={company.id}
                    className={`flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors ${
                      selectedCompanyId === company.id ? 'bg-primary/5' : ''
                    }`}
                  >
                    {/* Status indicator */}
                    <div className={`h-2 w-2 rounded-full shrink-0 ${company.is_active ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{company.name}</span>
                        <PlanBadge plan={company.plan} />
                        <PaymentBadge status={company.payment_status} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {company.user_count || 0} bruger{Number(company.user_count) !== 1 ? 'e' : ''}
                        {company.created_at && ` · Oprettet ${new Date(company.created_at).toLocaleDateString('da-DK')}`}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                        onClick={() => void loadCompanyUsers(company.id)}
                      >
                        Brugere <ChevronRight className="h-3 w-3" />
                      </button>
                      <button
                        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                          company.is_active
                            ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
                            : 'border-green-500/30 text-green-600 hover:bg-green-500/10'
                        }`}
                        disabled={busyCompanyId === company.id}
                        onClick={() => void toggleCompanyStatus(company)}
                      >
                        {busyCompanyId === company.id
                          ? '…'
                          : company.is_active
                          ? t('admin.deactivate')
                          : t('admin.activate')}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Brugere for valgt virksomhed */}
          {selectedCompanyId && (
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <div>
                  <h3 className="font-semibold text-sm">{t('admin.tables.usersTitle')}</h3>
                  {selectedCompany && (
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedCompany.name}</p>
                  )}
                </div>
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { setSelectedCompanyId(null); setSelectedCompanyUsers([]); }}>
                  Luk ×
                </button>
              </div>
              {userRows.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Ingen brugere fundet</div>
              ) : (
                <div className="divide-y">
                  {userRows.map((u, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                        {(u.name !== '—' ? u.name : u.email).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{u.name !== '—' ? u.name : u.email}</div>
                        {u.name !== '—' && <div className="text-xs text-muted-foreground truncate">{u.email}</div>}
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">{u.role}</Badge>
                      <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">{u.created}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
