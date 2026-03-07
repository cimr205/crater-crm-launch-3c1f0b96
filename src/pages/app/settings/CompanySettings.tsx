import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import { api, TenantSettings } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ImagePlus, X } from 'lucide-react';

const LOGO_KEY = 'crater_invoice_logo';

const paymentStatuses = ['pending', 'active', 'past_due', 'cancelled', 'trial'];

export default function CompanySettingsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();

  const [tenant, setTenant] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>(() => localStorage.getItem(LOGO_KEY) || '');
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 600_000) { toast({ title: 'Logo må højst være 600 KB', variant: 'destructive' }); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setLogoUrl(b64);
      localStorage.setItem(LOGO_KEY, b64);
      toast({ title: 'Logo gemt — vises på fakturaer' });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleLogoRemove = () => {
    setLogoUrl('');
    localStorage.removeItem(LOGO_KEY);
    toast({ title: 'Logo fjernet' });
  };

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

      {/* Logo card */}
      <Card className="p-6 space-y-4 bg-card/70 backdrop-blur border-border">
        <div>
          <h2 className="text-base font-semibold">Virksomhedslogo</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Logoet vises øverst på alle fakturaer du udskriver eller sender.</p>
        </div>
        {logoUrl ? (
          <div className="flex items-center gap-4">
            <div className="border rounded-lg p-3 bg-white">
              <img src={logoUrl} alt="Virksomhedslogo" className="h-16 max-w-[240px] object-contain" />
            </div>
            <div className="space-y-2">
              <Button size="sm" variant="outline" onClick={() => logoInputRef.current?.click()}>
                <ImagePlus className="h-4 w-4 mr-2" />Skift logo
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive block" onClick={handleLogoRemove}>
                <X className="h-4 w-4 mr-2" />Fjern logo
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors w-full py-10 cursor-pointer"
            onClick={() => logoInputRef.current?.click()}
          >
            <ImagePlus className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">Klik for at uploade logo</p>
              <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG eller SVG · Maks 600 KB</p>
            </div>
          </button>
        )}
        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="sr-only"
          onChange={handleLogoUpload}
        />
      </Card>
    </div>
  );
}
