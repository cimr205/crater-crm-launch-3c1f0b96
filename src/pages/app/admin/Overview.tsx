import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatCards from '@/components/StatCards';
import DataTable from '@/components/DataTable';
import { useI18n } from '@/lib/i18n';
import { api, AdminCompany, AdminUser } from '@/lib/api';

type OverviewData = {
  companies: AdminCompany[];
  users: AdminUser[];
};

export default function AdminOverviewPage() {
  const { t } = useI18n();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .getAdminOverview()
      .then((response) => {
        if (!active) return;
        setData(response);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : t('admin.loadError'));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await api.downloadAdminCompaniesHistoryCsv(month);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `all-companies-history-${month}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.exportError'));
    } finally {
      setExporting(false);
    }
  };

  const stats = useMemo(() => {
    const companies = data?.companies ?? [];
    const users = data?.users ?? [];
    const verified = users.filter((user) => user.email_verified).length;
    const admins = users.filter((user) => user.role === 'admin').length;
    return [
      { title: t('admin.stats.companies'), value: String(companies.length) },
      { title: t('admin.stats.users'), value: String(users.length) },
      { title: t('admin.stats.verifiedUsers'), value: String(verified) },
      { title: t('admin.stats.admins'), value: String(admins) },
    ];
  }, [data, t]);

  const companyRows = useMemo(
    () =>
      (data?.companies ?? []).map((company) => ({
        name: company.name,
        joinCode: company.joinCode || '—',
        users: String(company.userCount ?? 0),
        language: company.defaultLanguage || '—',
        theme: company.defaultTheme || '—',
        created: company.createdAt ? new Date(company.createdAt).toLocaleDateString() : '—',
      })),
    [data]
  );

  const userRows = useMemo(
    () =>
      (data?.users ?? []).map((user) => ({
        name: user.name || '—',
        email: user.email,
        role: user.role,
        company: user.company_id || '—',
        verified: user.email_verified ? t('admin.verifiedYes') : t('admin.verifiedNo'),
        created: user.created_at ? new Date(user.created_at).toLocaleDateString() : '—',
      })),
    [data, t]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('admin.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('admin.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground" htmlFor="admin-export-month">
              {t('admin.exportLabel')}
            </label>
            <Input
              id="admin-export-month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="w-40"
            />
          </div>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? t('common.loading') : t('admin.exportCta')}
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

          <div className="space-y-6">
            <div className="space-y-3">
              <div className="text-sm font-semibold">{t('admin.tables.companiesTitle')}</div>
              <DataTable
                columns={[
                  { key: 'name', label: t('admin.columns.companyName') },
                  { key: 'joinCode', label: t('admin.columns.joinCode') },
                  { key: 'users', label: t('admin.columns.users') },
                  { key: 'language', label: t('admin.columns.language') },
                  { key: 'theme', label: t('admin.columns.theme') },
                  { key: 'created', label: t('admin.columns.created') },
                ]}
                rows={companyRows}
                emptyLabel={t('admin.emptyCompanies')}
              />
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold">{t('admin.tables.usersTitle')}</div>
              <DataTable
                columns={[
                  { key: 'name', label: t('admin.columns.userName') },
                  { key: 'email', label: t('admin.columns.email') },
                  { key: 'role', label: t('admin.columns.role') },
                  { key: 'company', label: t('admin.columns.companyId') },
                  { key: 'verified', label: t('admin.columns.verified') },
                  { key: 'created', label: t('admin.columns.created') },
                ]}
                rows={userRows}
                emptyLabel={t('admin.emptyUsers')}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

