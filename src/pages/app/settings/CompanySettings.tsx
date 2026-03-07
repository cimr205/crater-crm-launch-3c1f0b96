import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import { api, TenantSettings } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const paymentStatuses = ['pending', 'active', 'past_due', 'cancelled', 'trial'];

export default function CompanySettingsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();

  const [tenant, setTenant] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState(false);

  useEffect(() => {
    let active = true;

    api
      .getCompanySettings()
      .then((response) => {
        if (!active) return;
        setTenant(response.tenant);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const isOwner = !!user && (user.role === 'owner' || user.is_global_admin);

  const handleSave = async () => {
    if (!tenant) return;

    setSaving(true);
    try {
      const response = await api.updateCompanySettings({
        name: tenant.name,
        cvr: tenant.cvr || null,
        address: tenant.address || null,
        country: tenant.country || null,
        phone: tenant.phone || null,
        email: tenant.email || null,
        plan: tenant.plan,
        user_limit: tenant.user_limit || null,
        payment_status: tenant.payment_status,
      });

      setTenant(response.tenant);
      toast({ title: t('common.save') });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not save settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateInviteCode = async () => {
    if (!tenant) return;

    setRegeneratingCode(true);
    try {
      const response = await api.regenerateInviteCode();
      setTenant({ ...tenant, invite_code: response.invite_code });
      toast({ title: t('settings.inviteRegenerated') });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not regenerate code', variant: 'destructive' });
    } finally {
      setRegeneratingCode(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  if (!tenant) {
    return <div className="text-sm text-destructive">{t('settings.loadError')}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('settings.companyTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.companySubtitle')}</p>
      </div>

      <Card className="p-6 space-y-4 bg-card/70 backdrop-blur border-border">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.companyNameLabel')}</div>
            <Input value={tenant.name || ''} onChange={(event) => setTenant({ ...tenant, name: event.target.value })} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.cvrLabel')}</div>
            <Input value={tenant.cvr || ''} onChange={(event) => setTenant({ ...tenant, cvr: event.target.value })} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.addressLabel')}</div>
            <Input
              value={tenant.address || ''}
              onChange={(event) => setTenant({ ...tenant, address: event.target.value })}
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.countryLabel')}</div>
            <Input
              value={tenant.country || ''}
              onChange={(event) => setTenant({ ...tenant, country: event.target.value })}
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.phoneLabel')}</div>
            <Input value={tenant.phone || ''} onChange={(event) => setTenant({ ...tenant, phone: event.target.value })} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.emailLabel')}</div>
            <Input value={tenant.email || ''} onChange={(event) => setTenant({ ...tenant, email: event.target.value })} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.planLabel')}</div>
            <Input
              value={tenant.plan || ''}
              onChange={(event) => setTenant({ ...tenant, plan: event.target.value })}
              disabled={!isOwner}
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.userLimitLabel')}</div>
            <Input
              type="number"
              value={tenant.user_limit || ''}
              onChange={(event) =>
                setTenant({ ...tenant, user_limit: event.target.value ? Number(event.target.value) : null })
              }
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.paymentStatusLabel')}</div>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={tenant.payment_status || 'pending'}
              onChange={(event) => setTenant({ ...tenant, payment_status: event.target.value })}
              disabled={!isOwner}
            >
              {paymentStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.companyStatusLabel')}</div>
            <div className="h-10 rounded-md border border-input bg-muted/40 px-3 text-sm flex items-center">
              {tenant.is_active ? t('settings.statusActive') : t('settings.statusInactive')}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.createdLabel')}</div>
            <div className="h-10 rounded-md border border-input bg-muted/40 px-3 text-sm flex items-center">
              {tenant.created_at ? new Date(tenant.created_at).toLocaleString() : '—'}
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.inviteCodeLabel')}</div>
            <div className="flex gap-2">
              <Input value={tenant.invite_code || 'Hidden'} readOnly />
              {isOwner && (
                <Button variant="outline" onClick={handleRegenerateInviteCode} disabled={regeneratingCode}>
                  {regeneratingCode ? t('common.loading') : t('settings.regenerate')}
                </Button>
              )}
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? t('common.loading') : t('settings.updateCta')}
        </Button>
      </Card>
    </div>
  );
}
