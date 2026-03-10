import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { api, type AdminPhoneUsage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { Pencil, Check, X } from 'lucide-react';

export default function AdminPhoneUsagePage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<AdminPhoneUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLimit, setEditLimit] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminListPhoneUsage();
      setTenants(res.data.tenants ?? []);
    } catch {
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const startEdit = (t: AdminPhoneUsage) => {
    setEditingId(t.company_id);
    setEditLimit(String(t.minutes_limit));
    setEditPlan(t.plan);
  };

  const saveEdit = async (companyId: string) => {
    setSaving(true);
    try {
      await api.adminUpdatePhonePlan(companyId, {
        minutes_limit: Number(editLimit),
        plan: editPlan,
      });
      setTenants(prev => prev.map(t =>
        t.company_id === companyId
          ? { ...t, minutes_limit: Number(editLimit), plan: editPlan }
          : t
      ));
      setEditingId(null);
      toast({ title: 'Plan opdateret' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Fejl', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const totalActive = tenants.filter(t => t.active).length;
  const totalMinutes = tenants.reduce((sum, t) => sum + t.minutes_used, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('phone.adminTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('phone.adminSubtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>{t('crm.refresh')}</Button>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4 bg-card/70 backdrop-blur border-border">
          <div className="text-xs text-muted-foreground">{t('phone.adminActiveNumbers')}</div>
          <div className="text-2xl font-bold mt-1">{totalActive}</div>
        </Card>
        <Card className="p-4 bg-card/70 backdrop-blur border-border">
          <div className="text-xs text-muted-foreground">{t('phone.adminTotalMinutes')}</div>
          <div className="text-2xl font-bold mt-1">{totalMinutes} min</div>
        </Card>
        <Card className="p-4 bg-card/70 backdrop-blur border-border">
          <div className="text-xs text-muted-foreground">{t('phone.adminTwilioCost')}</div>
          <div className="text-2xl font-bold mt-1">${(totalMinutes * 0.013).toFixed(2)}</div>
        </Card>
      </div>

      <Card className="bg-card/70 backdrop-blur border-border">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : tenants.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">{t('phone.adminNoTenants')}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('phone.col.lead')}</TableHead>
                <TableHead>{t('phone.yourNumber')}</TableHead>
                <TableHead>{t('phone.planLabel')}</TableHead>
                <TableHead>{t('phone.usageThisMonth')}</TableHead>
                <TableHead>{t('phone.adminUsageBar')}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => {
                const pct = Math.min(100, (tenant.minutes_used / tenant.minutes_limit) * 100);
                const isEditing = editingId === tenant.company_id;
                return (
                  <TableRow key={tenant.company_id}>
                    <TableCell>
                      <div className="text-sm font-medium">{tenant.company_name}</div>
                      <div className={`text-xs mt-0.5 ${tenant.active ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {tenant.active ? '● Aktiv' : '○ Inaktiv'}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-mono">{tenant.phone_number || '—'}</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          className="h-7 w-24 text-xs"
                          value={editPlan}
                          onChange={e => setEditPlan(e.target.value)}
                        />
                      ) : (
                        <span className="text-sm">{tenant.plan}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            className="h-7 w-20 text-xs"
                            value={editLimit}
                            onChange={e => setEditLimit(e.target.value)}
                          />
                          <span className="text-xs text-muted-foreground">min</span>
                        </div>
                      ) : (
                        <span className={`text-sm ${pct > 80 ? 'text-destructive font-medium' : ''}`}>
                          {tenant.minutes_used} / {tenant.minutes_limit} min
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="w-32">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct > 80 ? 'bg-destructive' : pct > 60 ? 'bg-yellow-500' : 'bg-primary'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" disabled={saving} onClick={() => void saveEdit(tenant.company_id)}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(tenant)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
