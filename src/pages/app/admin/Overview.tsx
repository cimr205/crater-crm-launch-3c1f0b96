import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import StatCards from '@/components/StatCards';
import DataTable from '@/components/DataTable';
import { useI18n } from '@/lib/i18n';
import { api, AdminCompany, AdminUser } from '@/lib/api';

export default function AdminOverviewPage() {
  const { t } = useI18n();
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCompanyUsers, setSelectedCompanyUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyCompanyId, setBusyCompanyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = async () => {
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
  };

  useEffect(() => {
    loadOverview().catch(() => undefined);
  }, []);

  const loadCompanyUsers = async (companyId: string) => {
    setSelectedCompanyId(companyId);
    try {
      const users = await api.getAdminCompanyUsers(companyId);
      setSelectedCompanyUsers(users);
    } catch {
      setSelectedCompanyUsers([]);
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
    } finally {
      setBusyCompanyId(null);
    }
  };

  const stats = useMemo(() => {
    const totalUsers = companies.reduce((sum, company) => sum + Number(company.user_count || 0), 0);
    const activeCompanies = companies.filter((company) => company.is_active).length;
    const inactiveCompanies = companies.length - activeCompanies;

    return [
      { title: 'Companies', value: String(companies.length) },
      { title: 'Users', value: String(totalUsers) },
      { title: 'Active', value: String(activeCompanies) },
      { title: 'Inactive', value: String(inactiveCompanies) },
    ];
  }, [companies]);

  const companyRows = useMemo(
    () =>
      companies.map((company) => ({
        id: company.id,
        name: company.name,
        plan: company.plan,
        payment: company.payment_status,
        users: String(company.user_count || 0),
        status: company.is_active ? 'active' : 'inactive',
        created: company.created_at ? new Date(company.created_at).toLocaleDateString() : '—',
      })),
    [companies]
  );

  const userRows = useMemo(
    () =>
      selectedCompanyUsers.map((user) => ({
        name: user.full_name || '—',
        email: user.email,
        role: user.role,
        created: user.created_at ? new Date(user.created_at).toLocaleDateString() : '—',
      })),
    [selectedCompanyUsers]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('admin.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('admin.subtitle')}</p>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : (
        <>
          <StatCards items={stats} />

          <div className="rounded-xl border border-border bg-card/70 backdrop-blur p-4 space-y-3">
            <div className="text-sm font-semibold">Companies</div>
            <DataTable
              columns={[
                { key: 'name', label: 'Company' },
                { key: 'plan', label: 'Plan' },
                { key: 'payment', label: 'Payment status' },
                { key: 'users', label: 'Users' },
                { key: 'status', label: 'Status' },
                { key: 'created', label: 'Created' },
              ]}
              rows={companyRows}
              emptyLabel="No companies"
            />

            <div className="flex flex-wrap gap-2">
              {companies.map((company) => (
                <div key={company.id} className="rounded border border-border p-2 text-xs flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => loadCompanyUsers(company.id)}>
                    {company.name}
                  </Button>
                  <Button
                    size="sm"
                    variant={company.is_active ? 'destructive' : 'default'}
                    disabled={busyCompanyId === company.id}
                    onClick={() => toggleCompanyStatus(company)}
                  >
                    {busyCompanyId === company.id
                      ? t('common.loading')
                      : company.is_active
                      ? 'Deactivate'
                      : 'Activate'}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/70 backdrop-blur p-4 space-y-3">
            <div className="text-sm font-semibold">Users in selected company</div>
            <DataTable
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'email', label: 'Email' },
                { key: 'role', label: 'Role' },
                { key: 'created', label: 'Created' },
              ]}
              rows={userRows}
              emptyLabel={selectedCompanyId ? 'No users in this company' : 'Select a company above'}
            />
          </div>
        </>
      )}
    </div>
  );
}
