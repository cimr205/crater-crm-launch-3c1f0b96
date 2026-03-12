import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type CompanyUser = {
  id: string;
  role: string;
  email: string;
  full_name: string | null;
  created_at: string;
};

type RoleOption = {
  slug: string;
  label: string;
};

export default function EmployeesPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [companyUsers, availableRoles] = await Promise.all([api.getCompanyUsers(), api.getRoles()]);
      setUsers(companyUsers);
      setRoles(availableRoles.map((role) => ({ slug: role.slug, label: role.label })));
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not load employees', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const updateRole = async (userId: string, role: string) => {
    setBusyUserId(userId);
    try {
      await api.updateCompanyUserRole(userId, role);
      await load();
      toast({ title: 'Role updated' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not update role', variant: 'destructive' });
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('hr.employeesTitle')}</h1>
        <Button variant="outline" onClick={() => load()} disabled={loading}>
          {t('hr.refresh')}
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="text-sm text-muted-foreground">{t('hr.empty')}</div>
          <Button onClick={() => window.location.href = window.location.origin + window.location.pathname.replace('hr/employees', 'settings/company')}>
            {t('hr.addEmployee')}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card/70 backdrop-blur">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('hr.name')}</TableHead>
                <TableHead>{t('hr.email')}</TableHead>
                <TableHead>{t('hr.role')}</TableHead>
                <TableHead>{t('hr.status')}</TableHead>
                <TableHead>{t('hr.created')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.full_name || '—'}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={user.role}
                      onChange={(event) => updateRole(user.id, event.target.value)}
                      disabled={busyUserId === user.id}
                    >
                      {roles.map((role) => (
                        <option key={role.slug} value={role.slug}>
                          {role.label} ({role.slug})
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>{busyUserId === user.id ? t('common.loading') : t('hr.active')}</TableCell>
                  <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
